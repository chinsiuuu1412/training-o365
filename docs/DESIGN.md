---
name: "LMS • CLB o365-HUST"
description: "Approved design system for LMS • CLB o365-HUST (with first frontend vertical slice implementation evidence)."
status: active-vertical-slice
approved_at: 2026-11-14
product_name: "LMS • CLB o365-HUST"
theme: light-only
accessibility_target: WCAG-2.2-AA
colors:
  primary: "#1060B0"
  on_primary: "#FFFFFF"
  accent_decorative: "#209FE0"
  page: "#F4F8FC"
  surface: "#FFFFFF"
  text: "#14263D"
  success: "#166534"
  warning: "#854D0E"
  error: "#B91C1C"
  focus: "#1060B0"
typography:
  body:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    lineHeight: 1.5
  secondary:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.45
rounded:
  controls: "8px"
  panels: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on_primary}"
    rounded: "{rounded.controls}"
    height: "44px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.controls}"
    height: "44px"
---

# Design System: LMS • CLB o365-HUST

## Current scope caveat — 2026-11-15

Technical visual tokens, authorized assets, typography, spacing and accessibility targets below remain unchanged. **Workflow/API examples and prior frontend evidence below are historical pre-v2**, not current backend instructions or proof of compatibility. [Approved workflow v2](new-approved/user-workflow-guideline.md) controls product behavior/title; [API definitions](API_DEFINITIONS.md) documents 94 current routes under unchanged `/api/v1`, replacing legacy 83-route contract. Existing frontend code/tests remain untouched and incompatible; no v2 browser/runtime completeness claim.

Historical invitations/Teacher-confirm/photo/upload/signed URL/video-credit/average-score examples and `/student/timetable` are not MVP features. Current MVP uses Student requests/cycles, code attendance/Manager override, Test/Assignment saved revisions, fixed-denominator progress, in-app inbox and HTTPS Library links. Same-origin auth remains supported; prior separate Pages/Tunnel API target deferred, no CORS work. Product public-page workflow takes precedence over older “no marketing/decorative animation” scope statements; no visual redesign in this docs phase. [Frontend handoff](FRONTEND_SURFACE_CONTRACT.md), [deferred media boundary](FRONTEND_VIDEO_INTEGRATION.md), [current decisions](DECISIONS.md).

## Overview

Design system lives at `docs/DESIGN.md`; it is not auto-discovered from a root `DESIGN.md`. Future agents must read this file directly. Approved design seed — 2026-11-14; first frontend vertical slice implemented in `frontend/` (auth/account, student overview/timetable/classes/read-only class detail, shared announcements inbox, and staff overview notice) and verified in local headless Edge at `1440×900` and `390×844` (`.impeccable/review/desktop.png`, `.impeccable/review/mobile.png`) plus live DOM/keyboard checks. Quiz runner, attendance mutations/video, and staff management UI remain out of slice; full WCAG 2.2 AA and cross-OS accessibility certification remain unverified.

- **Product & Direction**: **LMS • CLB o365-HUST**, a light-only MVP **Club study planner** for MOS courses run by CLB o365-HUST. Visual tone is youthful, welcoming, and visibly club-branded without corporate stiffness or childish gamification.
- **Role & Device Priorities**: Student-first while providing full design coverage for `student`, `class_manager`, and `admin`. Students use phones for attendance and quick checks, and PCs for study and tests; staff primarily use PCs.
- **Localization & Formatting**: 100% Vietnamese (`vi-VN`) user-facing copy, labels, and errors. All dates and local wall-clock session times use `Asia/Ho_Chi_Minh` (current class `end_date` is date-only and expires at next Vietnam midnight, exclusive; display computed `expires_at` from UTC RFC3339 per [API Definitions](API_DEFINITIONS.md#1-wire-conventions)). Percentages are compared unrounded and displayed with locale-aware `vi-VN` decimal formatting at two decimal places (for example, `80,00%`). Wire values remain JSON numbers.
- **Accessibility Target**: WCAG 2.2 AA target (unverified and not certified until browser/assistive-tech testing).
- **Brand Assets & Club Logo**:
  - Approved visual reference: [CLB o365-HUST Facebook profile](https://www.facebook.com/o365.hust) profile photo (viewed 2026-11-14: blue mark on pale ground).
  - User permits using club logos and branding for **LMS • CLB o365-HUST**. Supplied source assets are present in `assets/logo/`: 1 PSD (`Logo o365-01.psd`, header-verified only) and 5 raster PNGs (verified signature, decode, dimensions, and alpha range). No vector source (SVG/AI/EPS) or official club brand guide is supplied.
  - Do not redraw, recolor, or stretch the logo; do not hotlink ephemeral Facebook CDN URLs in production; and do not use separate HUST crests or Microsoft logos. Supplied files do not establish official club color codes or legal provenance beyond user permission.
  - **Variant Selection (Resolved for Current Vertical Slice)**: Selected transparent PNG [Logo o365-01.png](<../assets/logo/Logo o365-01.png>) (`4500×4500`, `Format32bppArgb`) and resized via `ffmpeg` (without redrawing, recoloring, or stretching) to `frontend/public/logo-o365.png` (`128×128`) for light-background header/login and `frontend/public/favicon.png` (`64×64`) for favicon, with PNG `tEXt` origin provenance embedded. Small-size legibility across additional browsers/devices remains an ongoing visual check.

  | Asset | Format & Size | Dimensions | Verified Alpha / Header Notes |
  | :--- | :--- | :--- | :--- |
  | [Logo dành cho ảnh-01.png](<../assets/logo/Logo dành cho ảnh-01.png>) | PNG (`Format32bppArgb`), 205,775 B | `4500×4500` | Alpha `255..255` (`0.0%` transparent; fully opaque despite 32bpp format) |
  | [Logo o365 1-01.png](<../assets/logo/Logo o365 1-01.png>) | PNG (`Format24bppRgb`), 529,219 B | `4500×4500` | No alpha channel (`24bppRgb`; 100% opaque) |
  | [Logo o365 mờ-01.png](<../assets/logo/Logo o365 mờ-01.png>) | PNG (`Format32bppArgb`), 211,573 B | `4500×4500` | Alpha `0..255` (`0.1%` / 26,999 px transparent, 4,507 px semi, 20,218,494 px opaque) |
  | [Logo o365-01.png](<../assets/logo/Logo o365-01.png>) | PNG (`Format32bppArgb`), 985,680 B | `4500×4500` | Alpha `0..255` (`60.1%` / 12,169,843 px transparent, 35,842 px semi, 8,044,315 px opaque) |
  | [Logo o365-02.png](<../assets/logo/Logo o365-02.png>) | PNG (`Format32bppArgb`), 588,262 B | `8000×4500` | Alpha `0..255` (`90.7%` / 32,649,789 px transparent, 32,743 px semi, 3,317,468 px opaque) |
  | [Logo o365-01.psd](<../assets/logo/Logo o365-01.psd>) | PSD (`8BPS` v1), 2,170,581 B | `2250×2250` | Header only: 4 ch, 8-bit RGB; layers/full decode/editability not validated |
- **Normative Token Scope**: Tokens in this document are normative for **future frontend implementation**, not claims of an existing implementation or verified official club brand color codes.
- **Security & Deployment Boundary**:
  - Frontend must use cookie credentials (`credentials: "same-origin"` in same-origin setups; `credentials: "include"` if cross-subdomain) with `HttpOnly; Secure; SameSite=Lax` session cookies and an in-memory `X-CSRF-Token` from `/api/v1/auth/login` or `/api/v1/auth/me`. Never store JWTs, passwords, or signed URLs in `localStorage` or `sessionStorage`; never cache or log signed URLs; add no third-party telemetry.
  - Current auth topology remains same-origin SPA/API. Earlier separate Cloudflare Pages/Tunnel API target is deferred; no credentialed CORS/preflight or Cloudflare client-IP work implemented. See [current decisions](DECISIONS.md#6-frontend--design--deployment-limits) and [deployment boundaries](DEPLOYMENT.md).
- **Authoritative References**: [Product Brief](../PRODUCT.md), [Architecture](ARCHITECTURE.md), [API Definitions](API_DEFINITIONS.md), [Features](FEATURES.md), [Frontend Video Integration](FRONTEND_VIDEO_INTEGRATION.md), and [Decisions](DECISIONS.md).

## Colors

Light-only MVP palette. Calculated WCAG 2.2 contrast ratios (verified against sRGB luminance):

| Token | Hex | Role & Usage | Verified Contrast |
| :--- | :--- | :--- | :--- |
| `primary` | `#1060B0` | Primary buttons, active nav, key links, focus ring | `6.32:1` with `#FFFFFF`; `5.92:1` on `#F4F8FC` |
| `on_primary` | `#FFFFFF` | Text and icons on `primary` | `6.32:1` on `#1060B0` |
| `accent_decorative` | `#209FE0` | Decorative accents, illustrations, non-text highlights only | `2.96:1` on `#FFFFFF` (NEVER small text or essential UI indicators) |
| `page` | `#F4F8FC` | App canvas background | `14.32:1` with `#14263D` |
| `surface` | `#FFFFFF` | Cards, panels, tables, dialogs, bottom nav | `15.28:1` with `#14263D` |
| `text` | `#14263D` | Primary body text and headings | `15.28:1` on `#FFFFFF`; `14.32:1` on `#F4F8FC` |
| `success` | `#166534` | Passed quiz, `attended`, `watched_video`, completion met | `7.13:1` on `#FFFFFF`; `6.68:1` on `#F4F8FC` |
| `warning` | `#854D0E` | `awaiting_approval`, `pending` review, approaching deadline | `6.85:1` on `#FFFFFF`; `6.42:1` on `#F4F8FC` |
| `error` | `#B91C1C` | Confirmed validation failures, `missed`, destructive actions, confirmed `409`/`410`/`503` failures | `6.47:1` on `#FFFFFF`; `6.06:1` on `#F4F8FC` |
| `focus` | `#1060B0` | Visible `:focus-visible` outline (`2px` solid + offset) | `6.32:1` on `#FFFFFF` |

- **Palette Discipline**: Do not introduce new color primitives without marking them unresolved/proposed. Use existing `primary` and semantic colors for meaningful borders and focus states. Subtle tonal borders, muted secondary text, and hover washes may use documented opacity steps of `#14263D` or `#1060B0` (keeping secondary text >= `4.5:1` on `#FFFFFF` and `#F4F8FC`), rather than inventing an unsanctioned palette.
- **Non-Color Indicators**: Every status chip, validation message, and state badge must pair text and an icon — never rely on color alone.

## Typography

- **Font Stack (Zero Download)**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Vietnamese diacritics and glyph rendering across target Windows, macOS, iOS, and Android browsers remain to be visually verified after frontend build.
- **Base & Secondary Sizes**:
  - Body text: `16px` (`1rem`), line-height `1.5`. Never shrink quiz/exam question or option text below `16px`.
  - Secondary / metadata / table caption text: `14px` (`0.875rem`), line-height `1.45`. Never use tiny unreadable sub-`14px` exam body or critical error copy.
- **Hierarchy & Numerals**:
  - Clear heading scale using weight (`600`–`700`) and size steps for page title, section header, and card title.
  - Use `font-variant-numeric: tabular-nums` for countdown timers, attendance codes, scores, percentages (for example, `80,00%` in `vi-VN`), and timetable hours.

## Layout

### System-Wide Layout & Navigation

- **Spacing Scale**: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`.
- **Density**: Student views use airier spacing (`16px`–`24px` card padding/gaps); staff (`class_manager`, `admin`) views support denser, readable management tables (`12px`–`16px` padding).
- **Responsive Content-First Behavior**: Adapt layout to content width without assuming rigid unverified pixel breakpoints. Long Vietnamese names, class titles, and quiz questions must wrap cleanly (`overflow-wrap: break-word`) without overlapping controls or clipping.
- **Reflow & Zoom Targets**: Support `320` CSS px viewport width, `200%` text zoom, and `400%` browser zoom reflow (horizontal scroll permitted only for essential dense data tables, never hiding critical row actions).
- **Navigation by Role**:
  - Keep tab order logical and match visual order; mark active navigation item with `aria-current="page"`.
  - **PC (All Roles)**: Persistent left sidebar with role-scoped navigation + labelled account header menu (profile, change password via `POST /auth/change-password`, logout).
  - **Student Phone**: Bottom navigation bar with 4 labelled tabs: `Tổng quan`, `Lịch học`, `Lớp học`, `Thông báo`, respecting `env(safe-area-inset-bottom)` safe-area padding, plus a labelled account header menu. Class invitations live inside `Lớp học` with a pending count badge.
  - **Manager / Admin Phone**: Labelled header/drawer menu instead of crowded bottom tabs, keeping full access to authorized tools on narrow screens.
  - **Class Detail Sections (`Tiến độ`, `Buổi học`, `Bài tập`, `Tài liệu`)**: Consistent 4-section structure inside a class; only render staff authoring/management controls when authorized for the caller's role and active class state.
  - **Quiz Runner**: Suppress unrelated global navigation (sidebar/bottom nav) to prevent accidental exit while preserving a persistent save/submit/cutoff status header.

### Student Overview Composition

- **Desktop**: Main column displays today's and this week's **Weekly Agenda** (`GET /api/v1/student/timetable`, max 31-day range, approved sessions only); side column displays **Upcoming Work & Deadlines** (near-deadline 48h quizzes, pending invitations count, unread announcements) followed by **Course Progress** summary.
- **Mobile**: **Agenda first** (today/this week), followed vertically by deadlines/quick attendance actions, then class progress.

## Elevation & Depth

- **Flat Surface Model**: Clean `#FFFFFF` cards and panels over the `#F4F8FC` page background. Separate surfaces with thin tonal borders (e.g., `#14263D` at low opacity), not heavy drop shadows.
- **Motion**: Restrained `120–180ms` functional transitions (hover, drawer open, toast enter/exit). Respect `prefers-reduced-motion: reduce` by disabling non-essential transitions. Zero decorative or celebratory animation.

## Shapes

- **Border Radius**:
  - Controls (buttons, form inputs, select boxes, status chips): `8px`.
  - Panels (cards, tables, modals, drawers): `12px`.
- **Hit Targets**: All primary buttons, nav items, form fields, and interactive controls must meet minimum `44px` width and height; short icon controls must provide a `44px × 44px` hit area. Keep button labels readable.

## Components

All components must preserve the exact API contract in [API Definitions](API_DEFINITIONS.md) and [Frontend Video Integration](FRONTEND_VIDEO_INTEGRATION.md) without inventing new endpoints, DTO fields, or permissions.

### Buttons & Interactive Triggers
- Variants: Primary (`#1060B0` fill, `#FFFFFF` text), Secondary (`#FFFFFF` fill, thin border, `#14263D` text), Destructive (`#B91C1C` fill, `#FFFFFF` text).
- States: Idle, Hover/Focus, Busy/Pending (spinner + disabled double-submit), and Retry action when recoverable network errors occur.
- Focus ring: Use a white separation gap with a `2px` primary-color outline on primary and destructive controls; a primary outline alone is not distinct against primary fill.

### Form Inputs, Validation & Focus
- Minimum `44px` height, `8px` radius, visible `<label>` above every field (never placeholder-only). Controls must also have minimum `44px` width, or a `44px × 44px` hit area for short icon controls. Keep button labels readable.
- Field-level validation errors map `error.details.fields.<field_name>` directly below the input in `#B91C1C` with an error icon and `aria-describedby`.
- Unknown JSON fields are rejected by backend (`400 invalid_request`); forms must send exact documented payloads only.

### Status Chips & Enum Mapping
Always render icon + Vietnamese text label; never conflate separate backend enums:
- **Attendance (`AttendanceStatus`)**: `missed` (*Chưa được ghi nhận điểm danh*), `awaiting_approval` (*Chờ duyệt điểm danh tại lớp*), `attended` (*Đã được duyệt điểm danh*), `watched_video` (*Đã ghi nhận học bù qua video*).
- **Makeup Review (`MakeupReviewStatus`)**: `none`, `pending` (*Đã gửi yêu cầu học bù, chờ quản lý duyệt*), `approved`, `rejected` — displayed separately from `AttendanceStatus` and `manual_override_active` (*Kết quả điểm danh do quản lý quyết định*).
- **Timetable vs Session Schedule**: `timetable_requests.status` (`pending | approved | rejected`) and `class_sessions.schedule_status` (`pending_approval | approved | rejected`) are distinct entities and must be labeled separately.

### Weekly Agenda & Progress Displays
- Weekly agenda uses `GET /api/v1/student/timetable` (approved sessions across active enrolled classes, max 31 days).
- Progress and completion criteria (`GET .../dashboard`) compare thresholds unrounded and display percentages with locale-aware `vi-VN` decimal formatting to two decimal places:
  - `0` approved past/current sessions yields `0,00%` attendance in `vi-VN` display.
  - `0` published quizzes yields `avg_quiz_score: null` (criterion automatically satisfied); otherwise unattempted published quizzes count as `0`.

### Responsive Tables
- Use semantic `<table>`, `<thead>`, `<th>` (`scope="col"`), and `<tbody>`.
- On narrow viewports, allow horizontal scroll only when essential for dense staff tables, or stack secondary metadata while keeping critical action buttons accessible and visible.

### Dialogs, Drawers & Destructive Confirmations
- Modal dialogs and modal mobile drawers must trap keyboard focus, close on `Escape` (except blocking submission/cutoff states where unsafe), and return focus to the trigger element on close. Nonmodal drawers must not trap focus.
- Require explicit confirmation dialogs for destructive or irreversible actions: kicking a student, submitting a class leave request (mandatory `reason`, max 2,000 chars), deleting a quiz/material, archiving/unarchiving a class, and starting a quiz (displaying real server `duration_seconds`, `deadline`, and Test rules).

### Notifications, Toasts & Persistent Alerts
- Use toasts only for transient non-critical confirmations (e.g., *"Đã đánh dấu đã đọc"*).
- Distinguish commit-unknown/network-unknown states from confirmed failures: use warning text *"Chưa xác nhận được kết quả"* with recovery actions for unknown outcomes; use error styling only for confirmed failures. An unknown `pending` state is not a failure.
- Never rely solely on auto-dismissing toasts for critical errors (`409` conflicts, `410` cutoff expired, `503` unavailable integration, network-unknown submission/upload states); render persistent inline alert banners with explicit recovery actions.

### Loading, Empty, Error, Unauthorized & Archived States
- **Loading**: Structural skeletons matching card/table layout; `aria-busy="true"`.
- **Empty**: Clear Vietnamese guidance for empty timetable, no invitations, no materials, or `attendance === null` (*"Chưa có bản ghi điểm danh"* — never infer `missed` from `null`).
- **Session Expiry (`401`)**: Ask user to reauthenticate and recover only acknowledged server data; never promise recovery of unsaved local edits.
- **Permission (`403`)**: Explain permission denial separately from archive state.
- **Archived (`403 class_archived`)**: Students and Class Managers are blocked (`"Lớp học đã kết thúc và được lưu trữ. Bạn không còn quyền truy cập."`) and archived classes are locked/hidden in their views. Admin retains metadata/archive management and read-only teaching records via `/api/v1/admin/classes/{classId}/...`.
- **Rate Limit (`429`)**: Honor `Retry-After`; do not rapidly auto-retry or change the idempotency key.
- **Loaded Content**: Preserve already-loaded state while refreshing or recovering; do not flash empty or error state over it.
- **Unavailable Integrations (`503`)**: When SMTP, object storage, or YouTube metadata capacity returns `503`, display an honest unavailable state; never pretend email delivery, upload, or telemetry succeeded.

### Attendance & Makeup Video Flows
See [Frontend Video Integration](FRONTEND_VIDEO_INTEGRATION.md) for the exact state machine and single-flight controller:
- **Live In-Class Attendance**: Show **Attendance Code** and **Photo Proof** (`<=5 MiB` JPEG/PNG/WebP via 5-min presigned PUT) prerequisites individually alongside linked `post_session` quiz status. Code + photo persist before quiz pass while `status` remains `missed` until all prerequisites pass (`awaiting_approval`).
  - If browser camera permission is declined or unavailable, offer permitted existing-file upload (`<input type="file" accept="image/jpeg,image/png,image/webp">`) — do not invent a webcam-only constraint.
  - Provide upload preview and retry; never show check-in success until `POST .../attend` (with UUID `Idempotency-Key`) returns `200`.
- **Makeup Video (`watched_video`)**:
  - Supported providers (YouTube with server-trusted duration) require `>= 90%` distinct watched coverage (1x playback, sequential `progress` heartbeats, server-elapsed capped) + linked quiz pass. `playback_session.completed` indicates coverage only, not attendance approval.
  - Unsupported embeds or sessions without a linked quiz submit `POST .../watch-video` (UUID `Idempotency-Key`) for manager review (`makeup_review_status = 'pending'`).
  - Manager manual override (`PATCH .../attendances/{studentId}`) sets `manual_override_active = true` and remains authoritative. Never claim browser telemetry proves human attention.

### Quiz Runner & Manager Quiz Authoring
- **Quiz Types**:
  - `test`: `1 + retakes` (`retake_grants`), logs deduplicated `blur` + `visibilitychange` episodes (`POST .../violation`, advisory only, no forced auto-submit), blocks manual submit before `2/3` duration (`422 early_submission`, except cutoff expiration).
  - `homework` and `post_session`: unlimited attempts before `deadline` (if set), no 2/3 block, no violation logging.
- **Draft Autosave, Cutoff & Recovery**:
  - Server cutoff is authoritative with zero grace: `effective_cutoff_at = min(started_at + duration_seconds, deadline)` when `deadline` is non-null; otherwise `effective_cutoff_at = started_at + duration_seconds`.
  - `PUT /quiz-attempts/{attemptId}/draft` sets `expected_revision` to the latest acknowledged server `draft_revision`. On `409 draft_revision_conflict`, fetch current attempt state and reconcile — never automatically overwrite.
  - Never promise local/offline durability; show *"Đã lưu"* only after server acknowledgment, and never show unsaved local edits as saved.
  - On late or network-unknown submission, recover via `GET /quizzes/{quizId}/active-attempt` or `GET /quiz-attempts/{attemptId}` and reuse the same UUID `Idempotency-Key` before any retry.
- **Manager Authoring Freeze**: Once any attempt exists on a quiz, `PUT` and `DELETE` return `409 quiz_has_attempts`; UI must lock question/scoring/timing edits and expose only `PATCH /quizzes/{quizId}/metadata` (`title`, `description`, `show_answers_after_submit`) and `POST /quizzes/{quizId}/retakes` (sets `extra_attempts_granted`).

### Role-Specific Coverage & Excluded Scope
- **Admin**: User management (`@sis.hust.edu.vn` for students, last-active-admin & assigned-manager disable/demote guards, password reset), class CRUD & archive/unarchive (`end_date` Vietnam day boundaries to UTC), timetable request review & direct schedule edit (supersedes pending request), class enrollment/leave management, explicit `recipient_ids` announcement directory grouped by class with cross-page select-all expansion, and read-only inspection of active/archived classes (including answer keys).
- **Class Manager**: Own active classes, session creation/editing (prior approved schedule stays live while change is `pending`), attendance code generation (60–86,400s), photo review & manual attendance override, quiz authoring/metadata/retakes/leaderboard, materials (`<=25 MiB` upload via presign or `https://` link), student invite/kick/leave review, and explicit `recipient_ids` class announcements.
- **Student**: Weekly agenda, enrolled classes (including pre-start), invitations in `Lớp học` with pending count, class sections (`Tiến độ`, `Buổi học`, `Bài tập`, `Tài liệu`), live attendance & makeup video, quiz runner & allowed answer review, shared announcements inbox, Danger Zone leave request, and account `change-password`.
- **Explicitly Excluded (Do Not Invent)**: Public marketing landing page, self-registration, email password-reset flow, bulk broadcast without explicit `recipient_ids`, staff role-switcher, QR/geolocation attendance, certificates, gamification streaks, offline quiz grading/submission, or new backend endpoints.

## Do's and Don'ts

- **Do** keep all user-facing copy in natural Vietnamese (`vi-VN`) and all schedules in `Asia/Ho_Chi_Minh`.
- **Do** pair every semantic color with an icon and Vietnamese text label.
- **Do** enforce `44px` minimum touch targets, `16px` quiz body text, and `14px` minimum secondary text.
- **Do** treat server responses, `effective_cutoff_at`, `draft_revision`, and `manual_override_active` as authoritative.
- **Don't** use `#209FE0` for small text or essential UI indicators on white (`2.96:1` contrast).
- **Don't** hotlink Facebook CDN logo URLs, redraw/recolor the club logo, or add HUST/Microsoft logos.
- **Don't** store JWTs, passwords, or signed URLs in `localStorage`/`sessionStorage`, or display unsaved quiz answers as saved.
- **Don't** infer `missed` from `attendance === null`, or treat `playback_session.completed` as attendance approval.

### Acceptance Checklist (Future Verification — NOT Tests Run)

The following checks are required once frontend implementation begins (none have been executed yet):
1. **Viewport & Reflow**: `320` CSS px width, `200%` text zoom, `400%` zoom reflow, iOS/Android bottom-nav `safe-area-inset-bottom`, and long Vietnamese name/title wrapping without overlap.
2. **Keyboard & Screen Reader**: Focus trap in modals/drawers, return focus on close, `Escape` handling, visible `#1060B0` focus ring, semantic table headers, `44px` hit targets, and WCAG 2.2 AA contrast verification in rendered browser.
3. **Attendance Camera & Upload**: Camera permission decline fallback to existing-file upload (`<=5 MiB` JPEG/PNG/WebP), upload preview/retry, and individual prerequisite status before linked quiz pass.
4. **Network & Concurrency**: Network-unknown quiz submit recovery (`GET /active-attempt` / `Idempotency-Key`), `409 draft_revision_conflict` reconciliation, and `503` unavailable integration banners.
5. **Quiz Rules & Time Cutoff**: `effective_cutoff_at` zero-grace finalization, `Test` 2/3 duration `422 early_submission` block, deduplicated `blur`+`visibilitychange` logging without auto-submit, and `409 quiz_has_attempts` manager edit freeze.
6. **Role, Archive & Empty States**: `403 class_archived` enforcement for student/manager vs admin read-only access, explicit `recipient_ids` cross-page selection, `attendance === null`, `0` sessions (`0.00%`), and `0` published quizzes (`avg_quiz_score: null`).
