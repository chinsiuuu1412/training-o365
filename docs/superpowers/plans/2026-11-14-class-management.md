# Class Management Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, with superpowers:test-driven-development and final independent review.

**Goal:** Complete Prompt 03 with consistent frontend account/class/enrollment flows.
**Architecture:** Pure typed mock transitions over a shared snapshot; localStorage-backed React provider; reusable forms/dialogs/tables; existing shell and dashboard views.
**Tech Stack:** Existing Next.js/React/TypeScript/Tailwind/Radix Dialog.
**Spec:** docs/superpowers/specs/2026-11-14-class-management-design.md

## Global Constraints

- No backend/email or Prompt 04; workflow file unchanged.
- Suspend preserves enrollment. Cancellations do not consume decline attempts.
- Retry after ten minutes with a new reason; three declines maximum.
- Full/expired enrollment blocked both at request and approval.
- Keep dashboards, shell, tokens and reusable cards.

## Review Focus

- Direct URL and service calls must enforce ownership/membership, not only hide controls.
- Concurrent approval of last seat rechecks latest snapshot.
- Corrupt/unavailable storage must show feedback and allow recovery.
- Student previews never expose private roster/materials.
- Account changes and enrollment decisions update every role and reload/tab.

## Task 1: Domain, transitions and projections

Files: types/lms.ts, mocks/state.ts, mocks/services/{management,dashboard}.ts, tests/{management,dashboard}.test.ts, package.json.
Interfaces: createInitialState(), execute(state, actorId, command, now), getEnrollmentState(state,classId,studentId,now); dashboard projections accept optional state.
- [x] Write failing behavioral tests for workflow restrictions and role/transition guards.
- [x] Implement immutable snapshot transitions with validation and notifications.
- [x] Adapt projections to accept state; preserve baseline tests and run full suite.

## Task 2: Provider and reusable UI

Files: state/lms-provider.tsx, components/ui/dialog.tsx, components/shared/management-ui.tsx, app/layout.tsx, layout/app-shell.tsx.
Interfaces: useLms() returns state, account(role), selectAccount, run(command), now; provider persists and listens to storage.
- [x] Implement persistent snapshot with cross-tab updates, demo clock, storage errors/reset confirmation.
- [x] Add accessible dialogs, validated form fields, feedback and responsive tables.
- [x] Connect current shell to demo account selection/suspended guard without replacing navigation.

## Task 3: Account/class/enrollment screens

Files: features/accounts/*, features/classes/*, features/enrollments/*, app/[role]/[section]/page.tsx, app/[role]/classes/[classId]/page.tsx.
- [x] Account list/search/status/add/edit/suspend/restore.
- [x] Class list/create/edit/reassignment, registered/discovery cards and previews.
- [x] Role class detail tabs, roster/progress/remove, request approval/history, fixed lesson count, read-only materials/schedule.
- [x] Dashboard client adapter and enabled links to implemented class/account workflows.

## Task 4: Verify and hand off

- [x] Run tests/lint/typecheck/build.
- [x] Browser end-to-end transitions, cross-tab/reload/reset, mobile/keyboard, original dashboard regression.
- [x] Independent source review, fix material findings and document results/limitations.

## Execution record

Baseline 9/9 pass; clean Git master exists now. Work occurs in the user-requested workspace without changing Git state. Existing temporary C: verification environment is reused due to workspace capacity constraints. Scope decisions above are the user's quiz answers; no changes to workflow reference.

Final verification: 15/15 unit tests; npm lint/typecheck/build pass. Production browser management and dashboard suites pass. Source review findings fixed: validate persisted snapshots before accepting data; preview always uses overview after removal; restore dialog trigger focus without overriding it with main focus. Preview http://localhost:3003. Full results in docs/class-management.md.
