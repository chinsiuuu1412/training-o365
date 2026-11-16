# Decisions — current approved-v2 baseline

Updated 2026-11-15. Short current record; historical implementation evidence remains in [task-state.md](task-state.md), not competing v1 instructions. [Approved product workflow](new-approved/user-workflow-guideline.md) has priority over conflicting old technical proposals. Technical docs describe implementation, not permission to expand MVP.

## 1. Runtime / data

Go 1.24+ module, standard `net/http`, pure-Go `modernc.org/sqlite`, bcrypt via `x/crypto`; no new dependencies. SQLite WAL, one immediate writer, eight read-only readers. Local filesystem/single API process. Data integrity outranks response speed. 1 vCPU/1–2 GB and ~200 req/s remain unmeasured targets; no memory/performance guarantee.

**Clean baseline 001, `backend_contract=approved-v2`, migration version 1.** Legacy/nonmatching nonempty DB rejected read-only before WAL/schema mutation. No silent upgrade, reset, down migration or data deletion. Old DB conversion needs separately approved migration and rehearsal; synthetic development uses separate fresh path. Marker/version acceptance does not validate arbitrary schema drift.

## 2. Contract / auth / account

94 current routes replace historical 83. `/api/v1` retained; v2 means breaking workflow/schema, not URL prefix. [API contract](API_DEFINITIONS.md) records handler DTOs, numeric raw-row flags, nullable fields and errors. Existing frontend/tests remain legacy and incompatible; no frontend changes in backend/docs phases.

Same-origin cookie/CSRF/Origin design unchanged: HS256 JWT plus DB sessions/token version, Secure HttpOnly SameSite=Lax cookie, in-memory CSRF token, strict Origin on non-GET. No new CORS/Cloudflare-header work. Narrow single-hop proxy-overwritten X-Forwarded-For trust only.

Admin bootstrap once on empty users; Admin provisions Student/Manager, manually delivers credentials. No Admin management/role mutation/self-service reset/SMTP. Student 9-digit MSSV string (`^[0-9]{9}$`, 4-digit enrollment year + 5-digit student ID, e.g. `202512345`) unique among Students; school_or_institute/university_class/VN mobile required, gender optional; Student HUST email required. Staff profile null. Manager suspension allowed with assignments retained. Relevant password/email/status changes revoke sessions.

## 3. Class / enrollment / schedule

Class code/capacity/two thresholds; date-only end_date expires next Vietnam midnight, exclusive. Manager sets positive fixed total_sessions once. Reassignment requires reason and explicit confirmation, immediate authority, preserved history.

Student requests/cancels; current Manager approves/declines. Ten-minute decline cooldown, changed Student reason, three lifetime pair declines; capacity checked transactionally on request/approval. Removal reason required; new approval creates new enrollment cycle/ID with isolated credit/attempts/grants. No invitations/self-leave/archive in MVP.

Manager saves/submits schedule draft; Admin approves/rejects (reject reason required). Keep old approved schedule pending/rejected replacement. Started/ended approved schedules immutable. No Teacher-confirm or direct Admin schedule edits.

## 4. Attendance / Quiz / progress

Attendance code within approved `[start,end)` window; three durable wrong attempts committed even on 422. Manager override after start authoritative with reason/before-after audit; no Admin grade approval/edit. Absence autoapproved/no credit/Manager notice. No photo, watched-video credit or Quiz prerequisite.

Test/Assignment single-choice equal weight. Defaults one/ten attempts; Assignment custom positive cap. Freeze Quiz PUT after any attempt. Continuous server clock; saved-revision autosave then submit with no new answers. Test manual submit at exact 2/3 configured duration; deadline may auto-submit sooner. Start cutoff min(duration end,effective deadline), no grace. Startup/worker finalizes saved answers even after access loss. Higher best submitted score retained; no Student answer key (`review:null`), telemetry penalty or Quiz result mutation.

Grants target explicit current enrollment IDs, positive extra attempts and reason, future deadline strictly later for every recipient; atomic Student/Admin notices; no active-cutoff extension. Start/submit UUID idempotency keys permanently cycle-bound; current authorization first. Start replay rebuilds live result; no 24h key cleanup. Writer/savepoint keeps due finalization while rolling back rejected action; one transaction clock prevents boundary inconsistencies.

Attendance/fixed sessions and distinct passed/all published Quizzes are separate tracks. Zero denominator gives 0; unrounded thresholds. Completed requires all fixed required approved sessions ended; dynamic incomplete reasons, no average/certificate/seal/exception prerequisite. Student old cycles summary-only; Admin/current assigned Manager retain historical GET access.

## 5. Inbox / library

In-app DB inbox only; explicit deduped recipient IDs, all-or-nothing scope validation, recipient-private read/unread. Admin sends active Student/Manager; Manager sends active currently enrolled Students in unexpired assigned classes. No sent box or upstream compose permission.

Library HTTPS Document/Video links, optional same-class session/expiry. YouTube Video exemption applies only material expiry, never class/enrollment/removal. Both staff removals need reason; Admin removal notifies Manager. No upload/storage/SMTP/provider/cleanup config or CLI remains. External links learned cannot be revoked by LMS.

## 6. Frontend / design / deployment limits

Legacy `frontend/` React 18/TypeScript/Vite/Tailwind vertical slice remains historical and incompatible with v2. New `frontend-mock-v2/` implements the approved-v2 MVP across Student, Class Manager, and Admin using immutable compile-time public config (`VITE_API_ORIGIN`, `VITE_API_BASE_PATH` validated in `vite.config.ts` and frozen in `src/config/env.ts`; no `window.__ENV__`), unified `ProgressBar` / `ConfirmDialog` (with accessible form children), confirmed-logout session/CSRF preservation (clearing only on 200 or 401), `StaffEnrollmentRow` normalization in `services.ts` matching Go's flat enrollment DTO, and verified Student Quiz autosave/409/2-of-3/UUID-idempotency behavior. Keep Vietnamese UI, authorized logo derivatives, light-only palette/system typography/spacing/44px targets from [DESIGN.md](DESIGN.md). Product workflow defines **CLB o365 HUST - Khóa học Kĩ năng mềm**.

Same-origin reverse proxy remains runtime-compatible auth topology, not authorization to deploy. Earlier Cloudflare Pages + separate Tunnel API origin target remains deferred: credentialed CORS/preflight and proxy trust design absent. No new gateway settings or external operations.

Next: independent review of `frontend-mock-v2/` and docs, plus authenticated interactive browser E2E across all 3 roles and WCAG 2.2 AA / cross-OS visual checks (outstanding). Linux race/hardware/performance verification also remain outstanding.
