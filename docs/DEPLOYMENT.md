# Operator setup / deployment boundaries — approved-v2

Instructions only, not executed deployment. Backend locally tested; frontend remains legacy/incompatible. **Do not deploy current frontend with v2 as a working LMS.** [API contract](API_DEFINITIONS.md) has 94 routes under unchanged `/api/v1`; workflow/schema breaking. No live-service, performance or production-data certification.

## 1. Database safety first

Fresh baseline `backend/internal/db/001_initial.sql` creates `backend_contract=approved-v2` and migration version 1. `cmd/migrate`, `cmd/seed`, and `cmd/server` use guarded DB open. Nonempty existing file is checked read-only before WAL/schema mutations; incompatible files fail:

```text
incompatible database: approved-v2 clean baseline required; legacy databases are not migrated; use a separate new database path
```

**Never delete, reset, overwrite, or edit version/contract markers on an old database to bypass this error.** Preserve the original. Real-data conversion requires a separately approved migration, backups, field/cycle mapping and isolated restore rehearsal. For synthetic development, choose a separate previously unused DB path. No v1-to-v2 migration or destructive down migration is delivered. Matching markers/version are not a complete schema-drift check.

Use local filesystem with SQLite locks, one API process per DB. No NFS/SMB, multi-host shared writer or replicas. Protect DB, WAL/SHM files, parent directories, configuration and backups against other users. WAL backup needs SQLite backup API/CLI `.backup` or a consistent snapshot after all processes stop; copying only an active main DB is unsafe. No backup/restore/deletion run by this documentation task.

For the controlled admin password recovery procedure, including an exclusive backup and session revocation, see [RECOVERY.md](RECOVERY.md).

## 2. Supported config

All commands below run from `backend/`. CLI loads `.env` from working directory; process env wins, no interpolation, optional surrounding quotes removed. Missing `.env` accepted. Template `backend/.env.example` is reference, not valid secrets.

| Variable | Behavior |
|---|---|
| `HTTP_ADDR` | Default `127.0.0.1:8080`; valid host:port. Server speaks HTTP; TLS terminates trusted proxy. |
| `DB_PATH` | Default `data/lms.db`; file path, not `:memory:`. Select separate new synthetic path explicitly. |
| `SITE_ORIGIN` | Required exact browser origin, HTTPS, no path/trailing slash/query/fragment/credentials. HTTP permitted only localhost/127.0.0.1. |
| `JWT_SECRET` | Required random secret >=32 bytes; short/placeholder values rejected. Keep out of source/chat/logs. Rotation invalidates all existing cookies/CSRF. |
| `SESSION_TTL_SECONDS` | Default 28800; integer 300..86400. |
| `TRUSTED_PROXY_CIDRS` | Default empty trusts none. Optional comma-separated narrow CIDRs, rejects /0 and IPv4-mapped IPv6. Trust only actual immediate proxy. |
| `ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_PASSWORD` | Both or neither. Valid mailbox/password 12–72 UTF-8 bytes. Server bootstrap only when users table empty; no password reset on nonempty DB. Remove both after successful first bootstrap. |
| `SEED_ADMIN_PASSWORD`, `SEED_MANAGER_PASSWORD`, `SEED_STUDENT_PASSWORD` | Only seed CLI reads these; each 12–72 UTF-8 bytes. Synthetic credentials only, no automatic delivery. |

Reader pool fixed default eight, not env-configurable. No SMTP, R2/storage, YouTube API, cleanup/retention env or cleanup command in current backend. In-app announcement creation does not require mail configuration. No command flags or production database reset procedure.

## 3. Local fresh synthetic setup — choose one initialization path

Do not run against existing/real data. Install dependencies only through separately approved normal project process; commands below assume matching Go/dependencies already available. Module targets Go 1.24.0; use maintained compatible toolchain. No Node install needed for backend.

1. Create a private local `backend/.env` using `backend/.env.example` as reference. Set `DB_PATH` to a new synthetic path, such as `data/approved-v2-local.db`; confirm it does not already hold data. Set browser `SITE_ORIGIN` to `http://localhost:5173` for same-origin Vite proxy development. Set a generated JWT secret privately; never use committed placeholders.
2. Choose **seeded demo** or **bootstrap-only**, not both on the same populated DB:
   - **Seeded demo:** supply three SEED passwords, leave both ADMIN_INITIAL values absent. `go run ./cmd/seed` opens/initializes fresh v2 schema and requires zero users. It inserts 1 Admin (`admin@example.test`), 3 Managers (`manager1@example.test` through `manager3@example.test`), 3 classes and 100 synthetic Students (`student001@sis.hust.edu.vn` through `student100@sis.hust.edu.vn`), required profiles, approved cycle-1 enrollments. Classes have total_sessions 3, capacity 40 and end_date one Vietnam calendar month from seed time. No session/Quiz/material/announcement fixtures are seeded. Rerun rejects nonempty users; not upsert/reset. Optionally initialize schema first with `go run ./cmd/migrate`; still no users.
   - **Bootstrap-only:** supply both ADMIN_INITIAL values and no seed credentials. Optionally `go run ./cmd/migrate` creates schema only. First `go run ./cmd/server` creates one Admin if users empty; without both bootstrap values empty-user startup fails. No public Admin creation route.
3. Start `go run ./cmd/server` only for approved local work. It opens compatible DB, bootstraps if needed, drains overdue saved attempts, then starts finalizer and HTTP server. No `/health` endpoint; authenticated `/api/v1/auth/me` is session check, not independent health API.
4. After verified bootstrap, remove both ADMIN_INITIAL values; after seed remove SEED values from runtime config. Credentials are delivered manually. Stopping server does not reset DB. Never print env secrets into logs/chat.

Current frontend is not an API smoke test for these steps: its route/DTO/test-fixture adaptation remains pending. Same-origin local proxy preserves Origin; keep browser host consistent (`localhost` versus `127.0.0.1`). Secure cookies stay enabled; verify target browser behavior locally instead of weakening cookie flags.

## 4. Real repository verification commands

Run from `backend/` on local/synthetic data only:

```sh
go test ./... -count=1
go vet ./...
go build ./cmd/...
go mod verify
```

Existing docs-phase focused check:

```sh
go test ./internal/app -run '^TestV2RouteSurfaceAndStrictBoundaries$' -count=1 -v
```

Offline verification can set `GOPROXY=off`, `GOSUMDB=off`, `GOTOOLCHAIN=local` process-locally when dependencies already cached. No dependency downloads/install done by docs task. Runtime driver pure Go; race detector needs supported CGO toolchain/compiler on separate validation host:

```sh
CGO_ENABLED=1 go test -race ./...
```

Last command is **suggestion, not executed successful evidence**. Implementation-agent race attempt failed `go: -race requires cgo; enable cgo by setting CGO_ENABLED=1`; Windows environment CGO disabled/no C compiler. Prior full-test/vet/build/module results and docs-phase focused test distinguished in [task-state](task-state.md). No load benchmark claimed.

## 5. Hosting topology — not rollout approval

Runtime auth supports **same-origin** SPA and `/api/v1` reverse proxy. Keep API bound loopback, terminate HTTPS at approved proxy, serve adapted SPA under same origin, preserve Origin and cookies. Configure exact SITE_ORIGIN. Do not expose port 8080 publicly or set wildcard CORS. Deploy/reconfigure services only with separate authorization.

Trusted client-IP extraction supports one valid proxy-overwritten `X-Forwarded-For` only when socket peer falls in TRUSTED_PROXY_CIDRS. Configure immediate proxy to discard client-supplied value and write one IP (not append chain). Malformed/chained values fall back to peer; `CF-Connecting-IP` ignored. Empty trust list safe default, but proxy/NAT clients share login bucket. Trusting loopback also trusts local processes; host isolation matters.

Earlier Cloudflare Pages plus separate Tunnel API-subdomain target is **deferred/blocked**, not current setup recipe: no credentialed CORS/OPTIONS handler or Cloudflare client-IP design. Existing frontend VITE_API_ORIGIN support does not add backend CORS. No gateway/domain/service changes requested or performed.

Before any separately approved rollout: adapt frontend/tests, use fresh synthetic acceptance fixtures, approve legacy-data migration if needed, rehearse backup/restore/rollback, validate Linux race and target 1vCPU/1–2GB load, and verify browser/accessibility/session/cutoff behavior. Binary rollback cannot make legacy schema compatible; never point old/new binaries at mismatched data.

## 6. Remaining operational limits

Worker grades saved answers every second (100 per batch); startup drains due attempts before serving. Auth revocation/class expiry blocks new Student content/answers but does not prevent saved historical finalization. SIGTERM/interrupt triggers graceful shutdown (15s). Request context 12s; HTTP read-header/read/write/idle timeouts 5/10/15/60s, max headers 16 KiB. These source settings do not establish production durability or throughput guarantees.

No academic deletion/retention job. Materials are external HTTPS links; LMS cannot revoke links already learned or control provider sharing. No email delivery, media byte validation, storage cleanup, performance/race/live-service certification. No production services/data touched.
