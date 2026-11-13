
---
name: lms-frontend
description: >
  Design and develop the UI/UX and frontend of a
  role-based Learning Management System. Use this
  skill for workflow analysis, screen planning,
  design systems, React components, frontend
  implementation, and UI/UX quality reviews.
---

# LMS Frontend Skill

## 1. Mission

Build a user-friendly, modern Learning Management
System using the provided product workflows.

Primary goals:
- Consistent Navy / Blue / White design.
- Clear navigation across Admin, Teacher, Student.
- Responsive and accessible UI.
- Smooth, purposeful animations.
- Reusable and maintainable frontend components.
- Frontend ready for later backend integration.

## 2. Source of Truth

Read the relevant reference before starting work:

- references/user-workflow-guideline.md
- references/design-system.md
- references/screen-specification.md
- references/frontend-architecture.md
- references/ux-quality-checklist.md

Business rules in user-workflow-guideline.md
have priority over design suggestions.

Never silently modify confirmed business rules.

If references conflict:
1. Identify the conflicting statements.
2. Explain the design or implementation impact.
3. Request a decision when necessary.
4. Use an explicitly labeled temporary assumption
   only when safe and non-destructive.

## 3. Product Context

The LMS supports three roles:

### Admin
- System dashboard
- Students and teachers management
- Classes management
- Schedule approval
- Library supervision
- Notifications and requests

### Teacher
- Teaching overview
- Assigned classes
- Lessons and attendance
- Quizzes and results
- Enrollment management
- Course materials
- Notifications and requests

### Student
- Learning overview
- Class discovery and enrollment
- Registered classes
- Lessons and attendance
- Quizzes and progress
- Library and schedules
- Notifications and requests

Demo classes:
- Giải tích
- Đại số
- Nhập môn Công nghệ thông tin

## 4. Implementation Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- Recharts when charts are necessary
- Motion for React when animations add value

Follow the existing project's installed
versions and conventions.

## 5. Mandatory Design Workflow

For every screen or feature:

1. Identify the relevant workflow.
2. Identify the user role.
3. Define the user goal.
4. Determine required data.
5. Define UI states.
6. Identify reusable components.
7. Design the page structure.
8. Implement the UI.
9. Add mock interactions when requested.
10. Validate against workflow and references.

Do not skip workflow analysis for
multi-step or approval-based interactions.

## 6. UI Principles

- Simple before decorative.
- Consistency before novelty.
- Clear hierarchy and navigation.
- One obvious primary action per context.
- Explicit feedback for user actions.
- Accessible contrast and keyboard navigation.
- Responsive from desktop to mobile.
- Respect reduced-motion preferences.

## 7. Frontend Rules

- Use shared components.
- Separate mock data from UI components.
- Define business entities with TypeScript.
- Avoid duplicating sidebar/navigation logic.
- Keep roles and permissions explicit.
- Do not use visual hiding as real authorization.
- Keep API-facing logic replaceable.
- Do not hardcode secrets or real credentials.
- Preserve existing working features.
- Avoid installing unnecessary dependencies.

## 8. Mock Data Policy

Mock data must be consistent across all roles.

For example:
- Student enrollment status must match
  Teacher's enrollment request list.
- A lesson belongs to a valid class.
- A quiz belongs to a valid class or lesson.
- Dashboard progress is derived from
  attendance and quiz records.

Do not invent success states for actions
that have not been implemented.

For purely visual prototypes, label
non-functional controls clearly.

## 9. Animation Rules

Use subtle transitions for:
- Sidebar expansion/collapse
- Tab navigation
- Cards and menus
- Dialogs
- Toast notifications
- Progress changes

Avoid:
- Large continuous animations
- Excessive bouncing
- Distracting background effects
- Motion that delays important actions

## 10. Definition of Done

A completed UI task must satisfy:

- Required screen structure exists.
- Navigation works as specified.
- Design tokens are consistent.
- Mock data is realistic and consistent.
- Loading, empty, and error states are covered.
- Desktop and mobile layouts are usable.
- Keyboard interactions are considered.
- No obvious dead links.
- No known critical runtime errors.
- Deviations from the workflow are reported.

Run available lint, typecheck, and build
checks when working in the codebase.

Report which checks actually ran.

## 11. Execution Protocol

Before implementation:
- Summarize the relevant requirements.
- List affected screens/components.
- Identify missing information.
- Propose a small implementation plan.

During implementation:
- Build in small increments.
- Reuse existing components.
- Avoid unrelated code changes.

After implementation:
- Summarize changed files.
- List completed interactions.
- Report validation results.
- List remaining gaps.
