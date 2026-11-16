# Frontend v2 (`frontend-mock-v2/`) final role source-review fixes — 2026-11-15

Resolved all 6 role source-review findings and explicit `<= 5 min` manager results freshness in `frontend-mock-v2/` without modifying `backend/` or legacy `frontend/`.

1. **Class manager name DTO (`ClassItem.manager?: User`)**:
   - Updated `src/api/types.ts` (`ClassItem.manager?: User`), added `getClassManagerName` in `src/lib/format.ts`, and updated `StudentClassesPage.tsx`, `StudentClassDetailPage.tsx`, `AdminClassesPage.tsx`, and `AdminClassDetailPage.tsx` so real `manager?.full_name` renders with no `#id` fallback when a name is supplied.
2. **Enrollment request student name (`full_name`, `student_number`)**:
   - Updated `src/api/types.ts` (`EnrollmentRequest.full_name?: string`, `student_number?: string | null`), added `getEnrollmentRequestStudentName` in `src/lib/format.ts`, and updated `ManagerEnrollmentsTab.tsx` (pending/history/approve dialog/notices) and `AdminClassDetailPage.tsx`.
3. **Student active Test/Assignment resume when `used >= allowed`**:
   - Created `src/features/student/studentClassQuizHelpers.ts` (`resolveStudentQuizAction`, `fetchActiveAttemptsForQuizzes` querying `getStudentActiveAttempt` only when `used_attempts > 0`, treating 404 as `null`, rethrowing 401/other errors).
   - Updated `StudentClassDetailPage.tsx` to separate enabled `"Tiếp tục làm bài"` (navigating directly with exact `attemptId` within `effective_cutoff_at` even when `used >= allowed`) from `"Làm bài"` (`ConfirmDialog` start flow), with per-`classId` reset and stale guards.
4. **Admin edit class with suspended assigned Manager**:
   - Created `src/features/admin/adminClassHelpers.ts` (`getSelectableManagers`) and updated `AdminClassesPage.tsx` to preserve the currently assigned suspended manager (`— Đã tạm khóa`) when editing while keeping active-only options for new assignments.
5. **AdminClassDetailPage 401 handling, stale guards, & Vietnamese status labels**:
   - Added `isSessionExpiredError` (`onSessionExpired`) and class/selection stale guards in `handleViewSession` / `handleViewQuiz`; added `enrollmentRequestStatusLabel`, `scheduleProposalStatusLabel`, and `attemptStatusLabel` in `src/lib/format.ts`.
6. **StudentClassDetailPage materials filter isolation**:
   - Split `loadMaterials` from `loadAll` with 250ms `debouncedMatSearch` and `materialsReqIdRef` / `activeClassIdRef` stale guards so filter changes only reload `listStudentMaterials`.
7. **Manager results freshness (`<= 5 min`)**:
   - Added 120s visible-tab polling in `ManagerClassDetailPage.tsx` (`load(true)` with `loadInFlightRef`) and 90s visible-tab polling for open `resultsState` in `ManagerQuizzesTab.tsx`, preserving loaded data/errors and selection/form state.

## Executed verification

From `frontend-mock-v2/`:

- `npm run typecheck`: PASS, exit 0.
- `npm run build`: PASS, exit 0 (`dist/assets/index-CYmU5sL-.js`).
- `npm test`: PASS, exit 0 (**24/24** passed: 5 new tests in `tests/contract-fixes.test.ts`, 18 existing unit tests, and 1 expanded `tests/integration-go.test.ts` asserting real Go DTOs for `manager.full_name`, `EnrollmentRequest.full_name`/`student_number`, and 1-attempt Test active recovery).
- Bounded headless Chrome CDP check (`1440×900`) against `vite` + fresh temporary Go v2 backend: verified `Quản lý: Quản lý Kiểm Thử` (no `#id` fallback) and enabled `"Tiếp tục làm bài"` button resuming an active 1-attempt Test directly into `StudentQuizRunnerPage` (`1+1=?`).

**Remaining limits / next action**: Admin suspended-manager edit UI, Manager 90s/120s live polling wait, and Student materials keystroke network-tab inspection were verified via unit/integration tests and code inspection rather than interactive browser clicks; next: commit reviewed `frontend-mock-v2/` and docs changes.

---

# Frontend v2 (`frontend-mock-v2/`) authenticated browser verification — 2026-11-15

Executed batched authenticated headless Chrome CDP verification against `vite` + fresh temporary Go v2 backend (`o365-server.exe` in isolated temp dir/DB, no source edits required).

- **Verified UI flows**:
  - **Admin** (`1440×900`, `390×844`): UI login on `PublicIntroLogin`, `AdminDashboardPage`, `AdminUsersPage` (`ConfirmDialog` keyboard `Escape` close check), `AdminSchedulesPage`, `AdminClassesPage`, `AdminClassDetailPage`, UI logout.
  - **Class Manager** (`1440×900`, `390×844`): UI login, `ManagerDashboardPage`, `ManagerClassesPage`, `ManagerClassDetailPage` (sessions, quizzes, materials tabs cleanly loaded after pagination fix), UI logout.
  - **Student** (`1440×900`, `390×844`, `320×640`): UI login, `StudentDashboardPage`, `StudentClassesPage` (discovery & enrollment request submission), `StudentClassDetailPage` (progress bars & quizzes tab), `StudentQuizRunnerPage` (option selection, autosave `"Đã lưu"`, `ConfirmDialog` `Escape` + submit, result `"Kết quả bài làm"` / `"Đạt"`, attempt history `"Lịch sử lượt làm"`), `AnnouncementsPage` (read/unread toggle).
- **Results**: 0 runtime exceptions, 0 unexpected HTTP >= 400 errors (only expected initial `401 /api/v1/auth/me` and `404 /active-attempt`), 0 horizontal overflow (`scrollWidth <= innerWidth`) at `1440×900`, `390×844`, and `320×640`. Screenshots saved in temp session dir; all helper processes terminated.
- **Remaining limits**: Live browser `409 draft_revision_conflict` / cutoff expiry UI transitions, Manager `429` burst handling, full WCAG 2.2 AA assistive-tech audit, and cross-OS visual inspection remain unverified in browser (controller/API paths covered by `npm test` 19/19).

---

# Frontend v2 (`frontend-mock-v2/`) specialist review fixes — 2026-11-15

Resolved all 6 confirmed review findings (5 P1, 1 P2) in `frontend-mock-v2/` without modifying `backend/`, legacy `frontend/`, or root `.gitignore`.

1. **P1 — Out-of-range `page_size` & full-list pagination**:
   - Added `fetchAllPages<T>` in `frontend-mock-v2/src/api/services.ts` clamping `page_size` to `1..100` and iterating through all pages.
   - Created `frontend-mock-v2/src/features/manager/managerLoaders.ts` (`loadManagerClassDetailData`, `loadManagerQuizAttemptsAll`) and updated `ManagerClassDetailPage.tsx` and `ManagerQuizzesTab.tsx` (replacing `page_size` 200/500 with paginated `page_size: 100` fetches).
   - Updated `AdminClassDetailPage.tsx`, `AdminClassesPage.tsx`, and `StudentClassDetailPage.tsx` to use `fetchAllPages` for full-list endpoints so records >100 are not truncated.
2. **P1 — `ManagerQuizEditor` stale state & `openEdit` race**:
   - Keyed `<ManagerQuizEditor>` in `ManagerQuizzesTab.tsx` by authoritative quiz identity (`edit-${quiz.id}` / `create`), added `useEffect` reset in `ManagerQuizEditor.tsx`, and guarded `openEdit`/`openPreview`/`openResults`/`openCreate`/`onCancel`/`onSaved` with `panelRequestIdRef`.
3. **P1 — `StudentQuizRunnerPage` route isolation & async lifecycle guard**:
   - Keyed `<StudentQuizRunnerPage>` in `src/App.tsx` by `${route.classId}-${route.quizId}-${route.attemptId ?? "active"}`.
   - Extracted `QuizRunnerController` (`src/features/student/quizRunnerController.ts`) with monotonic `generation` + `disposed` lifecycle guards on `loadInitial`, `refreshKnownAttemptStatus`, `flushAutosave`, and `confirmSubmit` so stale loads/saves from prior routes or unmounted instances cannot mutate state or fire new saves.
4. **P1 — `draft_revision_conflict` (autosave & submit) local preservation**:
   - On `409 draft_revision_conflict` during draft save or submit, `QuizRunnerController` refetches the exact attempt without blindly overwriting local `answersMap` or clearing `dirty`, blocks further autosave until the user explicitly chooses in the conflict UI (`Giữ đáp án của tôi và lưu lại` or `Tải bản lưu mới nhất trên máy chủ`), and preserves edits made while refetching.
5. **P1 — Uncertain submit & cutoff recovery**:
   - Once any attempt ID is known (via route param, `active-attempt`, or `start`), `QuizRunnerController` binds `knownAttemptId` and `refreshKnownAttemptStatus()` calls `GET /quiz-attempts/{attemptId}` only — never `active-attempt` or `POST /start`.
   - When cutoff is reached (`cutoffRemaining === 0`), answer radio inputs are disabled/locked and `Tải kết quả` calls `refreshKnownAttemptStatus()`.
6. **P2 — Freeze quiz editing when attempts exist**:
   - Added `fetchQuizAttemptExistenceMap` in `managerLoaders.ts` using `listManagerQuizAttempts(..., { page: 1, page_size: 1 })` (`total > 0`).
   - `ManagerQuizzesTab.tsx` disables the edit button and shows a Vietnamese read-only explanation when attempts exist; `ManagerQuizEditor.tsx` also handles `409 quiz_frozen` on concurrent race via `onFrozen`.

## Executed verification

From `frontend-mock-v2/`:

- `npm run typecheck`: PASS, exit 0.
- `npm run build`: PASS, exit 0 (`dist/assets/index-B_5Hn_FC.js`, 67 modules transformed in 7.09s).
- `npm test`: PASS, exit 0 (**19/19** passed: `config.test.ts` 4, `client.test.ts` 3, `quiz-state.test.ts` 3, `manager-loaders.test.ts` 3, `quiz-runner-controller.test.ts` 5, `integration-go.test.ts` 1 against fresh temporary Go v2 backend).
- `grep` check across `frontend-mock-v2/src/`: 0 remaining `page_size` literals > 100.

**Remaining blocker / next action**: Authenticated interactive browser E2E across Student/Manager/Admin UI flows (including live Quiz Runner conflict/cutoff UI in browser) was not executed; API/controller behavior is verified via unit tests and `integration-go.test.ts`. Next: run authenticated browser E2E pass.

---

# Frontend v2 (`frontend-mock-v2/`) integration, fixes, tests & docs — 2026-11-15

Completed bounded integration fixes, unit + fresh local Go v2 backend tests, and documentation for `frontend-mock-v2/`. Legacy `frontend/`, `backend/`, and root `.gitignore` untouched.

- **Build & shared component fixes**:
  - `frontend-mock-v2/tsconfig.node.json`: added `"DOM"` to `lib` so `URL` in `vite.config.ts` compiles cleanly under `tsc -b`.
  - `frontend-mock-v2/src/components/ConfirmDialog.tsx`: added optional `children?: ReactNode` and `aria-describedby="confirm-dialog-description"` while keeping `description` and `destructive` consistent across all callers.
  - `frontend-mock-v2/src/features/admin/AdminClassDetailPage.tsx`: updated `ProgressBar` calls to pass `numerator`, `denominator`, `unitLabel`, and `threshold`; updated `ConfirmDialog` callers (`AdminClassDetailPage.tsx`, `AdminSchedulesPage.tsx`, `AdminUsersPage.tsx`) to use `description` and `destructive`.
- **Auth / logout / CSRF & Quiz state hardening**:
  - `frontend-mock-v2/src/api/services.ts` & `src/App.tsx` & `src/components/AppShell.tsx`: removed `finally` session/CSRF clearing on `logout()`; session and in-memory `X-CSRF-Token` are preserved on network/5xx errors (surfacing `logoutError` banner in `AppShell`) and cleared only on confirmed 200 logout or 401.
  - `frontend-mock-v2/src/api/services.ts`: normalized `listManagerEnrollments` and `listAdminEnrollments` to accept Go's flat enrollment DTO (`{ ...enrollment, student, progress }`) and produce `StaffEnrollmentRow`.
  - `frontend-mock-v2/src/features/student/StudentQuizRunnerPage.tsx`: reset `startIdempotencyKeyRef` / `submitIdempotencyRef` when `(classId, quizId, attemptId)` changes while keeping UUID keys stable across retries; wrapped 409/410 refetch (`getStudentAttempt`) in `try/catch` without blind retry.
- **Tests added (`frontend-mock-v2/tests/`)**:
  - `config.test.ts`: `resolvePublicApiConfig`, `buildApiUrl`, `Object.isFrozen`, `vite build` rejection of invalid `VITE_API_ORIGIN`, and static bundle check (no `window.__ENV__`).
  - `client.test.ts`: CSRF/Idempotency headers, `logout()` CSRF preservation on network error vs 401/200 clear, `429 Retry-After` parsing, `isUncertainOutcomeError`.
  - `quiz-state.test.ts`: exact 2/3 duration gate, cutoff clamping, deterministic sorted answer serialization.
  - `integration-go.test.ts`: launches temporary Go v2 backend (isolated SQLite DB, generated `JWT_SECRET`, synthetic accounts, cookie jar + exact `Origin`), exercises Admin, Manager, and Student lifecycles including enrollment, schedule approval, attendance 422/check-in/override, quiz start/draft/409 conflict refetch/submit (no questions/`review: null`), retake grant, material create/delete, inbox read/unread, and confirmed logout.
- **Docs**: added `docs/FRONTEND_V2.md`; updated `docs/FRONTEND_SURFACE_CONTRACT.md`, `docs/DECISIONS.md`, and `docs/task-state.md`.

## Executed verification

From `frontend-mock-v2/`:

- `npm run typecheck`: PASS, exit 0.
- `npm run build`: PASS, exit 0 (`dist/assets/index-*.js` built in 4.85s; re-verified after all code edits).
- `npm test`: PASS, exit 0 (**11/11** passed: 10 unit/build tests + 1 end-to-end Go v2 integration test).
- Headless Chrome CDP check (`1440×900` desktop, `390×844` mobile) on `vite` + temporary Go backend: `PublicIntroLogin` rendered `"CÂU LẠC BỘ o365 - HUST"` with 0 runtime exceptions, no horizontal overflow on desktop/mobile, and keyboard `Tab` focus progression.

**Limitation / next action**: Authenticated interactive browser E2E across Student/Manager/Admin UI screens and full WCAG 2.2 AA / cross-OS visual audit remain outstanding (API contracts verified via `integration-go.test.ts`). Next: independent review of `frontend-mock-v2/` and docs.

---

# HUST Student ID (`student_id` / MSSV) 9-digit rule update — 2026-11-15

Updated HUST Student ID (`student_id` / MSSV) validation, schema constraint, seed format, test fixtures, and documentation from `8–12 digits` to an exact 9-digit string (`^[0-9]{9}$`: 4-digit enrollment year + 5-digit student ID, e.g., `202512345`), preserving leading zeros and uniqueness among Students. `frontend/` untouched.

- `backend/internal/db/001_initial.sql`: updated `users` table `CHECK` constraint from `length(student_id) BETWEEN 8 AND 12` to `length(student_id)=9`.
- `backend/internal/app/accounts.go`: updated `studentNumber` regex from `^[0-9]{8,12}$` to `^[0-9]{9}$`.
- `backend/internal/app/seed.go`: updated seeded Student `student_id` to `fmt.Sprintf("2025%05d", i)` (9 digits).
- `backend/internal/app/app_test.go`, `backend/internal/app/v2_enrollment_test.go`, `backend/internal/app/v2_seed_test.go`: updated test helpers and assertions for 9-digit `student_id` (including leading-zero `"000012345"` and `400` rejection of 8-digit `"20251234"` and 10-digit `"2025123456"`).
- `docs/{API_DEFINITIONS,ARCHITECTURE,DECISIONS,FEATURES,FRONTEND_SURFACE_CONTRACT}.md`: updated MSSV rule and example payload (`"student_id":"202512345"`) to 9-digit string (`^[0-9]{9}$`, 4-digit enrollment year + 5-digit student ID).

## Executed verification

Commands from `backend/` with `$env:GOPROXY='off'; $env:GOSUMDB='off'; $env:GOTOOLCHAIN='local'`:

- `go test ./... -count=1`: exit 0 (`o365-lms/backend/internal/app` **19.789s**, `o365-lms/backend/internal/config` **0.561s**, `o365-lms/backend/internal/db` **1.292s**; `cmd/migrate`, `cmd/seed`, `cmd/server` `[no test files]`).
- `go vet ./...`: exit 0, no diagnostics.
- `go build ./cmd/...`: exit 0, no diagnostics.

No blockers. Next action: include 9-digit MSSV validation (`^[0-9]{9}$`) when adapting `frontend/` in its separately approved task.

---

# Reviewer P2 backend fixes — 2026-11-15

**Both findings resolved.** Approved Workflow 9 automatic result inbox notices restored; FK regression test now verifies actual enforcement. API/schema unchanged. `frontend/` and approved workflow untouched.

- `backend/internal/app/attempts.go`: conditional `in_progress` → `submitted` update uses `RowsAffected`; only first transition calls existing transactional `notify`. Recipient is attempt's stored Student, class comes from its Quiz, content contains original attempt/Quiz/enrollment IDs and score percentage only. No answer/key content or current-cycle lookup. Manual submit, request cutoff, worker and startup share this path.
- `backend/internal/app/v2_result_notifications_test.go`: manual submit, same/new-key retries, stale snapshot regrading, transaction rollback, private inbox access and exact safe content; startup/worker scan repetition after suspension, class expiry and removal/re-enrollment. Old/new cycles each receive exactly one correctly bound unread result notice.
- `backend/internal/db/db_test.go`: valid current-schema orphan class insert must fail specifically with `FOREIGN KEY constraint failed`; writer/reader must report `PRAGMA foreign_keys=1`. Same insert succeeds with FK disabled on pinned synthetic-test connection inside rolled-back transaction; enforcement restored before connection returns. No global environment mutation.

## Executed verification

Commands from `backend/`, with process-local `GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local`; no dependency installation.

- `go test ./internal/app ./internal/db -run '^(TestV2ResultNotification.*|TestWALImmediatePoolsMigrationAndRollback)$' -count=1 -v`: exit 0; app **2.352s**, DB **1.252s**; all focused cases passed.
- `go test ./... -count=1`: exit 0; app **17.874s**, config **0.531s**, DB **1.419s**; cmd packages no test files.
- `go vet ./...`: exit 0, no diagnostics. `go build ./cmd/...`: exit 0, no diagnostics.
- `gofmt` applied to three changed Go files. VS Code `problems` after edits: no errors in all three Go files.

Changed only three Go paths above plus `docs/task-state.md`. No agents, external/production/real DB/deployment operations or frontend edits. Tests use temporary synthetic fixtures. Race not rerun: known CGO limitation. No remaining blocker for these findings; next action: hand off fixes. Frontend compatibility, target-hardware load and production validation remain separate scope.

---

# Approved-v2 documentation handoff — 2026-11-15

**Current docs checkpoint.** Related backend/frontend documentation reconciled to completed approved-v2 backend. Backend code and `frontend/` unchanged; frontend remains legacy/incompatible, not v2 end-to-end complete. `/api/v1` unchanged but workflow/schema breaking. Earlier backend note “documentation deferred” below is historical and superseded by this phase. Approved workflow file unchanged.

## Completed documentation

- Replaced obsolete dominant 83-route/schema/media/SMTP instructions with current source-grounded docs. `API_DEFINITIONS.md`: full **94 routes** (shared 7, Admin 29, Manager 33, Student 25), exact input schemas, required/optional/nullable DTOs, raw numeric flags, success statuses/error codes, authorization/expiry/cycle/time/retry rules and synthetic valid request examples.
- Covered Student profile/MSSV/VN mobile; class capacity/fixed sessions/date-only end_date and next Vietnam midnight exclusive expiry; request/cancel/review/cooldown/three lifetime declines; separate cycles; draft/submit/review schedules; durable wrong-three/authoritative Manager override; saved-revision Quiz submit, cutoff/2⁄3/recovery/permanent key binding/grants; fixed denominators/zero 0/all approved sessions ended/dynamic reasons; recipient-private read/unread and reasoned Library removal.
- Clean organized current `DECISIONS.md`, architecture/schema/integrity overview, feature status, actual local CLI/env setup and clean-baseline incompatibility guidance. **Never delete/reset old DB to bypass rejection**; separate approved migration or separate fresh synthetic DB path only.
- Frontend handoff names actual `/student/discover/classes`, removed invitation/timetable/class-dashboard routes and DTO/state adaptations. Existing integration tests remain old; no fake runtime/browser completeness. Same-origin auth unchanged, separate-origin CORS/deployment target deferred. Media guide replaced with deferred boundary, no obsolete runnable upload/storage/SMTP/cleanup recipe.
- `PRODUCT.md` authority/scope/title aligned with approved workflow. `DESIGN.md` limited to explicit historical workflow/status caveat and stale date/topology reference corrections; technical tokens/brand assets untouched.

## Actual checks / provenance

- Read AGENTS.md, all approved workflow lines, current backend checkpoint, actual registration loops/handlers/DTO helpers, complete baseline SQL/DB open guard, config/CLI/seed/finalizer/proxy sources; read relevant existing tests and frontend route/config/package/integration fixture source. No API payload inferred solely from checkpoint. No nested AGENTS.md found.
- Executed from backend with process-local `GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local`: `go test ./internal/app -run '^TestV2RouteSurfaceAndStrictBoundaries$' -count=1 -v` **pass**, app **0.707s**, logged **94 registered routes**. Synthetic test DB only, no production service/data.
- Read-only Node comparisons expanded actual source loops: **94 documented vs 94 source method/path registrations**, **0 missing, 0 extra, 0 duplicate rows, 0 success-status mismatches**; all **10 creation routes (201)** matched. Role totals 7/29/33/25. All **52 source error codes** present in error reference.
- Schema/DTO comparison: **69 columns across 8 returned raw-row schemas** all mentioned; **42 literal pick DTO keys** all present; Quiz constant and computed/nested DTO fields reviewed against source. Input shapes and nested keys checked directly against `x.body`/`shape` declarations. These are source/document consistency checks, not newly executed API acceptance for every example.
- Config/setup comparison: all **8 runtime config keys** documented plus actual three SEED credentials/CLI paths; DB incompatibility message exact from source. Removed cleanup/storage/SMTP/provider commands absent from current setup. JSON parsed: **3 standalone examples + 17 HTTP request bodies**; no malformed JSON. Markdown table enum pipes escaped.
- Local Markdown paths/heading anchors checked across 9 active scoped docs: **84 links, 0 broken**. Final check includes this checkpoint links. External URLs not fetched. No new files/dependencies or installed modules.
- SHA-256 aggregate fingerprints before/after **identical** for `backend/`, `frontend/`, `docs/new-approved/`; approved workflow and all protected code unchanged. No Git metadata available, so no Git-diff claim. No agents or gateway changes.
- Prior backend-agent full test/vet/build/module results retained below, **not rerun here**: tests app 17.284s/config 0.623s/DB 1.293s; vet/build pass; modules verified. Prior race attempt unavailable (`-race requires cgo`); no race/performance/live-service certification.

## Changed files / remaining limits / next action

Changed only `PRODUCT.md`, `docs/{API_DEFINITIONS,ARCHITECTURE,DECISIONS,FEATURES,DEPLOYMENT,FRONTEND_SURFACE_CONTRACT,FRONTEND_VIDEO_INTEGRATION,DESIGN,task-state}.md`.

Documentation phase complete, independent Reviewer next (parent-owned; no delegation here). Frontend adaptation/fixtures/browser verification need separate approval; old frontend suite deliberately not run. Legacy DB migration not supplied/attempted. Linux race, target-hardware load, live-service/deployment and production validation outstanding. No installs, external calls, services, deployment, account/router changes or real DB access/reset/deletion.

---

# Prior backend implementation checkpoint — documentation deferral below superseded

# Approved backend v2 adaptation — 2026-11-15

**Current backend checkpoint. Supersedes historical backend delivery claims below.** Backend implementation and local verification complete; frontend integration and full technical documentation belong to subsequent task. No frontend files changed. No agents, installs, external calls, deployment, account/router settings, real DB access/reset/deletion, or production operations.

## Evidence, diagnosis, decisions
- Read root AGENTS.md, all 389 workflow lines, supplied acceptance, existing source/tests and prior checkpoint. No nested AGENTS.md or VS Code tasks found. No Git metadata available; no Git-diff claim.
- Observation: baseline legacy account/enrollment/DB tests passed, but encoded obsolete invitations, mutable Admin roles, assigned-Manager suspension guard, average Quiz criteria and additive storage migration. Root cause: old contract, not an isolated runtime fault. Confidence high from source and baseline test execution.
- Implemented approved clean baseline `001_initial.sql` with `backend_contract=approved-v2`, migration version 1. Removed 002. Existing nonempty DB is inspected read-only and rejected clearly unless contract/version match; no silent fresh initialization over legacy tables. Synthetic legacy-file byte equality and absent WAL artifacts verified. This is NOT an old-data migration.
- HUST profile uses required Student string MSSV 8–12 digits, unique among Students, school/institute, university class, VN mobile; optional gender. Staff profile fields null. No role mutation/Admin management.
- Runtime choices: existing `/api/v1` prefix retained (v2 means workflow/schema contract); roles remain `admin`, `class_manager`, `student`. Date-only class `end_date` expires at next Vietnam midnight, exclusive. Quiz submit consumes saved revision, never new answers: autosave first, then submit. Start replay stores attempt identity and rebuilds current state; idempotency keys remain permanently cycle-bound.
- Focused regression found audit before-state used numeric booleans; normalized before/after JSON booleans. Boundary review found fractional Test 2/3 rounding; compare elapsed×3 against duration×2. One transaction clock now governs authorization, finalization and mutation, avoiding a second-clock cutoff crossing. Test fixtures extended session TTL only to exercise multi-hour dates; production TTL unchanged.

## Implemented domains / API handoff
- 94 registered routes. Accounts/profile/status/reset; secure bcrypt/JWT/cookie/CSRF/Origin/rate-limit baseline preserved; status/email/password changes revoke relevant sessions. Manager suspension retains assignments.
- Classes: unique code, capacity under immediate writer transaction, two thresholds, fixed positive total sessions once, confirmed Manager reassignment with reason/audit/current authority. Discovery/preview search name/code/Manager.
- Enrollment: Student reason/create/cancel; Manager-only approve/decline; 10-minute cooldown, changed reason, three lifetime pair declines. New approval creates new enrollment ID/cycle; removal preserves academic rows. Stale request/cycle/key actions rejected.
- Schedule: fixed session numbers; draft/save/submit and Admin approve/reject; one open draft/pending; pending/reject preserve approved times; started/ended schedules immutable. Code attendance `[start,end)`, durable three wrong attempts committed even on 422, unique credit, authoritative Manager override with before/after/reason audit; absence autoapproved without credit and notifies Manager. Admin results read-only.
- Quiz: Test/Assignment single-choice equal weight, draft/preview/publish, defaults 1/10 attempts, custom positive Assignment cap, freeze after first attempt, open/deadline/duration/pass validation. Revisioned autosave/recovery, idempotent start/submit, exact nanosecond cutoff, continuous clock, startup/worker finalization despite revoked access. Student DTOs never contain correct options; `review:null`; explicit best-score/pass fields preserve higher historical results after lower attempts; no telemetry scoring.
- Cycle-bound single/bulk grants: explicit deduped enrollment IDs, reason, positive extra attempts (Test default 1, Assignment 1–10), future deadline strictly exceeding every recipient effective deadline, all-or-nothing transaction, active cutoff unchanged, Student/Admin notifications.
- Progress: attendance/fixed sessions and passed distinct quizzes/all published, zero denominators 0, unrounded thresholds, every required approved session ended before Completed; dynamic reasons/recalculation. Dashboards share progress and include active-only agenda/recovery summaries. Old/expired cycles expose Student summary only; assigned staff history stays readable.
- Inbox: Admin to active Manager/Student, Manager to active currently enrolled Students in active assigned classes; explicit dedup recipient lists validated atomically; private read/unread/detail. Workflow notifications transactional, SMTP absent.
- Library: HTTPS Document/Video links, general/same-class session, material expiry; YouTube video exemption never bypasses class/enrollment. Admin removal needs reason/notifies Manager, no Admin creation. Removed uploads/photo/playback/video-credit/invitation/leave/archive/direct-schedule/confirm/telemetry/review-key mutations and obsolete cleanup/storage/SMTP code/config.

Key DTO changes (JSON envelope unchanged):
- User: `student_id`, `school_or_institute`, `university_class`, `phone_number`, `gender`; PUT excludes `role`; status requires `reason`.
- Class: `code`, `capacity`, date-only `end_date`, computed `expires_at`, `total_sessions`, `min_attendance_percent`, `min_quiz_percent`; reassignment requires `reassignment_reason` + `confirm_reassignment:true`.
- Enrollment requests: `/student/classes/{classId}/enrollment-requests`, `/{requestId}/cancel`; Manager corresponding `/{requestId}/review`. Cycle ID returned in roster/history. Student attendance/start/draft/submit require `enrollment_id`; removal/override/grants target explicit enrollment IDs.
- Schedules: `PUT .../sessions/{sessionId}/schedule-draft`, `POST .../schedule-proposals/{proposalId}/submit`, Admin `/review` with decision and reject reason.
- Quiz: `quiz_type:test|assignment`, `open_at`, `deadline`, `duration_seconds`, `pass_score`, `attempt_limit`; nested questions only `question_text/options`, options `option_text/is_correct` on staff input. Student start/submit require UUID `Idempotency-Key`; draft `{enrollment_id,expected_revision,answers:[{question_id,option_ids}]}`; submit `{enrollment_id,expected_revision}`. Grants `{enrollment_ids,reason,deadline,extra_attempts?}`.
- Inbox: `POST /admin/announcements` or `/manager/announcements` with `recipient_ids/title/content`; shared `/announcements`, `/{id}`, `PATCH /{id}/read`.
- Materials: `material_type:document|video`, `url`, optional `session_id/expires_at`; DELETE JSON `{reason}`. Discovery `/student/discover/classes`, history `/student/enrollment-history`.

## Changed paths
- Runtime: `backend/internal/app/{accounts,agenda,announcements,attempts,attendance,auth,classes,core,dashboards,enrollments,materials,quizzes,routes,seed,sessions,workers}.go`; `internal/db/{001_initial.sql,db.go}`; `internal/config/config.go`; `.env.example`; formatted/updated `cmd/{server,migrate,seed}/main.go` (DB errors now clear).
- Removed: `internal/db/002_storage_playback.sql`, `cmd/cleanup`, `internal/storage`, app `{cache,cleanup,photo,playback,video,video_metadata}.go`. Their legacy media/storage tests and superseded invitation/teaching/review/average-score tests removed, replaced by focused v2 suites, not blanket test disabling.
- Tests: retained/adapted auth helpers, credential-race, real TLS HTTP, proxy, config, WAL/pools/rollback; new `v2_{agenda,attendance,best_score,enrollment,failure_paths,helpers,integrity,persistence,progress_library,quiz,seed}_test.go`; replacement DB compatibility tests. Only non-backend change: this checkpoint. Other docs deliberately unchanged pending subsequent docs task.

## Actual verification
All Go commands from backend with process-local `GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local`; dependencies already installed. Temporary synthetic SQLite only; local HTTP/TLS tests only. No binaries/DB created in workspace by verification.
- Baseline targeted legacy tests: pass (app 0.621s, DB 1.074s); proves old behavior only.
- Iterative focused tests: role/profile/revocation, counters/cancel/concurrent capacity, reassignment, schedule/attendance boundaries, wrong-three persistence/override history, quiz recovery/cutoff/replay/concurrent revisions/submit/cycles, grants/atomic notifications, exact completion/zero denominator, material/class expiry, inbox scope, seed, actual reopen/worker finalization, slow-body and revoked-access failure paths passed.
- Final `go test ./... -count=1`: exit 0; app **17.284s**, config **0.623s**, DB **1.293s**; cmd/migrate, cmd/seed, cmd/server no test files.
- Final `go vet ./...`: exit 0, no diagnostics. `go build ./cmd/...`: exit 0, no diagnostics. `go mod verify`: `all modules verified`, exit 0. VS Code backend diagnostics: no errors.
- `go test -race ./internal/app -run 'TestV2Concurrent' -count=1`: exit 2, `go: -race requires cgo; enable cgo by setting CGO_ENABLED=1`. Actual environment CGO_ENABLED=0/windows/amd64, no gcc/clang found. No install/retry.

## Remaining limits / next action
- No known blocking backend MVP gap from implemented acceptance checks. Confidence high for tested local integrity paths; not production/hardware certification. Race detector unavailable; ordinary concurrent transactional tests passed. No 200 req/s or target 1vCPU/1–2GB benchmark claimed; dashboard/list aggregation and due scans remain scaling risks for large datasets.
- Frontend untouched and still targets old contract; full frontend/backend API/schema/operator docs intentionally deferred by scope. Existing historical docs below describe obsolete behavior. Next task: document new contract and separate fresh-DB operation, then adapt frontend under separate approval; run Linux race and hardware validation later without production data.
- External links cannot be revoked once learned. No external-service/network/deployment validation performed. No real DB migration path provided or attempted.

---

# Historical checkpoints — backend claims below superseded; frontend history preserved

# Frontend vertical slice final handoff — 2026-11-14
- **Completed work**:
  - Implemented first frontend vertical slice in `frontend/` (React 18, TypeScript, Vite, Tailwind CSS; `Operate` mode, `docs/DESIGN.md` tokens, 100% Vietnamese UI, in-memory `X-CSRF-Token`, `credentials: "include"`, zero browser storage/service worker).
  - Resolved all 3 reviewer findings + staff drawer logout: `fetchMe` session restore distinguishes `401` (`unauthenticated`) from `503`/network/malformed (`restore_error` + retry/login fallback); `AppShell.tsx` aligns `md:` (`768px`) `240px` sidebar + `max-w-[1200px]` content, adds focus trap/`Escape`/focus restore and `44px` `Đăng xuất` button in staff mobile drawer; `StudentOverviewPage.tsx` preserves `HH:mm dd/MM/yyyy` quiz deadlines; `frontend/tests/auth-restore.test.ts` and `frontend/tests/lib.test.ts` cover regressions.
  - Provenance & docs finalization: embedded PNG `tEXt` origin metadata into `frontend/public/logo-o365.png` and `frontend/public/favicon.png` via `impeccable embed-prompt`; updated `docs/DESIGN.md` (status, vertical-slice evidence, resolved `Logo o365-01.png` variant) and `docs/FRONTEND_SURFACE_CONTRACT.md` (Node `>= 22.6.0`, Go `>= 1.24`, `npm ci`/build/test/dev, `SITE_ORIGIN`/cookie rules, dev proxy vs production compile-time env vars, Path A CORS blocker).
- **Actual check results**:
  - `impeccable.cmd embed-prompt --scan frontend\public`: `SCAN: 2 rasters, 0 missing` (exit `0`).
  - `npm run build` (`tsc -b && vite build` from `frontend/` after raster metadata embed): exit `0`, 55 modules transformed, `dist/assets/index-DguHkX4t.css` (`17.24 kB`) & `dist/assets/index-_fW6TsFb.js` (`232.69 kB`).
  - Prior runtime verification (unchanged source since): `npm run typecheck` exit `0`; `npm test` `20/20` passed (including `integration-go.test.ts` against real local Go backend); Edge headless CDP verified breakpoints `320`–`1440` (`overflow=false`), `.impeccable/review/desktop.png` (`1440×900`) & `.impeccable/review/mobile.png` (`390×844`, captured before staff drawer `Đăng xuất` addition), nonempty Student Overview/Materials/Account, and staff mobile drawer keyboard `Tab`/`Enter`/`Escape` + logout. Temp Go/Vite shells (`55`/`56`) stopped and temp DB dir removed.
- **Blockers / Scope limits**:
  - Nonempty announcements inbox not browser-verified (`POST /api/v1/manager/classes/1/announcements` returned `503` without SMTP).
  - Quiz runner, attendance mutations/YouTube player, staff management UI, and backend credentialed CORS/`CF-Connecting-IP` (required for Path A cross-subdomain deployment) remain out of slice / unimplemented; no full WCAG 2.2 AA or production certification claimed.
- **Next action**: Hand off completed frontend vertical slice; next feature slice can implement quiz runner/attendance/staff UI or backend Path A CORS prerequisites.
---
# Frontend vertical slice reviewer fixes & real browser verification — 2026-11-14
- **Completed work**:
  - `AuthContext.tsx` + `features/auth/restore.ts` + `App.tsx`: `fetchMe` session restore now invalidates to `unauthenticated` only on confirmed `401` (`ApiClientError` with `kind === "unauthenticated"`). `503`, network failures, and malformed responses transition to `restore_error` with persistent `ApiErrorNotice` + retry (`retryRestore`) and explicit `Chuyển tới đăng nhập` fallback.
  - `AppShell.tsx`: Aligned responsive shell breakpoint from `lg:` (`1024px`) to `md:` (`768px`) with `md:w-60` (`240px`) sidebar and `max-w-[1200px]` fluid content per `docs/FRONTEND_SURFACE_CONTRACT.md`. Added initial focus (`Đóng menu`), `Tab`/`Shift+Tab` focus trap, `Escape` dismissal, and focus restoration to `Mở menu điều hướng` on the staff mobile drawer (`role="dialog" aria-modal="true"`). Added keyboard-accessible `44px` `Đăng xuất` button in staff mobile drawer using `handleLogoutClick` (`disabled={loggingOut}`, `"Đang đăng xuất..."`, closes drawer on logout while preserving `Escape`/focus-trap/focus-restoration behavior).
  - `StudentOverviewPage.tsx`: Updated upcoming quiz deadline display from `formatVietnamDate` to `formatVietnamDateTime` so Vietnam cutoff time (`HH:mm dd/MM/yyyy`) is preserved.
  - Tests: Added `frontend/tests/auth-restore.test.ts` (401, 503, network error, malformed JSON, 200) and near-midnight cutoff regression assertions in `frontend/tests/lib.test.ts`.
  - Test-only local DB fixtures (via official API on `http://127.0.0.1:8080`, subsequently cleaned up): Created and admin-approved 2 timetable sessions in the current week and linked 1 external material for class 1.
- **Actual check results**:
  - `npm run typecheck` (`tsc --noEmit` from `frontend/`): exit `0`.
  - `npm run build` (`tsc -b && vite build` from `frontend/`): exit `0`, 55 modules transformed, `dist/assets/index-DguHkX4t.css` (17.24 kB) & `dist/assets/index-_fW6TsFb.js` (232.69 kB).
  - `npm test` (`node --experimental-strip-types --test tests/**/*.test.ts` from `frontend/`): `20/20` passed (including `auth-restore.test.ts`, `lib.test.ts`, `client.test.ts`, `config.test.ts`, and `integration-go.test.ts` against real local Go backend).
  - Real Edge headless CDP verification against `http://localhost:5173` + `http://127.0.0.1:8080`:
    - Breakpoints `320`, `390`, `767`, `768`, `1023`, `1024`, `1440`: `scrollWidth <= clientWidth` (`overflow=false` at all 7 widths); `aside` hidden & bottom nav visible at `<= 767px`, `aside` visible & bottom nav hidden at `>= 768px`.
    - Captured `.impeccable/review/desktop.png` (`1440×900` PNG & DOM verified) and `.impeccable/review/mobile.png` (`390×844` PNG & DOM verified) prior to adding the staff drawer `Đăng xuất` menu item (not recaptured for the added standard menu item; live DOM/CDP verification executed after edit).
    - Verified nonempty Student Overview agenda, auth reload persistence, Class Detail Materials tab (`Tài liệu thực hành MOS Word 365`), Account page, and Staff mobile drawer (`390×844`): `Đóng menu` initial focus, `44px` `Đăng xuất` button height, `Tab` wrap from `Đăng xuất` to `Đóng menu`, `Escape` close & focus restore to `Mở menu điều hướng`, and keyboard `Enter` on `Đăng xuất` closing drawer and logging out to `/dang-nhap`.
  - Cleanup: Stopped local harness shells `55` (Vite) and `56` (Go API) and removed temporary directory `C:\Users\anhtu\AppData\Local\Temp\o365-lms-browser-13f87c53`.
- **Blockers / Scope limits**:
  - Announcement fixture creation (`POST /api/v1/manager/classes/1/announcements`) returned `503 temporarily_unavailable` (`Dịch vụ email chưa được cấu hình.`) because SMTP configuration is absent in the local harness; left unseeded/blocked as expected.
  - Quiz runner, attendance mutations/YouTube video player, staff management UI, and backend cross-origin CORS remain out of slice.
- **Next action**: Parent final review / handover.

---

# Frontend vertical slice implementation — 2026-11-14

- **Completed work**: Implemented the first complete frontend vertical slice in `frontend/` using React 18, TypeScript, Vite, and Tailwind CSS (`Operate` mode, normative tokens from `docs/DESIGN.md`, 100% Vietnamese UI, zero mock data, zero browser storage/service worker).
  - Config & API client: validated `VITE_API_ORIGIN`, `VITE_API_BASE_PATH`, `VITE_API_ROUTES_JSON`, configurable Vite proxy (`changeOrigin: false`), `credentials: "include"`, in-memory `X-CSRF-Token`, `401`/`403 class_archived`/`429 Retry-After`/unconfirmed-write handling, and bounded pagination/concurrency.
  - Pages & shell: Login, Student Overview (agenda-first), Weekly Timetable (`Asia/Ho_Chi_Minh`), Paginated Active Classes & Invitations (accept/decline), Read-only Class Detail (`Tiến độ`, `Buổi học`, `Bài tập`, `Tài liệu`), Shared Announcements Inbox (read/unread), Account (profile + change password + logout), and Staff Overview with honest scope notice; responsive desktop sidebar, student 4-tab mobile bottom nav, and staff mobile drawer.
  - Assets & Docs: Generated `frontend/public/logo-o365.png` and `frontend/public/favicon.png` from `assets/logo/Logo o365-01.png` via `ffmpeg`; added `docs/FRONTEND_SURFACE_CONTRACT.md`, updated `docs/DECISIONS.md`, and narrowly updated `PRODUCT.md` and `docs/FEATURES.md`.
- **Actual check results** (from `frontend/`):
  - `npm run build` (`tsc -b && vite build`): exit `0`, 54 modules transformed, `dist/assets/index-*.css` (17.23 kB) & `dist/assets/index-*.js` (230.01 kB).
  - `npm test` (`node --experimental-strip-types --test tests/**/*.test.ts`): `15/15` passed (unit tests for config/routes, Vietnam timezone/dates, formatters, router, `ApiClient` error/CSRF/pagination, plus end-to-end integration test against real local Go `cmd/server` + `cmd/seed` + temporary SQLite).
- **Blockers / Scope limits**:
  - Visual browser inspection and live DOM/accessibility checks are pending parent execution against the running local harness.
  - Quiz runner, attendance mutations/YouTube video player, staff management UI, and backend cross-origin CORS remain out of this slice.
- **Next action**: Parent runs browser verification against the local Vite + Go backend harness, then stops the detached test servers and cleans up the temporary directory/secret file when finished.

---

# Documentation update: Cloudflare Pages + Tunnel deployment topology — 2026-11-14

- Updated [DEPLOYMENT.md](DEPLOYMENT.md) and [DECISIONS.md](DECISIONS.md) to document the selected **Path A** topology: Cloudflare Pages custom domain (`https://lms.example.edu.vn`) for the future frontend SPA + separate custom API subdomain (`https://api.example.edu.vn`) routed via `cloudflared` (Cloudflare Tunnel) on Ubuntu 24.04 LTS to `http://127.0.0.1:8080`, alongside **Path B** (existing single-origin Caddy recipe).
- Documented domain/TLS/config setup on both sides: Cloudflare zone/automatic edge TLS (no Let's Encrypt or Caddy required on VPS for Path A), Pages custom domain + `VITE_API_BASE_URL=https://api.example.edu.vn/api/v1` + `credentials: "include"` + `X-CSRF-Token`, named Tunnel routing, backend `SITE_ORIGIN=https://lms.example.edu.vn`, API cache-bypass rule, R2 CORS/YouTube origin alignment, consistent `cleanup` binary build/install commands, and explicit blocking backend code prerequisites (credentialed CORS/`OPTIONS` preflight + Tunnel client-IP extraction) required before enabling Path A in production.
- Documentation-only change; no backend/frontend runtime edits, terminal commands, or deployments performed.

---

# Documentation-only frontend video integration guide — 2026-11-14

- Created [FRONTEND_VIDEO_INTEGRATION.md](FRONTEND_VIDEO_INTEGRATION.md); linked from [FEATURES.md](FEATURES.md) and the YouTube section of [DEPLOYMENT.md](DEPLOYMENT.md). Scope: required YouTube makeup frontend integration, cookie/CSRF, trusted metadata, serialized playback/recovery, attendance/quiz links, and manager-review fallback. No frontend/UI implementation, runtime/dependency changes, or new decision.
- Checks: read root instructions (no nested docs instructions found), relevant API/feature/decision/deployment content and backend handlers; statically compared guide routes/DTOs/sequence/credit/attendance constraints with current code. Consulted public official YouTube IFrame API reference only; no private code sent externally. No terminal commands, tests, builds, scripts, browser playback, real-video or external-service verification performed.
- Developer still needs frontend implementation and checklist verification, then separately approved browser/YouTube/same-origin staging checks. Backend count remains 83/83; prior runtime evidence below remains historical evidence, not verification of this guide. No documentation blocker.

---

# Final bounded verification — 2026-11-14

**Current delivery: 83/83 approved backend routes coding-complete; final local checks passed. Not production-ready certification.** This checkpoint supersedes all earlier delivery counts, active work and next-action sections below. Backend-only scope; no implementation changes or newly discovered bug in this validation. Only `docs/task-state.md` changed in this pass.

## Review scope and limits

- Caller-reported second narrow media correction review: **NO actionable remaining findings**. Static review only, not a new runtime or live-service verification in this pass. Scope: playback 250ms eligibility tolerance with credit `min(delta,elapsed)`; exact retained-material exception checks; video-first attendance reconciliation/manual override; independent offline SigV4 verifier. No broader audit or production-readiness conclusion implied.
- Read `AGENTS.md`, existing test helpers/dependencies and documented commands. Service tests retain fake transports/synthetic credentials, temporary SQLite and loopback HTTP/TLS only; SMTP test queues without starting delivery workers. No delegation, external service requests, downloads, installs, deployment, actual bucket cleanup, gateway changes or production-data operations.
- Each command ran independently from `D:\GitHub\School\o365-LMS\backend`, setting only process-local `$env:GOPROXY='off'; $env:GOSUMDB='off'; $env:GOTOOLCHAIN='local'`. Commands compiled server/seed/migrate/cleanup; no CLI was run against services or existing data. Known unavailable race support not retried.

## Executed commands and exact captured results

`go test ./... -count=1` — exit 0:

```text
?   	o365-lms/backend/cmd/cleanup	[no test files]
?   	o365-lms/backend/cmd/migrate	[no test files]
?   	o365-lms/backend/cmd/seed	[no test files]
?   	o365-lms/backend/cmd/server	[no test files]
ok  	o365-lms/backend/internal/app	26.434s
ok  	o365-lms/backend/internal/config	0.717s
ok  	o365-lms/backend/internal/db	2.196s
ok  	o365-lms/backend/internal/storage	2.320s
TEST_EXIT=0
```

| Independent command | Captured output / actual outcome |
|---|---|
| `go vet ./...` | No diagnostics; `VET_EXIT=0` |
| `go build ./cmd/server ./cmd/seed ./cmd/migrate ./cmd/cleanup` | No compiler output; `BUILD_EXIT=0`; no workspace binaries emitted |
| `go mod verify` | `all modules verified`; `MOD_VERIFY_EXIT=0` |
| `go test ./internal/app -run '^TestRouteInventory$' -count=1 -v` | Completed exit 0. Tool summarized output as `84 matches in 1F:` at `integrity_test.go`, showing route log lines and `+74`; raw count/PASS/timing lines were not exposed. Completed process inspected rather than rerunning. Source assertion requires exactly 83 routes; passing test verifies 83. No invented verbatim output or timing. |

## Artifact inspection / consistency

- Before/after SHA256 manifest of all 75 workspace files excluding `docs/task-state.md` matched: `EC057CCD5845DE7F0DFDDE54375646878D6A2CE6444A41D630D4C5B437607A76`. All 12 workspace directories unchanged; no real `.env`, DB/WAL, binary, log or temporary workspace artifact found. `.env.example` is existing template, preserved.
- OS temporary-directory inspection found no new entries since check start `2026-11-14T05:05:12.4891664Z`, and no new `go-build*`, `Test*` or `lms-verify-*` remnants. Three pre-existing `go-build*` directories unchanged and left alone. Test-owned temporary data cleaned by test/tool lifecycle; no manual deletion or unrelated-data cleanup performed. Normal Go build/test cache use is not a production-data operation.
- Quick `FEATURES.md` / `DEPLOYMENT.md` consistency check only: both describe 83 backend routes and unverified external integrations; cleanup remains explicit/default-off, race requires Linux/CGO/compiler, hardware capacity not certified. Existing deployment examples are operator instructions, not executed verification. No edits to these docs or contracts needed.

## Remaining limits and next action

- Coding finished for 83/83 approved backend routes; no frontend delivery claimed. External SMTP/R2/S3/CORS/private permissions/YouTube, Linux race, Caddy/systemd runtime and target 1vCPU/1–2GB hardware remain unverified. Local tests and static review do not certify production readiness or human attention from browser telemetry.
- Next action: hand off completed backend coding. Only with separate approval, run isolated staging integrations plus Linux race/service and target-hardware checks; keep destructive cleanup disabled. No active backend implementation task remains from this bounded request.

---

# Historical evidence — all checkpoints below superseded by final verification above

Earlier results, diagnoses and planned actions remain evidence of their original stage, not active delivery state or authorization.

# Bounded backend review corrections — 2026-11-14

**Current: 83/83 approved routes; three P2 corrections and offline SigV4 review gap verified locally.** This section supersedes earlier verification/algorithm wording below. Backend only; no delegation, live services, external fetches, deployment, account/router setting changes, production data edits or real object deletion. No Git metadata available; unrelated existing files preserved.

## Observations / diagnosis / confidence

- Reproduced before runtime edits: `TestPlaybackJitterCappedDistinctCoverage` returned covered_seconds=0 for position0@t0,10@9.9s. Root cause: eligibility incorrectly required delta<=elapsed, discarding whole valid interval instead of capping it. Confidence high.
- Reproduced: actual admin manager reassignment A to B followed by same-object material PUT returned400 invalid_request. Root cause: actor ownership was unconditional, conflating retention with new attachment. Confidence high.
- Reproduced: all six photo/video/quiz permutations ended awaiting_approval instead of watched_video after prerequisites; video-first cases regressed upon photo. Root cause: code/photo CASE branch preceded completed-video branch. Confidence high. Initial test helper assumed quiz-first creates attendance; corrected helper to treat missing row as missed, without runtime/test-assertion relaxation.
- Observed assurance gap: old SigV4 tests only checked escaping, expiry and determinism. New external-package verifier derives canonical request and HMAC independently from AWS S3 query-auth specification, with handwritten byte encoding and no production signing helpers or fetched fixture. Confidence high for bounded offline algorithm interoperability; not evidence of live R2 configuration.

## Corrections / affected invariants

- Playback accepts forward movement only with previous playing state, 0<server elapsed<=30s and delta<=elapsed+250ms. Credits exact interval `[last_position,last_position+min(delta,elapsed)]`; uncredited gaps stay gaps, never borrowed/caught up. Fixed 250ms allowance bounds arrival discrepancy independent of heartbeat length; larger jumps receive zero. Exact distinct interval union, sequential/duplicate rules, trusted duration and server-time ceiling preserved. Small timing shifts remain indistinguishable from sub-tolerance seek/speed drift, but receive no extra time credit; browser telemetry is not human-attention proof.
- Material foreign-actor exception only for PUT retaining current key on targeted existing same-class material with matching attached registry material_id. Shared check runs in preflight and final authorized transaction. New attachments retain actor guard; photo rules, cleanup states, original uploaded_by and no-network-under-writer preserved. Metadata retention performs no storage HTTP/file copy.
- Attendance priority: manual attended/missed override, then supported >=90% video + passed current linked quiz, then pending code/photo. Earned video no longer demoted by photo; no-quiz/unsupported behavior unchanged.
- SigV4: local httptest verifier accepts presigned client PUT, Finalize GET/server-only PUT, signed GET and DELETE; rejects method/path/MIME/host/query/expiry/signature tampering. Uses synthetic credentials and local fake objects only. No signer runtime change, new dependency, API, migration or route changes.

## Files changed

- Runtime: `backend/internal/app/playback.go`, `materials.go`, `attendance.go`.
- New focused regressions: `backend/internal/app/playback_jitter_test.go`, `material_reassignment_test.go`, `attendance_precedence_test.go`; `backend/internal/storage/sigv4_interop_test.go`.
- Docs: `docs/FEATURES.md`, `docs/DECISIONS.md`, `docs/task-state.md`. Approved ARCHITECTURE/API contracts, draft, go.mod/go.sum and unrelated prior work untouched.

## Exact check evidence

Commands from `D:\GitHub\School\o365-LMS\backend`; each process set `$env:GOPROXY='off'; $env:GOSUMDB='off'; $env:GOTOOLCHAIN='local'`. No downloads/global installs. Tests use temporary SQLite, fake transports and loopback HTTP only; cleanup/seed/server/migrate built, not run against services.

| Command/check | Actual result |
|---|---|
| Red `go test .\internal\app -run 'TestPlaybackJitter\|TestMaterialReassigned\|TestAttendancePhotoVideo' -count=1 -json` | test exit1; all6 order cases failed expected status, retention400, jitter0s; app4.344s |
| Initial corrected new-test slice (including independent signer verifier) | exit0; app4.335s, storage1.510s; all6 order cases and7 signer tamper cases passed |
| `go test .\internal\app .\internal\storage -run 'TestPlayback\|TestTrustedVideo\|TestMaterial\|TestPhoto\|TestAttendancePhotoVideo\|TestSigning' -count=1` | exit0; app8.949s, storage1.242s |
| `go test ./... -count=1` | exit0; app25.185s, config0.662s, db1.814s, storage2.155s; cleanup/migrate/seed/server [no test files] |
| `go vet ./...` | VET_EXIT=0; no diagnostics |
| `go build .\cmd\server .\cmd\seed .\cmd\migrate .\cmd\cleanup` | BUILD_EXIT=0; no workspace binaries emitted |
| `go mod verify` | all modules verified; MOD_VERIFY_EXIT=0 |
| `go test .\internal\app -run '^TestRouteInventory$' -count=1 -v` | implemented routes:83; PASS; test0.21s, package0.404s; INVENTORY_EXIT=0 |
| VS Code diagnostics, seven changed/new Go files | No errors found |

Playback regression also covers alternating jitter/fractional positions across100s video reaching>=90%, per-prefix cumulative server cap, fractional overlap union, zero-time/gap>30s, genuine50s jump,2x movement and >250ms boundary rejection before any coverage exists. Material regression covers POST reuse, different targeted material, unattached foreign object, cross-class object and revoked old-manager access, with no storage calls. Attendance regression covers all six event orders, resubmitted photo after earned video, manual attended/missed over subsequent photo/watch evaluation.

## Assumptions / remaining limits / next action

- Fixed 250ms jitter budget is an explicit conservative algorithm choice, not measured real-network calibration; larger jitter can still lose intervals. No new client timing/duration fields. Per-heartbeat server-time cap and exact stored union prevent inflated time credit, not fabricated browser telemetry.
- Not verified: live R2/S3/CORS/private permissions, YouTube/SMTP, Linux race, deployment or target1vCPU capacity. Unavailable race not retried. Offline verifier establishes bounded cryptographic assurance only; no production-readiness claim.
- Next action: approved isolated staging and Linux/hardware verification, destructive cleanup disabled. No live action taken or authorized here.

---

# Backend completion checkpoint — 2026-11-14

**Current delivery: 83/83 approved backend routes, all remaining11 implemented.** Historical72-route checkpoints below retained as evidence, superseded by this section. Backend only; no agents, live external requests, deployment, production changes or real bucket deletion. Approved ARCHITECTURE/API documents unchanged; draft untouched. No Git metadata available, so no Git diff claim.

## Diagnosis and confidence

- Observation: new material regression initially returned404 instead of201; photo routes similarly404. Trusted provider/playback/cleanup absent. Directly adding storage fetch to existing writer-bound handlers would block sole SQLite writer.
- Root cause: intentionally deferred vertical slices, not credential/config failure. Confidence high from source and red tests.
- Correction: reader/preflight + short durable object claim, bounded storage snapshot/verification outside writer, transactional auth/class/session/code/object rechecks, immutable-to-client verified destination. PUT itself explicitly remains overwriteable. Network/write separation verified by fake transports successfully acquiring writer during storage/provider requests.
- Observation: actual .env.example already used # comments; claimed prose parsing failure not reproduced. Regression pins actual parser and new default-off settings. No invented bug diagnosis.
- Hypotheses/assumptions: S3-compatible path-style SigV4 provider interoperability, bucket privacy/CORS and YouTube quotas need approved staging. Tests establish local behavior, not production readiness or human viewing proof.

## Completed coding

-11 routes: admin/material GET; manager materials GET/POST/PUT/DELETE +storage/presign; student materials GET, presign-photo, attend, playback/start, playback/progress. Existing watch-video supported evaluation completed.
- Private SigV4300s URLs; registry binds actor/class/session/usage/MIME/exact size. Random staging key snapshots to <=25MiB temporary file, magic/Office checks, server-only random final key. Two shared media slots, bounded stripe locks/timeouts; no request network inside writer.<=5MiB photo,<=25MiB materials; Office ZIP preallocation/entry/ratio/decompression budgets.
- Photo check-in atomic/idempotent, current code rechecked after network, old code revoked, proof persists before linked quiz pass; quiz-first/photo-first and manual override preserved. Signed views in student/manager/admin DTOs; replay stores no signed credentials and refreshes only URL/expiry after current access checks. Retained historical replay status is not current-state GET.
- Trusted YouTube backend duration via fixed endpoint, env-only key, bounded4s/64KiB response. Canonical validated ID; missing metadata/unsupported providers use manager review. Playback distinct run ID per video revision; metadata edits preserve coverage; replacement clears automatic coverage without overriding manager. Sequential heartbeat, duplicate no-op, seeks excluded, elapsed cap, merged distinct coverage>=90% +current quiz pass.
- Additive migration2, initial SQL unchanged. Actual v1 schema upgrade/reopen tested. Legacy playback table preserved; legacy object keys without registry fail closed. No migration/backfill of production data.
- Cleanup code +cmd/cleanup only: default dry-run and STORAGE_CLEANUP_ENABLED=false. References/current end date rechecked before tombstone claim, network outside writer, no later attachment/signing; staged copies after24h, orphan finals after24h, photos end_date+90d. Academic rows/proof keys/idempotency retained. Class metadata PUT409 while photo deletion claimed prevents end-date extension race. No scheduler installed, no real cleanup run.
- Material metadata page/timetable30s bounded coalescing caches, current scope fresh and successful-write invalidation; URLs not cached. Existing leaderboard20s retained.

## Files changed/new

- Runtime edits: backend/internal/app/{core,routes,accounts,sessions,attendance,cache}.go; new materials.go,photo.go,video_metadata.go,playback.go,cleanup.go. Existing video.go provider labeling reused.
- New backend/internal/storage/{storage,verify}.go and storage_test.go,budgets_test.go. Standard library only; go.mod/go.sum unchanged.
- backend/internal/db/db.go,db_test.go; new002_storage_playback.sql,migration_compat_test.go;001_initial.sql unchanged.
- backend/internal/config/config.go,config_test.go; newtemplate_test.go;backend/.env.example;newbackend/cmd/cleanup/main.go.
- Tests app: newmaterials_test.go,photo_test.go,photo_order_test.go,media_edges_test.go,input_bounds_test.go,playback_test.go,playback_order_test.go,provider_edges_test.go,cleanup_test.go,retention_test.go; app_test.go denies external storage/video by default and exposes temp DB path for restart; attendance_review_test.go fixture now supplies actual trusted duration; integrity_test.go inventory83.
- docs/FEATURES.md,DECISIONS.md,DEPLOYMENT.md,this checkpoint updated. No frontend or dependency changes.

## Exact verification evidence

Commands from D:\GitHub\School\o365-LMS\backend, process-local GOPROXY=off,GOSUMDB=off,GOTOOLCHAIN=local. Tests only local temporary SQLite and fake storage/provider transports; prior local HTTP/TLS tests preserved. No installs/downloads/global environment edits.

| Command | Actual final output/result |
|---|---|
| go test ./internal/app ./internal/storage ./internal/db ./internal/config -run 'TestPhoto\|TestMaterial\|TestPlayback\|TestTrustedVideo\|TestYouTube\|TestProvider\|TestCleanup\|TestRetention\|TestNewRoutes\|TestSigning\|TestVerify\|TestZip\|TestFinalize\|TestAdditive\|TestEnvExample' -count=1 | exit0; app7.596s,storage1.387s,db1.558s,config0.662s |
| go test ./... -count=1 | exit0; app23.094s,config1.135s,db2.900s,storage1.946s; cleanup/migrate/seed/server [no test files] |
| go vet ./... | VET_EXIT=0; no diagnostics |
| go build ./cmd/server ./cmd/seed ./cmd/migrate ./cmd/cleanup | BUILD_EXIT=0; no workspace binaries emitted |
| go mod verify | all modules verified;MOD_VERIFY_EXIT=0 |
| go test ./internal/app -run '^TestRouteInventory$' -count=1 -v | implemented routes:83;PASS;test0.23s,package0.423s;exit0 |
| VS Code backend diagnostics | No errors found |
| go env CGO_ENABLED GOOS GOARCH | 0,windows,amd64;gcc/clang still absent;race not retried or installed |

Red evidence: TestMaterialExternalCRUDAndGuards404; photo tests404; playback/cleanup initially missing symbols before behavior; template missing new defaults. First full expanded suite caught stale72-route/version1 assertions only, updated to83/version2 with stronger actual-v1 migration test. Later full suites passed. Focused concurrency tests use fake transport, no credentials needed.

Coverage of new invariants: signature escaping/expiry; size/MIME spoof/Office family/macros/ZIP bombs and central-directory preallocation budget; object actor/expiry/reuse; atomic rollback; archived/kicked denial before replay/signing; concurrent attendance replay; code rotation/revocation during GET; quiz/photo and quiz/video order;90% threshold; seeks/overlaps/duplicates/override/replacement; durable restart; v1 migration; cleanup dry-run/default-off/reference/tombstone/retention; strict null/unknown/body bound; fixed provider endpoint/malformed/oversized metadata. Existing72-route suite remains passing.

## Remaining integration limits / next action

- Not verified: live R2/S3 signature/CORS/private permissions, real YouTube metadata/quota, SMTP delivery, Linux race, Caddy/systemd and1vCPU sustained capacity. No production-readiness claim.
- Private object verification is not antivirus. Conservative ZIP/resource limits reject unusually complex documents. Browser heartbeat telemetry cannot prove attention. Existing issued URLs retain<=5min exposure after access loss.
- Cleanup needs explicit operator enable +non-dry-run and backups; no automatic schedule. Runtime crash may leave bounded temporary snapshot files; protected temp-disk capacity/operator cleanup needed. Failed/timed-out finalization remains tracked unusable orphan; client needs fresh presign; no silent overwrite retry.
- Lists/dashboard other than material page retain prior scaling limits. Two media slots can503 under burst, intentionally preserve resource/writer budget. Path-style static credentials only; no STS/session-token support. Legacy unregistered storage records need separately approved migration.
- Next action: approved isolated staging integration and Linux race/hardware verification, with destructive cleanup still disabled. Functional backend coding completed locally.

---

# Historical evidence — superseded delivery counts below
# Backend task state

Updated after second bounded six-fix review and final verification, local session 2026-11-14. Workspace `D:\GitHub\School\o365-LMS`. Backend only. No agents spawned, account/router settings changed, production requests, external SMTP/storage requests, deployment or destructive existing-data operations.

## Acceptance and actual delivery

- Read `AGENTS.md`, approved `ARCHITECTURE.md`, `API_DEFINITIONS.md`, `DECISIONS.md`. Initial workspace had docs only, no backend or supplied runtime failure evidence. No VS Code tasks found. Available toolchain Go 1.27.3 Windows/amd64.
- **72 / 83 approved routes delivered (86.75%), 11 deferred**, complete auth/account/class/enrollment slice first, expanded timetable/quizzes/dashboards/announcements/attendance review. Real SQLite-backed implementations, no success stubs. Exact route matrix and approved payload links: [FEATURES.md](FEATURES.md).
- `.env` loading and strict startup validation, idempotent first-admin bootstrap, pristine-only atomic synthetic seed, WAL migrations, single immediate writer + read-only reader pool, bcrypt/JWT/session revocation/CSRF/Origin/RBAC, strict input validation and Vietnamese errors.
- Quiz autosave, exact-set grading, early-Test restriction, retakes, event dedup, expiry finalization, durable replay/recovery. Atomic enrollments/leave/timetable transitions, last-admin/assigned-manager guards, effective archive rules. Bounded durable SMTP outbox and explicit missing-config failure. SMTP delivery not externally verified.
- Detailed operator tutorial: [DEPLOYMENT.md](DEPLOYMENT.md), Ubuntu 24.04 LTS/systemd/Caddy, HTTPS/env/bootstrap/seed/migrations/permissions, WAL-correct backup/restore, update/rollback, smoke checks and limits.

## Observations, diagnosis and confidence

### Observed and reproduced

1. First SQLite integration run failed `SQL logic error: out of memory (1)`. Root cause: malformed Windows `file://D:` URI. Normalized drive path to `file:///D:/...`; same focused slice tests passed. Confidence high.
2. Rejected late drafts could roll back expiry grading if grading shared failing request transaction. Request savepoint now isolates action rollback from pre-action due finalization; late error leaves submitted server-draft result committed. Integration test inspects DB directly. Confidence high.
3. SQLite `julianday` comparison rounds sub-millisecond precision, risking early finalization. SQL selects candidates; Go performs exact timestamp comparison before grade. Regression covers one nanosecond before cutoff and exact cutoff. Confidence high.
4. Test advancing clock 25 hours correctly got session-expired 401; test now reauthenticates before verifying result recovery beyond replay window. Auth was not relaxed.
5. Full route inventory test asserts 72. No `.env`, DB, executable or log artifacts remained in workspace at final inspection.

### Hypotheses / not verified

- Target 1vCPU/1–2 GB server capacity and sustained 200 req/s need Linux hardware benchmark. Local burst proves bounded integrity behavior only.
- SMTP interoperability/delivery, Caddy/systemd runtime and filesystem permissions on Ubuntu need approved integration/deployment test.
- Storage/telemetry integrations are absent, not assumed working from credentials.

### Explicit limits

- R2/S3 upload signing, ownership registry, actual byte/magic/size validation, materials, photo attendance, trusted-duration playback, retention cleanup deferred. Credentials do not enable missing routes.
- Current video labels identify provider but telemetry always unsupported; makeup goes to manager review, never fake automatic watched credit.
- Login IP limiter supports explicit `TRUSTED_PROXY_CIDRS` with single-hop overwritten `X-Forwarded-For`; empty default trusts none. Caddy configuration documented but Ubuntu runtime unverified. Same-NAT clients share quota; proxy chains unsupported; trusted local processes can assert forwarded IP.
- Lists materialize filtered rows before pagination; dashboard uses per-student queries. Large data scaling and timetable caching remain work.
- SMTP outbox is at-least-once, can duplicate after crash; queued does not mean delivered. Failed recipients remain visible in DB; worker retries at most five times.
- Go module minimum is 1.24 because pinned dependencies require it; no claim of Go 1.22 compatibility.

## Changed/new file groups

- `.gitignore`; `backend/.env.example`; `backend/go.mod`, `backend/go.sum`.
- `backend/cmd/server/main.go`, `backend/cmd/migrate/main.go`, `backend/cmd/seed/main.go`.
- `backend/internal/config/`: dotenv, startup validation + tests.
- `backend/internal/db/`: approved embedded initial SQL, atomic migrations, pools/transactions + tests.
- `backend/internal/app/`: core HTTP/validation/queries, auth, accounts/classes, enrollments, sessions/timetable, quizzes/attempts/finalizer/idempotency, dashboards, attendance review/makeup, announcements/outbox, cache, seed, provider labels and integration/concurrency/edge/load/TLS tests.
- `docs/DEPLOYMENT.md`, `docs/FEATURES.md`, this checkpoint. Appended actual implementation decisions to `docs/DECISIONS.md`; approved architecture/API documents unchanged. Draft untouched.

## Concrete verification evidence

All Go commands run from `D:\GitHub\School\o365-LMS\backend`; dependency download happened only after manifest existed. Tests used temporary files and local TLS only. No global environment/tool installs.

| Command | Actual result |
|---|---|
| `go test ./internal/app -run 'TestAccountClassEnrollmentSlice\|TestAuthValidationAndRevocation' -v` | PASS after Windows URI fix |
| `go test ./internal/app -run 'TestQuiz\|TestTestRules\|TestTimetable\|TestConcurrent' -v` | PASS autosave/cutoff/recovery/retake/idempotency/timetable/concurrency |
| `go test ./internal/app -run TestRealTLSHTTPLoginMeLogout -count=1 -v` | PASS real local HTTPS listener, Secure cookies, login/me/logout |
| `go test ./internal/app -run TestSeedPristineOnlyAndConcurrent200Requests -count=1 -v` | PASS 200 concurrent requests, 86.9977 ms recorded run; 100 creates + 100 expected conflicts, integrity_check=ok |
| `go test ./internal/app -run Test100StudentQuizBurst -count=1 -v` | PASS 100 students/3 classes, 100 concurrent starts + 100 concurrent submits, 352.2752 ms; 100 scores=100, 200 replay records, integrity_check=ok |
| `go test ./internal/app -run TestCutoffNanosecondAndFailedActionAtomicity -count=1 -v` | PASS exact cutoff regression |
| `go test ./... -count=1` | PASS final run: app 7.851s, config 0.460s, DB 1.259s; command wrappers compile |
| `go test ./... -cover -count=1` | PASS app 81.5%, config 79.4%, DB 76.9%; CLI wrappers 0.0% |
| `go vet ./...` | PASS exit 0 |
| `go build ./cmd/server ./cmd/seed ./cmd/migrate` | PASS exit 0 |
| `go mod verify` | `all modules verified` |
| `go test ./internal/app -run TestRouteInventory -count=1 -v` | PASS `implemented routes: 72` |
| `go test -race ./internal/app -run TestConcurrentDuplicateStartSubmitAndDraft -count=1` | **Not run successfully**: `go: -race requires cgo; enable cgo by setting CGO_ENABLED=1`; `go env` reports CGO_ENABLED=0, windows/amd64; gcc/clang absent. No retry/install loop. |
| VS Code backend diagnostics | No errors found after removing ambiguous error-interface declaration |

Coverage tests include malformed/unknown/null fields, password/domain policy, safe pagination, origin/CSRF, tampered JWT, revocation, last-admin/assigned-manager guards, RBAC/cross-class/archive checks, atomic invalid invitation/recipient batches, invitation ID reuse, pending leave uniqueness, timetable supersede/preservation, all role dashboard reads, quiz pre/post-attempt mutations, question/option scope, draft conflicts, cutoff/startup, review privacy, dedup, replay conflict, unlimited homework, retakes, rate limits, seed refusal, WAL/read-only/FK/rollback/migration reopen, and missing SMTP explicit failure.

## Deferred routes — exact 11

1. `GET /api/v1/admin/classes/{classId}/materials`
2. `GET /api/v1/manager/classes/{classId}/materials`
3. `POST /api/v1/manager/classes/{classId}/materials`
4. `PUT /api/v1/manager/classes/{classId}/materials/{id}`
5. `DELETE /api/v1/manager/classes/{classId}/materials/{id}`
6. `POST /api/v1/manager/classes/{classId}/storage/presign`
7. `GET /api/v1/student/classes/{classId}/materials`
8. `POST /api/v1/student/classes/{classId}/sessions/{sessionId}/presign-photo`
9. `POST /api/v1/student/classes/{classId}/sessions/{sessionId}/attend`
10. `POST /api/v1/student/classes/{classId}/sessions/{sessionId}/video-playback/start`
11. `POST /api/v1/student/classes/{classId}/sessions/{sessionId}/video-playback/{playbackSessionId}/progress`

## Reviewer corrections — 2026-11-14

### Observations and reproduced evidence

- Read root `AGENTS.md`, prior checkpoint, approved architecture/API auth, quiz, attendance, dashboard and replay rules, relevant implementation/tests/config and deployment docs. No nested AGENTS files. User's six source findings were supplied failure evidence; no production logs supplied.
- Before correction, real local HTTP regression `TestSlowSubmitBodyCannotChangeExpiredDraft` failed `late changed answers accepted: 200`. Headers/partial JSON arrived before cutoff; final bytes arrived at exact cutoff. `TestSlowLoginDoesNotBlockQuizWriterOrFinalizer` failed `context deadline exceeded` on independent quiz writer/finalizer while login body stalled.
- Source confirmed replay returned saved review without current metadata check, grade updated only existing attendance rows, and student quiz lists sorted variable-width timestamps lexically. Numeric dashboard assertions absent; formulas themselves passed added numeric tests without rewrite.
- First full post-fix run exposed bodyless DELETE compatibility regression (`400` instead of existing `200`/`409`). Inspected failing call sites; excluded DELETE from JSON predecode, preserving contract. Initial Windows `gofmt` wildcard was unsupported; used explicit PowerShell file enumeration. Final inspection caught pipe-encoded Vietnamese auth text; corrected UTF-8 via file edits and pinned login error text in regression. All final checks below include corrections.

### Diagnosis, affected invariants and fixes — confidence high locally

1. **P1 cutoff:** pre-body `Received` let late answers inherit header eligibility while writer prevented expiry. Complete bounded JSON now decoded before writer queue; receipt captured after EOF. Existing exact nanosecond comparison retained. Real HTTP test preserves nonempty server draft and cutoff timestamp, rejects changed late answers; separate submit succeeds exactly one nanosecond before cutoff.
2. **P1 writer/auth:** request-wide immediate transaction included body reads, limiter and bcrypt. JSON syntax/shape preparation and login validation/throttle/password work now outside writer; two bounded password slots cover login/change/create/reset. Short transaction rechecks current hash, token version, active, role and email before session creation; authenticated mutations recheck session/role/class scope after queue. DB-dependent validation stays inside transaction for consistency. Regression completes bcrypt using reader while writer held, then changes each credential field and proves stale session creation rejected. Slow real HTTP login no longer blocks quiz write/finalizer. Savepoint/idempotency atomicity unchanged.
3. **P2 proxy quota:** RemoteAddr saw Caddy only. Explicit comma-separated `TRUSTED_PROXY_CIDRS`, default none; trust one valid `X-Forwarded-For` only from allowed immediate peer. Caddy overwrites value with `{remote_host}`. Tests cover trusted distinct clients, repeated quota, untrusted spoof, malformed/missing/duplicate/chain/zone headers, IPv6 and invalid config. No environment/global settings changed outside test-local `t.Setenv`.
4. **P2 replay privacy:** stored review retained old authorization. Submit response recomputes only `review` under CURRENT flag; stored attempt/answers/outcome/fingerprint unchanged, no regrade. Enabled/disabled/re-enabled replay matches GET. Narrow review-only current-authorization exception documented in DECISIONS/FEATURES.
5. **P2 attendance order:** no attendance row existed at quiz-first grade; creation defaulted false; relink never reconciled. Shared reconciliation derives current linked submitted pass on creation/grading/relink; prerequisites refresh automatic status, manager override remains authoritative. Quiz-first/watch-first, relink passed/unpassed/null, live-proof and trusted-coverage fixtures tested. Photo/playback endpoints remain deferred; synthetic DB proof/coverage fixtures do not claim integrations.
6. **P2 order:** RFC3339Nano whole-second `Z` and fractional `.` text order differs from chronology. Student deadline and submission sorts use parsed instants plus documented deterministic ID ties, including offset-equivalent existing timestamps. No migration or timestamp rewrite. Existing bounded finalizer candidate scan retained.
7. **Dashboard gap:** numeric assertions across student/manager/admin pin zero sessions (`0%`), zero quizzes (`null`, score criterion satisfied), hidden exclusion, unattempted denominator zero, official score/time/ID ties, watched=attended credit, future/pending exclusion, required quizzes and unrounded score/attendance thresholds. No trivial coverage-only changes.

### Changed files for this correction

- `backend\internal\app\core.go`, `auth.go`, `accounts.go`, `attempts.go`, `attendance.go`, `sessions.go`; new `proxy.go`.
- New focused tests: `review_regression_test.go`, `credential_test.go`, `proxy_test.go`, `quiz_review_test.go`, `attendance_review_test.go`, `dashboard_numeric_test.go` in `backend\internal\app\`.
- `backend\internal\config\config.go`, `config_test.go`; `backend\.env.example`.
- `docs\task-state.md`, `docs\FEATURES.md`, `docs\DECISIONS.md`, `docs\DEPLOYMENT.md`. Approved architecture/API and draft unchanged; no dependencies, migrations, routes or frontend added. Existing unrelated work preserved; folder has no Git metadata, so no Git diff available.

### Final concrete verification — commands from `D:\GitHub\School\o365-LMS\backend`

| Command | Result |
|---|---|
| `go test ./internal/app ./internal/config -run 'TestSlow\|TestSubmitOneNanosecond\|TestCutoff\|TestPasswordPreflight\|TestTrustedProxy\|TestSubmitReplay\|TestQuizLists\|TestAttendance\|TestDashboardNumeric\|TestConcurrentDuplicate' -count=1` | PASS exit 0; app 7.619s, config 0.574s |
| `go test ./... -count=1` | PASS exit 0; app 14.278s, config 0.532s, DB 1.032s; all three CLI packages compile |
| `go vet ./...` | PASS exit 0 |
| `go build ./cmd/server ./cmd/seed ./cmd/migrate` | PASS exit 0 |
| `go mod verify` | PASS exit 0, `all modules verified`; no install/download needed |
| `go test ./internal/app -run '^TestRouteInventory$' -count=1` | PASS exit 0; existing inventory still 72 routes |
| VS Code backend diagnostics | No errors found before final auth text-only correction; final compiler/test/vet checks include correction |
| Race suite | NOT rerun: prior evidence CGO_ENABLED=0, gcc/clang absent; no install or retry loop |

### Remaining risks / assumptions / not verified

- High confidence in six bounded local fixes; no production-readiness claim. Deployment assumes Caddy is sole public proxy and backend stays loopback-only; no live Caddy/systemd validation, no production requests/deployment, SMTP or storage requests.
- Existing records remain compatible without migration. Existing stale attendance from older binary reconciles on creation/ensure, grading or relinking; no global historical backfill performed. Request lists/dashboards and finalizer candidate scan retain previously documented scaling limits.
- Race instrumentation and target Linux 1vCPU/1–2 GB performance remain unverified. Slow-body requests still consume bounded HTTP slots until server read timeout, but do not hold DB writer; bcrypt has two slots. Per-IP/NAT and process-local limiter limitations documented.
- **72/83 routes remain delivered; same 11 deliberately deferred.** No scope expansion, agents, account/router changes, real secrets, global installs or service requests. Temporary tests use isolated SQLite/local HTTP; no workspace `.env`, DB, executable or log artifacts created.

## Final verification checkpoint — 2026-11-14

- Second bounded six-fix review: **no actionable remaining findings**, per supplied reviewer result; **static review only**, not external/runtime certification. This pass changed only this checkpoint; no implementation edits or delegation.
- Commands below ran independently from `D:\GitHub\School\o365-LMS\backend`. Process-local `GOPROXY=off`, `GOSUMDB=off`, `GOTOOLCHAIN=local` prevented dependency/toolchain downloads; no tools installed or real external services called.

| Command | Final actual result |
|---|---|
| `go test ./... -count=1` | PASS, exit 0; app 14.334s, config 0.653s, DB 1.611s; migrate/seed/server packages report `[no test files]` |
| `go vet ./...` | PASS, exit 0; no diagnostics |
| `go build ./cmd/server ./cmd/seed ./cmd/migrate` | PASS, exit 0; no output, no workspace binaries emitted |
| `go mod verify` | PASS, exit 0; `all modules verified` |
| `go test ./internal/app -run '^TestRouteInventory$' -count=1 -v` | PASS, exit 0; `implemented routes: 72`; summary-confirmation run: test 0.22s, package 0.407s. First invocation exited 0 but tool summarized route lines; after inspecting completed state, repeated only this local read-only test to recover explicit count/PASS output. |

- Cleanup: before/after workspace scans found no actual `.env`, SQLite DB/WAL/SHM, binaries, logs or generated test outputs. Preserved existing `backend\.env.example` and `backend\internal\app\coverage_test.go`. Workspace file count remained 49. Removed only temporary tool-output file generated by this verification outside workspace; no existing/real data deleted. Standard Go caches retained.
- **Delivery remains 72/83 routes implemented, 11 deferred; local checks passed. Not complete MVP or production ready.** External integrations, Linux runtime, race instrumentation and target-hardware capacity remain unverified. Race not retried: known CGO/compiler absence. No deployment performed.

## Historical backend completion plan — 2026-11-14 (completed; superseded)

User approved remaining backend coding only; no frontend, delegation, live services, deployment, production changes or real object deletion. Root instructions and all six approved/current docs read; no nested instructions found.

- Observed: material create regression returns 404 (`TestMaterialExternalCRUDAndGuards`, exit 1). Eleven routes remain absent. Existing request transaction architecture would hold sole writer if network validation were inserted directly into handlers.
- Observed: actual `.env.example` already comments prose lines; supplied template failure is not reproduced in current snapshot. Add parser regression and update coupled settings, without inventing prior corruption.
- Invariants: fresh auth/class/session/enrollment before signing/replay; verified immutable-to-client bytes; atomic attachments and revocation/code rechecks; manager override; trusted duration only; no academic deletion.
- Plan: storage/material vertical slice, photo attendance, provider/playback/retention, then full verification/docs. Storage finalization streams staging bytes to bounded temporary disk, validates, and writes a fresh server-only destination. Presigned staging PUT is NOT immutable. No network inside SQLite writer; attachment rechecks registry and current authorization transactionally. Cleanup claims candidates before network and prevents later attachment.
- Verification so far: missing material route reproduced locally; existing baseline evidence above preserved. New implementation and checks in progress, not complete.

## Historical next action (completed; not active)

At that checkpoint: complete storage/material tests and bounded finalization, then attendance and playback/cleanup. Coding subsequently completed as recorded above. External integration and deployment remain approval-bound; Linux race and target-hardware capacity remain unverified.
