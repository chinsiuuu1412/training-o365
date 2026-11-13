# Role dashboards

Implement Admin, Teacher and Student over the existing AppShell, Vietnamese copy and Navy Blue Academic tokens. Workflow reference remains unchanged.

## Confirmed scope

User selected inline mock details; approval, creation and learning actions explicitly unavailable. Trần Hoàng Nam will teach two of the three classes, consistently across roles. Student Continue learning prioritizes an in-progress Assignment and its deadline, never a Test retake.

## Approach

Extend the existing typed seed and dashboard service, preserving progress formulas and Admin search/filter behavior. Reuse StatCard and introduce ClassCard, ProgressCard and StatusBadge. This is preferable to separate role fixtures (which drift) or new backend workflows (outside the selected scope).

Admin: system/student/teacher KPIs, three class cards, attendance/quiz comparison, schedule requests, activities and quick actions. Teacher: class selector filters assigned classes, teaching progress, lessons, enrollment/Test-retake queues and notifications. Student: continue Assignment, approved classes, independent attendance/quiz progress, confirmed lessons, deadlines and personal notifications.

## Data and interaction

Keep demo identities a1/t1/s1. Move Đại số to t1; t2 remains a system teacher without an assigned class. Existing schedule sender and notification references must follow the new assignment. Add typed schedules, request kinds, deadlines and assignment drafts. Derive memberships, totals and progress from the same records. Deduplicate attendance/quiz successes as before. Filter role data by ownership, approved enrollment and notification recipient. Use a fixed, labeled demo reference date to keep lessons/deadlines reproducible.

Class, lesson, assignment and request details expand locally with accessible controls. Unsupported actions are disabled with an adjacent explanation. Never simulate approval success or open a Test. Existing navigation links may still lead to explicitly labeled milestone stubs.

## States and presentation

Responsive grids collapse to one column; content wraps. Empty filtered classes, lessons, queues, deadlines and notifications have explicit states. Preserve shared loading/error boundaries. Subtle 200ms page entry and 160ms hover, respecting reduced motion. Charts only compare actual named attendance/quiz measurements.

## Validation

Service tests cover role isolation, matching aggregates, pending-only queues, confirmed future lessons, Assignment-only continuation, due-date ordering, zero/empty data and seed references. Run test, lint, typecheck and build; exercise dashboards on desktop/mobile with filters and detail toggles. Verify workflow SHA256 is unchanged.
