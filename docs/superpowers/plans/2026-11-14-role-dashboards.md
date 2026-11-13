# Role Dashboards Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the three dashboards using shared data and components.
**Architecture:** Extend seed/service projections; compose role pages inside the existing AppShell. No backend mutations or new navigation logic.
**Tech Stack:** Existing Next.js, React, TypeScript, Tailwind, Motion, Lucide.
**Spec:** docs/superpowers/specs/2026-11-14-role-dashboards-design.md

## Global Constraints

- Workflow reference unchanged; Attendance and Quiz remain separate.
- t1 owns two classes; a1/t1/s1 remain demo identities.
- Inline mock details; unsupported mutations/learning clearly labeled.
- Continue learning prioritizes an in-progress Assignment.
- No new product dependencies; use existing AppShell and navigation.

## Review Focus

- Ownership leaks: teacher cannot see another teacher's queue.
- Pending enrollments must not count as enrolled students.
- Expired/pending lessons and assignments must not appear as available learning.
- Missing memberships produce empty data without crashes.
- Small screens and reduced motion remain usable.

## Task 1 — Shared data

Files: src/types/lms.ts, src/mocks/seed.ts, src/mocks/services/dashboard.ts, tests/dashboard.test.ts.
Interfaces: preserve getDashboard/getStudentProgress; add getTeacherDashboard(teacherId), getStudentDashboard(studentId), returning owned classes and scoped rows.

- [x] Add failing tests for two-class ownership, scoped pending requests, shared progress, future confirmed lessons and Assignment continuation.
- [x] Run the tests and confirm new behavior fails (4 existing pass, 4 new fail because role projections do not exist).
- [x] Add typed seed relationships, lesson times/status, request kinds/recipients and Assignment draft records; implement projections.
- [x] Run full unit suite; all pass (9 tests after adding boundary coverage).

## Task 2 — Shared cards and role views

Files: src/components/shared/{class-card,progress-card,status-badge}.tsx; src/features/dashboard/{dashboard-parts,teacher-dashboard,student-dashboard,admin-dashboard}.tsx; src/app/[role]/page.tsx; src/app/globals.css.
Interfaces: ClassCard consumes a service class row; ProgressCard consumes labeled percentage tracks; StatusBadge consumes a semantic status. Dashboard parts provide local expandable details, lesson/notification rows and page entry.

- [x] Build shared cards and accessible inline details with disabled unsupported actions.
- [x] Preserve Admin search, comparison filter and requests while integrating reusable cards and quick actions.
- [x] Compose Teacher filtered view and Student learning view; wire existing role route.
- [x] Verify class filtering, details, empty results and responsive layouts in a browser.

## Task 3 — Verification and delivery

Files: docs/role-dashboards.md, README.md.

- [x] Run tests, ESLint, TypeScript and production build.
- [x] Inspect all three dashboards at desktop/mobile sizes, keyboard controls and reduced motion.
- [x] Verify unchanged workflow hash; record exact results and limitations in docs/role-dashboards.md.

## Execution notes

Working in place: this directory is not a Git repository; worktree/commit steps are inapplicable. The user has confirmed the scope through the three quiz answers. Implement inline under that authorization. Reuse the existing temporary build environment if available because the workspace previously lacked disk capacity.

Final: all tasks complete. Source review found no issues. Full npm checks and production browser smoke pass. AppShell/navigation and workflow reference were preserved. No product dependencies added.
