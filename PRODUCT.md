# Product
<!-- impeccable:product-schema 1 -->

## Current scope — 2026-11-15

[Approved workflow v2](docs/new-approved/user-workflow-guideline.md) controls product scope. Backend approved-v2 MVP implemented locally with **94 routes** replacing legacy 83; `/api/v1` prefix unchanged but workflow/schema breaking. Existing `frontend/` and its integration tests remain legacy/incompatible, untouched; earlier vertical-slice checks are historical, not v2 runtime completion. No end-to-end, deployment, performance/race or live-service certification.

Clean baseline `001_initial.sql` uses `backend_contract=approved-v2`, migration version 1. Nonempty legacy DB rejected, never silently migrated/reset. Preserve old data; use separately approved migration or separate fresh synthetic DB path. [Operator setup](docs/DEPLOYMENT.md).

## Platform
web

## Stack
- Responsive application for phone and PC browsers.
- Frontend: separate React 18, TypeScript, Vite and Tailwind application. Historical auth/account, Student overview/timetable/classes/read-only detail and inbox slice remains untouched and incompatible with v2; Quiz runner, attendance mutations and staff management UI remain incomplete.
- Backend is implemented in Go with SQLite. See [Architecture](docs/ARCHITECTURE.md) and [Features](docs/FEATURES.md).

## Users
- **Students** (`student`): HUST students with email addresses ending in `@sis.hust.edu.vn`. No self-registration; accounts are provisioned by administrators.
- **Class managers** (`class_manager`): Staff responsible for managing their assigned classes.
- **Administrators** (`admin`): Staff responsible for accounts, classes, and approved administrative workflows.
- Product is student-first while covering class managers and administrators. Students use phones for attendance and quick checks, and PCs for study and tests. Staff mainly use PCs.
- Authentication uses local email and password; no third-party sign-in or self-registration.

## Product Purpose
Provide a learning management system for MOS courses run by CLB o365-HUST. Help students participate in classes, track learning and complete quizzes; support class managers and administrators in operating established course workflows.

**Current product display name:** CLB o365 HUST - Khóa học Kĩ năng mềm, per approved workflow. Existing design metadata `LMS • CLB o365-HUST` identifies historical UI shell; brand assets/design tokens remain unchanged.

## Operating Context
- User-facing interface and content are in Vietnamese.
- Phone use matters for classroom attendance and quick checks; PC use matters for student study and tests, and is the primary staff context.
- Provisioned resource target: 1 vCPU and 1–2 GB RAM. Peak load target: approximately 200 requests per second. These are requirements, not validated capacity claims. See [Architecture](docs/ARCHITECTURE.md) and [Features](docs/FEATURES.md) for current verification limits.
- Data integrity is the highest priority. Correct records and submissions take priority over response speed under contention.
- [Approved workflow v2](docs/new-approved/user-workflow-guideline.md) overrides conflicting legacy technical proposals. [API definitions](docs/API_DEFINITIONS.md), [Architecture](docs/ARCHITECTURE.md), and [Decisions](docs/DECISIONS.md) describe current backend; this brief adds no features.

## Capabilities and Constraints
- Backend MVP covers accounts/profiles, classes/capacity, Student enrollment requests/cycles, draft/review schedules, code attendance/Manager override/absence, Test/Assignment saved-revision recovery/grants, fixed-denominator progress/Completed, in-app read/unread and HTTPS Library links. See [Features](docs/FEATURES.md) and [Architecture](docs/ARCHITECTURE.md). Invitations/self-leave/archive, uploads/photos/video credit, SMTP and certificates deferred; no average-score progress.
- Three roles only: `student`, `class_manager`, and `admin`.
- Students use `@sis.hust.edu.vn` email addresses; administrators provision accounts. No self-registration.
- Backend approved-v2 locally implemented. Separate `frontend/` remains historical vertical slice targeting superseded API/workflow; adapting code/DTOs/fixtures requires separate approval. Same-origin auth unchanged; no new CORS/deployment work.
- Performance targets are not proof of capacity or certification. See [Features](docs/FEATURES.md) for implementation status and limits.

## Brand Commitments
- Serve CLB o365-HUST; current course title follows approved workflow above. Preserve authorized logo assets and technical design tokens; legacy UI name is historical, not competing product authority.
- Approved brand reference: [CLB o365-HUST Facebook profile](https://www.facebook.com/o365.hust). Current profile logo is the approved visual reference, and the user permits using club logos and branding.
- Local supplied source assets in [assets/logo/](assets/logo/): [Logo o365-01.psd](<assets/logo/Logo o365-01.psd>) (PSD header verified) and five verified raster PNGs ([Logo dành cho ảnh-01.png](<assets/logo/Logo dành cho ảnh-01.png>), [Logo o365 1-01.png](<assets/logo/Logo o365 1-01.png>), [Logo o365 mờ-01.png](<assets/logo/Logo o365 mờ-01.png>), [Logo o365-01.png](<assets/logo/Logo o365-01.png>), [Logo o365-02.png](<assets/logo/Logo o365-02.png>)); see [Design System](docs/DESIGN.md#overview) for exact dimensions and alpha inventory.
- Vector source files and an official club brand guide remain unsupplied; do not redraw, recolor, or stretch the logo, and do not hotlink ephemeral Facebook CDN URLs in production. Exact variant selection for light-background headers, favicons, and small-size legibility remains a frontend implementation check.
- No separate HUST crest or Microsoft logos are authorized.
- Exact official club colors are unverified; the proposed light-only UI palette, system typography, and design tokens in [Design System](docs/DESIGN.md) are explicitly approved as normative product UI tokens for future frontend work.

## Evidence on Hand
- [AGENTS.md](AGENTS.md): product goals, platforms, resource constraints, data-integrity priority, and Vietnamese content requirement.
- [Architecture](docs/ARCHITECTURE.md): approved system scope, roles, account rules, domain workflows, API summary, and proposed frontend stack.
- [Design System](docs/DESIGN.md): approved normative UI tokens, local logo asset inventory, role navigation, and component/workflow guidance.
- [Frontend Surface Contract](docs/FRONTEND_SURFACE_CONTRACT.md): `Operate` mode contract, asset derivative origin, and frontend setup/commands.
- [Decisions](docs/DECISIONS.md): recorded product and technical decisions, including constraints on implementation and deployment claims.
- [Features](docs/FEATURES.md): backend implementation status, verified local behavior, external-integration status, and explicit performance-certification limits.
- Local brand assets in `assets/logo/`: 5 PNGs verified via `.NET` `System.Drawing` signature/decode/alpha scan and 1 PSD header verified (`8BPS` v1); PSD layers/full decode, vector masters, and official brand guide remain unverified/unsupplied.
- User-confirmed context: display name, user device patterns, brand reference, logo/branding permission, and approved normative UI tokens.

## Product Principles
1. Protect data integrity above speed.
2. Make student tasks work well on phones and study and test tasks work well on PCs; support staff workflows primarily on PCs.
3. Preserve approved API contracts, role boundaries, and documented workflows. Do not introduce product features through design documentation.
4. Keep Vietnamese as the user-facing language.
5. Distinguish requirements and design targets from verified implementation or capacity.
6. Treat brand references as evidence, not permission to invent or finalize visual decisions.

## Accessibility & Inclusion
- Accessibility target: WCAG 2.2 AA. This is a requirement, not a certification claim.
- No additional user-specific accessibility needs are currently known.
- Design and implementation should support accessible use across phone and PC browsers; actual conformance remains to be verified.
