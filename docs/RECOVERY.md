# Admin password recovery

This procedure changes one existing active `admin` account's password while preserving its identity, role, active status, and all academic records. It revokes that account's existing sessions. It is intended for a short, approved maintenance window on an approved-v2 database.

The procedure has not been executed against production data. The recovery helper is documented inline; no recovery CLI or script is shipped with the application.

## Before starting

1. Obtain authorization for the maintenance window and confirm that no one is actively administering the LMS.
2. Obtain private access to the server and its database. Confirm the actual absolute `DB_PATH` used by the running service from its supervisor configuration, working directory, or environment. Resolve a relative path against the service's actual working directory; if unset, the default is `data/lms.db` relative to that directory. Process environment overrides `.env`. Inspect privately: do not source or print the environment, and do not paste secrets into a terminal transcript. Confirm the database and its parent directory are outside Git and accessible only to authorized operators/service users, with enough space for a full backup.
3. Confirm the actual service name and the normal supervisor used on that server. This guide intentionally does not invent a service name or supervisor command.
4. Confirm that the server has a compatible Python 3 interpreter with the `bcrypt` module and SQLite support. The prerequisite check is:

   ```sh
   python3 -c 'import sqlite3,bcrypt; print("recovery prerequisites available")'
   ```

   The project has not preinstalled or verified this module on the recovery host. Install dependencies only through the host's approved package process.
5. Stop the service and every worker or scheduled process that can write to this database, using the normal supervisor. Wait until all writers have stopped. SQLite WAL and shared-memory files must remain alongside the database during this procedure.
6. Use a private shell on an Ubuntu/Linux maintenance host. Do not run the heredoc below in a Windows terminal. It prompts for the absolute database path, the admin email, and the new password without putting a password or hash in command arguments or output.

## Run the recovery

Run this complete heredoc as one command after all writers are stopped:

```sh
python3 - <<'PY'
import datetime as dt
import getpass
import os
import sqlite3
import sys
import warnings
from pathlib import Path
from urllib.parse import quote

import bcrypt

# The heredoc supplies program source on stdin; read prompts from the terminal.
sys.stdin = open("/dev/tty", "r", encoding="utf-8")
warnings.simplefilter("error", getpass.GetPassWarning)


def utc_timestamp():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def fail(message):
    raise RuntimeError(message)


db_text = input("Absolute DB_PATH: ").strip()
db_path = Path(db_text).expanduser()
if not db_path.is_absolute():
    fail("DB_PATH must be an absolute path")
if not db_path.is_file():
    fail("DB_PATH must name an existing database file")
db_path = db_path.resolve(strict=True)

email = input("Existing admin email: ").strip().lower()
if not email:
    fail("admin email is required")

new_password = getpass.getpass("New admin password: ")
if new_password != getpass.getpass("Repeat new admin password: "):
    fail("passwords do not match")
try:
    password_bytes = new_password.encode("utf-8")
except UnicodeEncodeError:
    fail("password is not valid UTF-8")
if not 12 <= len(password_bytes) <= 72:
    fail("password must be 12 to 72 UTF-8 bytes")

backup_path = None
db = None
backup = None
try:
    uri = "file:" + quote(str(db_path), safe="/:") + "?mode=rw"
    db = sqlite3.connect(uri, uri=True, isolation_level=None)
    db.execute("PRAGMA foreign_keys=ON")

    contract = db.execute("SELECT name FROM backend_contract WHERE id=1").fetchone()
    if contract != ("approved-v2",):
        fail("database is not the approved-v2 database")
    version = db.execute("SELECT max(version) FROM schema_migrations").fetchone()
    if version != (1,):
        fail("database migration version must be 1")
    required_tables = {"users", "user_sessions"}
    tables = {
        row[0]
        for row in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN (?,?)",
            tuple(sorted(required_tables)),
        )
    }
    if tables != required_tables:
        fail("required users/session tables are missing")

    integrity = db.execute("PRAGMA integrity_check").fetchall()
    if integrity != [("ok",)]:
        fail("database integrity check failed")

    account = db.execute(
        "SELECT id,email,role,is_active,token_version,password_hash "
        "FROM users WHERE email=? COLLATE NOCASE AND role='admin' AND is_active=1",
        (email,),
    ).fetchall()
    if len(account) != 1:
        fail("exactly one active admin account matching that email was not found")
    user_id, selected_email, role, is_active, old_version, old_hash = account[0]
    if role != "admin" or is_active != 1:
        fail("selected account is not an active admin")

    # Create a sibling backup without overwriting an existing file.
    previous_umask = os.umask(0o077)
    try:
        for suffix in range(1000):
            candidate = db_path.with_name(db_path.name + ".backup-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ("" if suffix == 0 else f"-{suffix}"))
            try:
                fd = os.open(str(candidate), os.O_CREAT | os.O_EXCL | os.O_RDWR, 0o600)
                try:
                    os.fchmod(fd, 0o600)
                finally:
                    os.close(fd)
                backup_path = candidate
                break
            except FileExistsError:
                continue
    finally:
        os.umask(previous_umask)
    if backup_path is None:
        fail("could not allocate a unique backup path")

    backup = sqlite3.connect(str(backup_path), isolation_level=None)
    db.backup(backup)
    backup_integrity = backup.execute("PRAGMA integrity_check").fetchall()
    if backup_integrity != [("ok",)]:
        fail("backup integrity check failed")
    backup.close()
    backup = None

    password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=10)).decode("ascii")
    changed_at = utc_timestamp()
    db.execute("BEGIN IMMEDIATE")
    current = db.execute(
        "SELECT email,role,is_active,token_version,password_hash FROM users WHERE id=?",
        (user_id,),
    ).fetchone()
    if current != (selected_email, "admin", 1, old_version, old_hash):
        fail("account changed after the preflight check; no password update was made")
    updated = db.execute(
        "UPDATE users SET password_hash=?, token_version=token_version+1, updated_at=? "
        "WHERE id=? AND email=? COLLATE NOCASE AND role='admin' AND is_active=1 "
        "AND token_version=? AND password_hash=?",
        (password_hash, changed_at, user_id, selected_email, old_version, old_hash),
    )
    if updated.rowcount != 1:
        fail("guarded password update did not affect exactly one account")
    db.execute(
        "UPDATE user_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
        (changed_at, user_id),
    )
    db.execute("COMMIT")
    print(f"Recovery complete. Backup: {backup_path}")
    print("The selected admin password was changed and its existing sessions were revoked.")
except BaseException:
    if db is not None and db.in_transaction:
        db.execute("ROLLBACK")
    print("Recovery failed; keep writers stopped and investigate privately. Any backup file may be incomplete unless verification finished.", file=sys.stderr)
    raise
finally:
    if backup is not None:
        backup.close()
    if db is not None:
        db.close()
PY
```

The helper opens the existing file with SQLite `mode=rw`, checks the approved-v2 contract, migration version 1 and database integrity, creates a unique sibling backup through SQLite's backup API, verifies that backup, and performs a guarded `BEGIN IMMEDIATE` update. Password changes and session revocation commit together; failures before commit roll back. It never prints the password or password hash. UTC RFC3339 timestamps use the same format family as the backend's `timestamp` helper. Protect the backup and its parent directory as private data; backups contain academic records and password hashes and must not enter Git or be copied to an unapproved location.

Missing, inactive, or non-admin accounts are rejected without account changes. If recovery fails, keep writers stopped and investigate the error privately. A backup file left by a failed run may be incomplete; do not treat it as a verified restore point. Never use an online hash generator or put passwords in command arguments.

## After recovery

1. Confirm that the backup path printed by the helper exists and is protected before leaving the maintenance session. Keep it until the recovery has been verified under the normal retention policy.
2. Start the service and workers through the normal supervisor. A restart can finalize overdue quiz attempts during startup, so keep the maintenance window short and account for that normal behavior.
3. From a private HTTPS session, sign in with the new password and check the account identity, admin role, and representative class and student records. Existing sessions for that admin should be rejected because `token_version` changed and the sessions were revoked.
4. Do not restore the backup blindly after writers resume. A restore must use a separately approved maintenance window and a fresh consistency check; never replace only the live main database while WAL/SHM files or writers are present.

Do not use bootstrap variables to reset a populated database. Do not seed, delete, recreate, or deactivate the account, change its role, rotate the JWT secret, or edit contract/version markers to bypass compatibility checks. These actions can cause data loss or invalidate more users than the intended recovery.

The managed-user API forbids admin targets; it cannot recover this account. Bootstrap only creates an admin when `users` is empty. This guide and the relevant source were reviewed as documentation only; the prerequisite check and recovery heredoc were not executed. Developer verification is still needed on an isolated approved-v2 fixture, including failure rollback, backup integrity, bcrypt login compatibility, and rejection of old sessions, before operational use.
