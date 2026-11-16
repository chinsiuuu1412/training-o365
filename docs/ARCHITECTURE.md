# System architecture — approved-v2

Source-grounded backend status, 2026-11-15. [Approved workflow](new-approved/user-workflow-guideline.md) controls product scope; [API definitions](API_DEFINITIONS.md) documents current **94-route** implementation. Legacy 83-route/schema specification is superseded, not an additional contract. `/api/v1` prefix retained despite breaking workflow/schema v2. Existing frontend remains legacy and incompatible; no end-to-end v2 completion claim.

## 1. Stack / boundaries

- Backend: Go `net/http` ServeMux, Go 1.24.0 module minimum; `modernc.org/sqlite v1.39.1`, `golang.org/x/crypto v0.43.0` bcrypt. No chi, ORM, media SDK or mail service.
- Frontend: separate React 18 / TypeScript / Vite / Tailwind application. Historical vertical slice only; route catalog, DTO consumers and integration fixtures require separately approved adaptation. [Frontend handoff](FRONTEND_SURFACE_CONTRACT.md).
- SQLite file on local lock-capable filesystem, one API process. WAL; single writer connection with `_txlock=immediate`; eight read-only pooled connections by default. Pragmas: foreign_keys=1, busy_timeout=10000, synchronous=NORMAL, cache_size=-4000 per connection. No shared network filesystem/replicas.
- Hardware/load goals: 1 vCPU, 1–2 GB RAM, approximately 200 requests/s. Not verified capacity. Data integrity takes priority over speed. Lists/dashboard aggregation still load whole result sets before pagination; no SQL-pagination/cache/load-performance certification.
- External material links only; backend neither uploads bytes nor fetches provider metadata. No SMTP, storage registry, media telemetry or cleanup worker/config/CLI. In-app notifications persist transactionally.

## 2. Source layout

| Path | Responsibility |
|---|---|
| `backend/cmd/server` | Dotenv/config, DB open, first-Admin bootstrap, startup overdue scan, finalizer worker, HTTP server/graceful shutdown |
| `backend/cmd/migrate` | Fresh baseline initialization / compatible-v2 open; not legacy migration |
| `backend/cmd/seed` | Pristine synthetic v2 dataset only |
| `backend/internal/config` | Validated env, non-overwriting literal `.env` parser |
| `backend/internal/db` | Embedded `001_initial.sql`, contract/version guard, WAL/pools/transactions |
| `backend/internal/app/core.go`, `auth.go`, `proxy.go` | Routing/envelopes/validation/scope, session/CSRF/credentials, narrow proxy trust |
| app domain files | Accounts, classes, enrollments, schedules, attendance, Quizzes/attempts, progress/agenda, materials, inbox |
| `backend/internal/app/workers.go` | Due-attempt finalization only |
| `frontend/` | Unchanged legacy UI/tests, not current API authority |

## 3. Schema / clean-baseline safety

`001_initial.sql` is **new approved-v2 baseline**, not additive migration over old academic data. It creates `backend_contract(id=1,name='approved-v2')`; migration metadata version is 1. Nonempty existing file is probed read-only before WAL/schema mutations; missing/wrong contract or migration max version rejects with:

```text
incompatible database: approved-v2 clean baseline required; legacy databases are not migrated; use a separate new database path
```

**Do not delete, reset, overwrite, or relabel an old DB to make it open.** Preserve it. Real legacy-data conversion needs separate approval, mapping, backup and isolated rehearsal. Synthetic development uses a separate fresh DB path. Opening matching marker/version is not full schema-drift validation. No down migration or old-data migration exists. [Operator setup](DEPLOYMENT.md).

| Tables | Model / constraints |
|---|---|
| `users`, `user_sessions` | Three roles; email NOCASE unique; Student MSSV partial unique, profile constraints; token version and revocation rows |
| `classes` | Unique NOCASE code, capacity >0, nullable fixed positive total_sessions, thresholds 0..100, date-only end_date and computed expires_at |
| `enrollment_requests`, `class_enrollments` | One pending request per Student/class; one current enrolled cycle; unique class/Student/cycle and request; removal preserves cycle |
| `class_sessions`, `schedule_proposals` | Unique fixed session_number per class; one draft/pending proposal per session; approved schedule independent of pending/rejected replacement |
| `attendance`, `absences` | Unique enrollment/session pair; attended/overridden flags, durable wrong_count 0..3; absence never credit |
| `quizzes`, `quiz_questions`, `quiz_options` | Test/Assignment, finite caps, single-choice/equal weights validated by handler; frozen after first attempt |
| `quiz_attempts` | Cycle-bound, one in-progress per Quiz/cycle, revisioned full answer snapshot, stored deadline/cutoff, nullable results until submitted |
| `quiz_retake_grants`, `idempotency_keys` | Cycle-bound grants; user/method/path/key unique with fingerprint and durable cycle binding |
| `announcements`, `announcement_recipients` | Automated/manual notices, recipient-private numeric read flags, unique announcement/user |
| `materials`, `audit_log` | External link metadata/soft-removal reason; actor/before/after/reason/time audit |

DB stores academic history rather than deleting old rows to reset progress. Required cross-class/cycle checks occur in handlers as well as uniqueness/foreign-key constraints; schema alone does not prove all authorization.

## 4. Request / transaction flow

1. HTTP handler sets JSON/no-store/nosniff headers and acquires bounded in-flight slot (200), otherwise 503.
2. Route applies 12-second request context and 1 MiB body cap. For non-GET, enforce exact Origin and decode complete JSON before writer acquisition.
3. Authenticate/recheck role and class relationship/expiry; enforce CSRF and per-user write bucket. Password preflight uses readers and two bcrypt slots, never holds writer during hashing.
4. Mutating and finalization-capable read routes acquire immediate writer transaction. Set one authoritative transaction clock, recheck authorization/current credentials, finalize due Quizzes when applicable.
5. Request-action savepoint isolates domain mutations. Rejected action rolls back without losing already-due grading. Wrong attendance code deliberately returns domain error **after commit**, preserving consumed try.
6. Commit before response; 201 only registered creation routes, otherwise 200. Unexpected panic/DB failure maps 500; no generic safe retry guarantee.

Some GETs mutate through overdue finalization: dashboards/progress, enrollment roster/history, Quiz lists/attempt history/recovery. They still use GET auth conventions, not CSRF headers. Finalizer does not depend on current Student access and preserves old-cycle results.

## 5. Security / role model

Local email/password; bcrypt cost 10, 12–72 UTF-8 bytes for new passwords. Student email `@sis.hust.edu.vn`; 9-digit MSSV string (`^[0-9]{9}$`, 4-digit enrollment year + 5-digit student ID, e.g. `202512345`), school_or_institute/university_class/VN mobile required, gender optional. No SSO/domain-verification claim. Admin bootstrap only with empty users table. Admin manages Student/Manager only; no role mutation or Admin account management. Suspend Manager with assignments retained; reassign separately.

HS256 JWT in host-only `lms_session` cookie (`HttpOnly; Secure; SameSite=Lax; Path=/`), backed by current active user, token_version and unrevoked DB session. Default session TTL 8h. Password/reset and email changes revoke sessions; actual status change revokes sessions. Logout revokes current session. CSRF is signed session-bound token from login/me; exact Origin required on every non-GET including login. No new credentialed CORS or OPTIONS support; same-origin browser/API proxy only.

Manager authority always current class assignment, not original author. Student content needs current enrollment and active class; old/expired cycles expose own summaries only. Admin/assigned Manager retain GET history, cannot mutate expired classes. Admin results read-only; Manager attendance override only, no Quiz grade edits. Student questions never include correct options; review always null.

Login bucket 5/min burst 5 per client IP; authenticated writes 1/s burst 10 per user. Trusted proxy extraction accepts one proxy-overwritten valid `X-Forwarded-For` from configured immediate-peer CIDR only. Chained/malformed values fall back to peer; `CF-Connecting-IP` ignored. Empty trust list trusts no forwarding. Host/NAT shared limits remain operational consideration.

## 6. Domain invariants

- **Class time**: end_date expires at next Vietnam midnight, exclusive; date-only, no start_date/archive toggle. Fixed positive total_sessions set once. Reassignment requires reason/true confirmation, preserves records and updates authority immediately. Capacity cannot fall below enrolled count; pending requests do not reserve seats.
- **Enrollment**: Student request/cancel, Manager approve/decline. Ten-minute decline cooldown, changed Student reason, three lifetime pair declines. New approval after removal creates new cycle/ID, zero inherited credit/grants/attempt allowance. Explicit cycle targets reject stale actions.
- **Schedule**: Manager creates fixed session, saves/submits draft; Admin approve/reject with reject reason. Approved times remain until new approval. Started/ended approved session immutable; no Teacher-confirm step.
- **Attendance**: code valid `[start,end)`, three durable wrong tries, unique credit. Manager authoritative override after start (including ended session) with reason/before/after audit; later code cannot reverse override. Approved absence notifies Manager and gives no credit.
- **Quiz**: single-choice/equal weight; Test default one attempt and manual submit after exact 2/3 duration; Assignment default ten, custom positive cap, submit anytime. Both continuous clock, autosave/recovery, fixed start cutoff `min(start+duration,effective deadline)`. Draft revision must be saved before submit; submit rejects new answers. Due saved answers finalize at cutoff with no grace, including revoked access. Worker tick 1s, batch 100; startup drains due work. No tab/offline penalty scoring.
- **Grants/retry**: explicit deduped enrolled-cycle IDs, reason, future deadline strictly greater than each current effective deadline; atomic. Test extra positive/default 1, Assignment 1..10. Student/Admin notifications; active cutoff unchanged. Start/submit UUID keys permanently cycle-bound; start replay rebuilds current state, no stale runner snapshot. Authorization precedes replay.
- **Progress**: credited approved sessions/fixed sessions; distinct passed/all published Quizzes; denominators zero give 0. No average/video credit. Completed requires every fixed required approved session ended plus both unrounded thresholds. Dynamic reasons/recalculation; no certificate/seal dependency.
- **Inbox/library**: explicit validated recipient IDs; Admin to active Student/Manager, Manager to active enrolled Students in active assigned classes. Read/unread private. HTTPS Document/Video links general or same-class session; optional material expiry, YouTube Video exemption does not bypass class/enrollment/removal. Removal reason for both staff roles, Admin notifies Manager. Known external link cannot be revoked.

## 7. Delivery evidence / limits

Implementation agent recorded local full tests, vet/build and module verification passing; exact commands/results in [task state](task-state.md). Docs phase reran existing route-boundary test: **94 routes**, pass. No old frontend suite run, no frontend edits or runtime v2 UI claim. Race detector unavailable (`-race requires cgo`); ordinary concurrent transaction tests are not race certification. No target-hardware performance, Linux race, external-service, deployment or production-data validation.

Deferred: frontend adaptation/public workflow, invitation/leave/archive/retention, uploads/photos/playback credit, SMTP/self-service reset, multi-select/telemetry/answer review, Quiz result mutation, certificate workflows. Preserve [design tokens](DESIGN.md); do not resurrect old domain rules from historical design examples.
