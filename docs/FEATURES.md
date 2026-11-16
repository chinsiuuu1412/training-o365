# Feature status — approved-v2

2026-11-15: backend MVP locally implemented; docs reconciled to actual handlers/schema. **Not end-to-end frontend completion.** [Approved workflow](new-approved/user-workflow-guideline.md) governs scope; [API definitions](API_DEFINITIONS.md) contains complete 94-route contract, replacing historical 83-route design. Prefix `/api/v1` unchanged; workflow/schema breaking. Existing `frontend/` and old integration tests remain incompatible, untouched.

## Backend matrix

| Domain | Current behavior | Limits / deferred |
|---|---|---|
| Auth / accounts | Local email/password; DB-backed JWT cookie, CSRF/Origin/rate limits, revoke on relevant credential/status changes; first Admin bootstrap; Admin manages Student/Manager | No Admin CRUD/role changes, public signup, SSO, self-service reset or email sending |
| Student profile | 9-digit MSSV string (`^[0-9]{9}$`, 4-digit enrollment year + 5-digit student ID, e.g. `202512345`) unique among Students; required school_or_institute, university_class, VN mobile and HUST email; optional gender; staff profile null | No self-edit profile |
| Classes | Unique code, capacity, Manager, two thresholds, date-only end_date with next Vietnam midnight exclusive expiry; one-time fixed positive total_sessions; confirmed reasoned reassignment | No archive/unarchive; expired class writes blocked; Manager suspension retains assignment |
| Discovery / enrollment | `/student/discover/classes`, preview/search name/code/Manager; Student request/cancel; current Manager approve/decline; capacity transaction; 10-minute cooldown, changed reason, three lifetime pair declines | No invitation/self-leave workflow. New approval after removal creates separate cycle; no inherited results/grants |
| Schedules | Fixed session numbers; Manager draft/save/submit; Admin approve/reject with reason; approved times preserved during pending/rejection | Started/ended approved schedule immutable; no Teacher-confirm/direct-edit/overlap promise |
| Attendance | Approved `[start,end)` code window; unique cycle/session credit; three durable wrong tries; Manager authoritative true/false override after start with audit/reason | Admin read-only; no photo/Quiz prerequisite/video credit; absence autoapproved/no credit/Manager notice |
| Quiz authoring | Test/Assignment, single-choice/equal weight, draft/preview/publish; open/deadline/duration/pass checks; default caps 1/10, Assignment custom positive cap | Freeze full PUT after any attempt; no delete/unpublish/metadata/multi-select/grade-edit routes |
| Runner / recovery | Revisioned full-answer autosave; submit saved revision only; continuous clock; Test exact 2/3 manual-submit rule; cutoff auto-grades server-saved answers | No offline pause/grace/telemetry zero. Student questions never expose correctness; review null |
| Retry / retake | Start/submit UUID keys permanently cycle-bound, auth before replay; start returns current state. Single/bulk reasoned grants target current enrollment IDs with strictly later future deadlines, atomic notices | Active cutoff unchanged; Assignment grant 1..10; no Student retake-request workflow or general write replay guarantee |
| Progress / Completed | Attendance/fixed total and distinct passed/all published Quizzes; zeros yield 0; best score retained; unrounded thresholds; all required approved sessions ended; dynamic reasons | No average/video credit, certificate/seal/exception workflow. Old Student cycles summary-only; staff authorized GET history |
| Dashboard / agenda | Shared progress source, counts, active-only agenda and Student in-progress recovery; own historical cycle summaries | No `/student/timetable` or class dashboard endpoint; list/dashboard scaling not certified |
| Inbox | Persisted in-app notices; Admin to active Student/Manager; Manager to active enrolled Students in unexpired assignments; explicit dedup IDs/atomic validation; private detail/read/unread | No SMTP/outbox/delivery claim, sent-box, Student compose or Manager-to-Admin manual compose |
| Library | HTTPS Document/Video links general/same-class session; optional expiry; staff removal reason/audit, Admin notifies Manager | YouTube Video exemption only material expiry, never class/enrollment/removal. No uploads/R2/photos/signed URLs/playback telemetry/cleanup |

## Route reconciliation

| Role scope | Routes |
|---|---:|
| Shared auth/inbox | 7 |
| Admin | 29 |
| Manager (`class_manager`) | 33 |
| Student | 25 |
| **Total** | **94** |

Count independently confirmed by existing `TestV2RouteSurfaceAndStrictBoundaries`; inventory derived from source registrations/loops, not checkpoint count alone. DTOs, nulls, raw numeric flags and status codes in [API definitions](API_DEFINITIONS.md).

## Baseline / operational safety

New embedded `001_initial.sql`, contract `approved-v2`, migration version 1. Nonempty legacy DB read-only checked and rejected, not upgraded or silently overwritten. **Do not delete/reset old DB; use separately approved migration or separate new synthetic DB path.** No academic purge or old-data migration delivered. See [setup](DEPLOYMENT.md).

## Verification provenance

- **Docs-phase executed:** offline `go test ./internal/app -run '^TestV2RouteSurfaceAndStrictBoundaries$' -count=1 -v`: pass, app 0.707s, logged 94. Source/document route, shape/DTO/schema/error/config/link comparisons recorded in [task-state](task-state.md).
- **Prior backend-agent results, not rerun by docs task:** `go test ./... -count=1` passed (app 17.284s, config 0.623s, DB 1.293s); `go vet ./...`, `go build ./cmd/...` passed; `go mod verify`: all modules verified. Focused suites cover scope/revocation/cycles/capacity/schedule/attendance/Quiz cutoffs/recovery/grants/progress/library/inbox/persistence/failure paths.
- Race command failed because `-race requires cgo`; ordinary concurrent transactional tests passed, not race certification. No target-hardware 200 req/s, Linux race, live-service, deployment or production-data verification.
- Historical frontend slice was browser-tested against prior backend, not current contract. No frontend suite/browser run in docs phase; no v2 UI/accessibility/runtime completeness claim.

## Next action

Independent documentation review, then separate approval for frontend v2 route/DTO/workflow/test-fixture adaptation. Preserve [design tokens](DESIGN.md). Fresh synthetic v2 DB only until real-data migration explicitly approved. Later validate Linux race, target hardware and browser/accessibility behavior without production data.
