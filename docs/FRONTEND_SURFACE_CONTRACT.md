# Frontend surface / approved-v2 integration handoff

**Status 2026-11-15: backend v2 implemented; legacy `frontend/` remains untouched and incompatible; new `frontend-mock-v2/` implements the approved-v2 MVP surface (build, typecheck, unit tests, and fresh local Go v2 integration suite passing).** Earlier `frontend/` browser/build/test evidence proves only the prior vertical slice against the old API. Existing `frontend/tests/integration-go.test.ts` still encodes old seed/environment/workflow assumptions; do not treat it as v2 acceptance. See [FRONTEND_V2.md](FRONTEND_V2.md) for `frontend-mock-v2/` setup, static compile-time config, coverage, and remaining browser/a11y limitations.

[Approved workflow](new-approved/user-workflow-guideline.md) controls product behavior. [API definitions](API_DEFINITIONS.md) contains exact 94 routes/DTOs/inputs/errors. `/api/v1` unchanged, but workflow/schema v2 breaking. Route overrides alone cannot repair DTO/state changes. No frontend files edited.

## Preserved design / existing surface

- [DESIGN.md](DESIGN.md) tokens remain unchanged: light-only `#1060B0` / `#FFFFFF` / `#F4F8FC` / `#14263D`, system fonts, spacing, 44px targets, Vietnamese UI. Workflow examples there are historical unless confirmed by approved-v2 contract; no redesign here.
- Existing authenticated `Operate` shell: sidebar >=768px, 240px wide, max content 1200px; Student mobile four tabs (`Tổng quan`, `Lịch học`, `Lớp học`, `Thông báo`), account/logout in header; staff mobile labelled drawer. Preserve accessibility/error/empty/loading handling when adapting.
- Existing logo derivatives `frontend/public/logo-o365.png` (128×128) and favicon (64×64) derive from authorized `assets/logo/Logo o365-01.png`, without redrawing/recolor/stretch; embedded provenance. Branding assets/tokens remain, product title/workflow alignment separately part of frontend adaptation.
- Existing slice historically covered auth/account, Student overview/timetable/classes/read-only class detail and inbox; staff management, attendance mutations and Quiz runner not complete. This is history, not current API compatibility.

## Required next integration changes — not implemented here

| UI concern | Current backend contract |
|---|---|
| Overview / schedule | `/student/dashboard` returns class/cycle summaries plus active-only agenda; no `/student/timetable` or `/student/classes/{classId}/dashboard`. Parse instants, show Vietnam times, no client-faked totals. |
| Find Classes | `/student/discover/classes` and `/student/classes/{classId}/preview`; search name/code/Manager. Full unexpired classes visible but cannot request. |
| Enrollment | Student reason/create/cancel, Manager review approve/decline. No invitations/respond. Preserve ten-minute cooldown, changed reason, lifetime three declines; read cycle IDs from history/dashboard/roster, not request IDs. Removal/re-enrollment isolates results. |
| Profile | Student 9-digit MSSV string (`^[0-9]{9}$`, 4-digit enrollment year + 5-digit student ID, e.g. `202512345`), school_or_institute, university_class, VN mobile required, gender optional; staff null. Admin manages Student/Manager only; no role-change/Admin CRUD. |
| Classes / history | Date-only end_date expires next Vietnam midnight exclusive; no start_date/archive toggle. Fixed total_sessions, capacity/two thresholds, reasoned confirmed reassignment. Student expired/removed cycle summary-only; current Manager/Admin historical GET detail. |
| Schedule / attendance | Draft/save/submit then Admin review; no Teacher-confirm. Code in approved `[start,end)`, three persisted wrong tries (422 details.remaining_attempts), Manager override reason/audit authoritative. Absence autoapproved/no credit. Bind enrollment_id. Numeric attendance flags, not status strings. |
| Quiz | Test/Assignment finite caps, open/deadline/duration/pass. Student detail no questions; start/recovery returns Runner, submitted Result omits Quiz/questions, review null always. Staff key never copied into Student state. |
| Autosave / submit | Save entire answers with enrollment_id/expected_revision; await successful increment, submit saved revision only. UUID Idempotency-Key for start/submit; permanent cycle binding. 409 revision conflict refetch, no blind retry. Continuous clock, Test exact 2/3, cutoff saved answers only; active cutoff unchanged by grants. |
| Retake / progress | Explicit enrollment IDs/reason/deadline strictly increased, atomic grants. Best score/pass current cycle. Attendance/fixed total and distinct passed/all published; zero 0, unrounded eligibility, all fixed approved sessions ended. Show incomplete_reasons; no average/watched credit/certificates. |
| Inbox | Shared GET list/detail/PATCH read with true/false. GET detail does not mark read. Raw automated/is_read numeric flags. Admin/Manager recipient directories paginated; select-all expands all pages, sends dedup explicit IDs. In-app only, no email-success copy. |
| Library | HTTPS Document/Video links, same-class optional session/expiry. Both staff DELETE bodies require reason; Admin notifies Manager. No upload/photo/playback controls or watch Attendance. YouTube expiry exemption never overrides class/enrollment/removal. |

After committed writes, refetch/invalidate affected surfaces; other clients refresh/poll (no websocket promise). Manager results refresh cadence <=5 minutes remains UI requirement, not implemented server push. Handle 401 as confirmed session loss, transient restore errors separately; 403 class_expired/material_expired distinct from old class_archived. Preserve loaded data on refresh failure, expose retry, and never show mock success for missing API. Network/5xx write outcome uncertain: inspect current state before retry; grants/announcements lack general idempotency protocol.

## Actual frontend commands — legacy tooling only

Read `frontend/package.json` / lockfile before any install. Node >=22.6.0 required for native TypeScript stripping tests; Go module >=1.24 needed by integration harness. Commands from `frontend/`:

| Command | Script / meaning |
|---|---|
| `npm ci` | Install locked executable dependencies; approval/security review required as normal, not run here |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `tsc -b && vite build` |
| `npm test` | `node --experimental-strip-types --test tests/**/*.test.ts`; old integration fixtures, not v2 verification |
| `npm run dev` | Vite localhost:5173, strict port |
| `npm run preview` | Vite localhost:4173, strict port |

These scripts existing, not evidence of executed/passing v2 checks. Backend fresh synthetic setup: [DEPLOYMENT.md](DEPLOYMENT.md). Do not reset old DB to satisfy old harness.

## Same-origin auth / configuration

Existing client uses credentials include and in-memory CSRF from login/me, clears on 401/logout. No JWT/password/localStorage/sessionStorage/IndexedDB/service-worker persistence. Cookie stays HttpOnly/Secure/SameSite=Lax. Backend Origin exact browser origin, e.g. `http://localhost:5173`; keep host consistent.

Existing local dev/preview proxy config (`changeOrigin:false`):

```dotenv
VITE_API_ORIGIN=
VITE_API_BASE_PATH=/api/v1
VITE_DEV_PROXY_TARGET=http://127.0.0.1:8080
VITE_DEV_PROXY_PREFIX=/api
```

Dev proxy variables unused by built `dist/`; same-origin hosting needs reverse proxy `/api/v1`, not CORS. VITE_API_ORIGIN / VITE_API_BASE_PATH compile-time public settings, never secrets. `VITE_API_ROUTES_JSON` only supports existing RouteCatalog keys and slash-prefixed templates; route mapping does not translate payloads or add missing workflows. Current catalog still names removed `/student/invitations`, `/student/timetable`, class `/dashboard`.

Separate Cloudflare Pages/API-subdomain deployment target remains deferred: backend has no credentialed CORS/OPTIONS or CF-Connecting-IP support. No new CORS work authorized. No deployment or visual verification performed; next approved frontend task must adapt code/fixtures, then run type/build/tests and real browser/mobile/keyboard/error-state checks.
