# Frontend v2 (`frontend-mock-v2/`)

Approved-v2 MVP React + TypeScript + Vite + Tailwind frontend for **CLB o365 HUST - Khóa học Kĩ năng mềm**, targeting the 94-route `/api/v1` Go backend. Preserves the light-only blue/white/slate design tokens (`#1060B0`, `#FFFFFF`, `#F4F8FC`, `#14263D`), Vietnamese (`vi-VN`) copy, Vietnam time formatting (`Asia/Ho_Chi_Minh`), 44px touch targets, and responsive `AppShell` navigation (desktop 240px sidebar, Student mobile 4-tab bottom bar, Staff mobile labelled drawer).

## Setup & Public Compile-Time Config

- Working directory: `frontend-mock-v2/`
- Node `>=22.6.0` (required for `node --experimental-strip-types --test`) and Go `>=1.24` (required by `tests/integration-go.test.ts`).
- Install locked dependencies: `npm ci` (existing `node_modules` already installed in workspace; do not bypass lockfile).
- Public compile-time environment variables (see `frontend-mock-v2/.env.example`, **no secrets**):
  - `VITE_API_ORIGIN`: optional API origin (`http://` or `https://`, no path). Leave empty for same-origin proxy hosting.
  - `VITE_API_BASE_PATH`: API path prefix starting with `/` and without trailing `/` (default `/api/v1`).
  - `VITE_DEV_PROXY_TARGET`: Vite dev/preview proxy target (default `http://127.0.0.1:8080`).
  - `VITE_DEV_PROXY_PREFIX`: Vite dev/preview proxy prefix starting with `/` (default `/api`).
- Config validation & immutability: `vite.config.ts` validates `VITE_API_ORIGIN`, `VITE_API_BASE_PATH`, `VITE_DEV_PROXY_TARGET`, and `VITE_DEV_PROXY_PREFIX` at build/dev startup; `src/config/env.ts` exports `Object.freeze` `PUBLIC_API_CONFIG` compiled statically into `dist/`. No `window.__ENV__` or runtime env loader is used.

## Same-Origin Proxy & Static Build

- Auth uses `credentials: "include"` with server-set `HttpOnly; Secure; SameSite=Lax` cookie and in-memory `X-CSRF-Token` from `/api/v1/auth/login` or `/api/v1/auth/me` (never stored in `localStorage`/`sessionStorage`).
- Vite `server.proxy` and `preview.proxy` forward `VITE_DEV_PROXY_PREFIX` to `VITE_DEV_PROXY_TARGET` with `changeOrigin: false` so browser `Origin` matches `SITE_ORIGIN`.
- Production static build (`npm run build`) outputs `frontend-mock-v2/dist/`. Host behind a same-origin reverse proxy routing `/api/v1` to the Go backend (no CORS or separate Pages/Tunnel origin).

## Workflow Coverage

- **Public / Auth / Account**: `PublicIntroLogin`, `AccountPage` (password change revoking sessions), session restore (`getMe`), confirmed-logout session preservation on network/5xx failure (`App.tsx`, `services.ts`, `AppShell.tsx`).
- **Student**: `StudentDashboardPage`, `StudentSchedulePage`, `StudentClassesPage` (discover/request/cancel/history), `StudentClassDetailPage` (sessions, attendance code + 422 `remaining_attempts`, absence, quizzes, progress bars, HTTPS materials), `StudentQuizRunnerPage` (serialized autosave, `expected_revision`, 409 `draft_revision_conflict` refetch without blind retry, exact 2/3 Test early-submit gate, cutoff countdown, UUID `Idempotency-Key` start/submit, no questions/answer key on submitted result).
- **Class Manager**: `ManagerDashboardPage`, `ManagerClassesPage`, `ManagerClassDetailPage`, `ManagerSessionsTab`, `ManagerEnrollmentsTab`, `ManagerAttendanceTab`, `ManagerQuizzesTab`, `ManagerQuizEditor`, `ManagerMaterialsTab`.
- **Admin**: `AdminDashboardPage`, `AdminUsersPage` (9-digit MSSV `^[0-9]{9}$`, status toggle, password reset), `AdminSchedulesPage`, `AdminClassesPage`, `AdminClassDetailPage` (enrollments, progress bars, audit, material/enrollment removal).
- **Shared Inbox**: `AnnouncementsPage` (paginated recipient directory, read/unread `PATCH`).

## Commands & Executed Checks

From `frontend-mock-v2/`:

- `npm run typecheck` (`tsc --noEmit`): PASS (exit 0).
- `npm run build` (`tsc -b && vite build`): PASS (exit 0).
- `npm test` (`node --experimental-strip-types --test tests/**/*.test.ts`): PASS (24/24 tests: `config.test.ts`, `client.test.ts`, `quiz-state.test.ts`, `manager-loaders.test.ts`, `quiz-runner-controller.test.ts`, `contract-fixes.test.ts`, and `integration-go.test.ts` against a fresh temporary Go v2 backend).
- Headless Chrome CDP check (`1440×900` desktop, `390×844` mobile, and `320×640` overflow check) against `vite` + fresh temporary Go v2 backend:
  - Public intro/login: verified `PublicIntroLogin` renders `"CÂU LẠC BỘ o365 - HUST"` and navigates to login form.
  - Admin flow: UI login, `AdminDashboardPage`, `AdminUsersPage` (plus `ConfirmDialog` keyboard `Escape` close check), `AdminSchedulesPage`, `AdminClassesPage`, `AdminClassDetailPage` (desktop `1440×900` & mobile `390×844`), UI logout.
  - Class Manager flow: UI login, `ManagerDashboardPage`, `ManagerClassesPage`, `ManagerClassDetailPage` (sessions, quizzes, materials tabs after `page_size` pagination fix; desktop `1440×900` & mobile `390×844`), UI logout.
  - Student flow: UI login, `StudentDashboardPage` (progress bars), `StudentClassesPage` (discovery & enrollment request submission), `StudentClassDetailPage` (progress bars, quizzes tab), `StudentQuizRunnerPage` (option selection, autosave `"Đã lưu"`, `ConfirmDialog` `Escape` + submit confirmation, result `"Kết quả bài làm"` / `"Đạt"` without answer key, attempt history `"Lịch sử lượt làm"`), `AnnouncementsPage` (read/unread toggle at `1440×900`, `390×844`, `320×640`).
  - Role review fix DOM check (post-fix `1440×900` CDP pass): verified `StudentClassesPage` and `StudentClassDetailPage` render `Quản lý: Quản lý Kiểm Thử` (no `#id` fallback) and `StudentClassDetailPage` renders an enabled `"Tiếp tục làm bài"` button for an active 1-attempt Test (`used == allowed`), navigating directly into `StudentQuizRunnerPage` (`1+1=?`).
  - Observed 0 runtime/console exceptions, 0 unexpected HTTP >= 400 errors (only expected initial unauthenticated `401 /api/v1/auth/me` and no-active-attempt `404 /active-attempt`), and 0 horizontal overflow (`scrollWidth <= innerWidth`) across all checked viewports.

## Known Limitations

- Live Quiz Runner `409 draft_revision_conflict` and cutoff expiry UI transitions, plus Manager `429` burst handling, were not triggered interactively in Chrome (those paths are verified via unit tests and `tests/integration-go.test.ts`).
- Full WCAG 2.2 AA assistive-tech / screen-reader audit and cross-OS visual inspection remain outstanding.
