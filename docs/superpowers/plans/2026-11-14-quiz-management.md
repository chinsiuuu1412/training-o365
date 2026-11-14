# Prompt 05 implementation plan

Extend the existing Class Detail Quiz tab, shared mock services and persistent state. Confirmed choices: explicit confirmed Test interruption simulation grades that attempt zero, published content/scoring locks after first attempt, timer simulation applies only to the selected attempt. Automatic visibility/connectivity events display warnings without grading penalties.

- [x] Domain and regression tests for builder validation, publish, timed attempts, pause/resume, best score and retake grants, migration preserving historical scores.
- [x] Teacher builder/settings/preview/publish/results/history/retake review.
- [x] Student detail/start/player/navigation/timer/submission/result/history/retake request.
- [x] State/provider integration, focused player route, dashboard projections and existing entry points.
- [x] Lint/typecheck/build, browser workflows/mobile and independent source review.

Ownership: domain agent types, mocks/services/quizzes.ts, mocks/state.ts, management dispatch, tests/quizzes.test.ts. Teacher agent features/quizzes/teacher files. Player agent features/quizzes/student/player files. Root integration, provider, routes, projections and validation. Existing dirty changes preserved, workflow reference untouched, no Git mutation.
