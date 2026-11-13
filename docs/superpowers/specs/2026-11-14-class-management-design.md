# Class management and enrollment

Extend the existing shell, components and dashboards. The user confirmed six quiz choices: name/email required, phone optional, no password; localStorage with cross-tab state and confirmed reset; account selector by role; suspension keeps assignments/enrollments but blocks suspended account actions; cancellations do not consume any of three declined attempts; Materials/Schedule read-only in this prompt.

## Approach

Use typed snapshot data, pure mock service transitions and a single React provider above the existing role layout. No new dependencies. Separate role fixtures would drift; backend services are outside scope. Existing dashboard projections gain an optional snapshot argument and the dashboards consume the provider, retaining current presentation. Account selection is session-local to each tab; shared business data syncs through localStorage. Use a continuously advancing demo clock anchored at the existing 14/11/2026 seed date, with real elapsed time for the ten-minute retry restriction; show that this is demo time.

## Screens and behavior

Admin Students/Teachers: search, status filters, add/edit name/email/phone, duplicate email feedback, suspend/restore reason and confirmation. Suspension is distinct from enrollment removal.

Admin Classes: search/status/teacher filters, create/edit name/code/description/teacher/capacity/expiration/independent completion thresholds. Reassignment requires reason and confirmation, preserves lessons/materials/enrollments and transfers pending class work immediately. Capacity cannot fall below enrolled membership. Teacher fixes the total lesson count for newly created classes before teaching; existing counts are preserved.

Teacher Classes and Class Detail: only assigned classes; overview/lessons/quizzes/students/requests/schedule/materials. Set fixed lesson count once on a new class. Students table shows both tracks and supports confirmed removal with reason. Enrollment queue and history, approve/decline with reason, capacity and expiration rechecked at approval.

Student Classes: Registered/Find Classes views, search/filter, discovery previews showing description/teacher/capacity/teaching progress/expiration/next confirmed lesson. Enrollment reason dialog, pending/cancel, decline reason/retry countdown/new reason, maximum three declines. Full hides send action; expired excluded from discovery and student class content. Unapproved preview exposes no protected materials or student records.

Class details have role-specific tabs and consistent progress from shared records. Read-only material metadata and scheduled lesson status; no uploads, deletion, timetable approvals, assessment execution or emails. Expired-class content materials blocked per Workflow 10 while Admin/Teacher can inspect class metadata per Workflow 2.

## State and guards

One immutable snapshot of accounts/classes/memberships/requests/lessons/attendance/quizzes/attempts/drafts/schedules/materials/notifications. Pure service checks actor role, active status, class ownership, membership, capacity, expiration and request status before mutation. Failed validation changes nothing. Re-enrollment begins fresh learning tracks. Notifications for enrollment and class reassignment are stored alongside state. localStorage is demo persistence, not real authorization.

## Validation

Tests cover valid transitions and guards: cancellation retry counts, ten-minute/new-reason/three-decline rules, capacity races, duplicate account email, suspension without lost enrollment, reassignment/ownership, completion thresholds, new enrollment progress and snapshot-backed dashboards. Browser tests exercise Admin creation, Student request, Teacher decline/cancel/approve, cross-tab reload, reset, mobile forms/tabs and dashboard regression. Workflow file unchanged.
