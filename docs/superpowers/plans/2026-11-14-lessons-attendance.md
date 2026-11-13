# Prompt 04 implementation plan and progress

Goal: extend existing Class Detail tabs and shared mock state with lesson, schedule approval and attendance workflows. No new shell/layout, backend or next milestone. Workflow file unchanged.

Confirmed choices: approved schedules visible to students pending confirmation; attach existing class materials; approved time edits proposed separately while current schedule remains; absence blocked after attendance; shared simulation clock controls with confirmation.

Architecture: separate lessons service with pure transitions; existing management execute dispatches lesson commands. Optional typed fields preserve old stored snapshots; migration normalizes them without discarding Prompt 03 data. Controlled lesson forms and attendance views reuse shared dialogs. Root handles integration/calendar/approval and provider clock/toast.

- [x] Domain/service/tests: drafts, schedule proposals/approval/rejection, 24h confirmation, makeup, codes/three failures/manual attendance/absence/corrections, deterministic fixtures and migration.
- [x] Lesson UI: list/form/detail/status, teacher attendance management, student code/absence; controlled inputs.
- [x] Integration: calendar with month navigation, Admin queue/alerts/corrections, class tabs and student schedule route; simulation clock and toast.
- [x] Run tests/lint/typecheck/build, browser end-to-end and mobile regression; independent review and fix findings.

Ownership: domain agent owns types, mocks/state, mocks/services/lessons, tests/lessons and management command dispatch only. Lesson UI agent owns features/lessons files only. Root owns all integration/provider/calendar/queue/routes/dashboard links. No commits, Git changes or workflow edits.

Final: 28 tests pass; lint/typecheck/build pass. Browser lesson lifecycle, cross-tab time/code/manual/correction/absence and existing dashboard/enrollment regressions pass. Details: docs/lessons-attendance.md.