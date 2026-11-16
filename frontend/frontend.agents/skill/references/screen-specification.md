
# LMS Screen Specification

## Global Navigation

Admin:
- Dashboard
- Students
- Teachers
- Classes
- Library
- Notifications

Teacher:
- Overview
- Classes
- Library
- Notifications

Student:
- Overview
- Classes
- Library
- Schedule
- Notifications

Support profile and account settings.

## Admin Dashboard

Goal:
Understand system status and pending work.

Sections:
1. Page header and quick actions
2. Summary KPI cards
3. Class performance overview
4. Pending approval requests
5. Recent activities

Primary actions:
- Manage classes
- Review requests
- Add user

## Teacher Dashboard

Goal:
Know what needs attention today.

Sections:
1. Class selector
2. My classes
3. Upcoming lessons
4. Teaching progress
5. Pending requests
6. Recent quiz results

Primary actions:
- Open class
- Review requests
- Create lesson

## Student Dashboard

Goal:
Understand progress and next learning tasks.

Sections:
1. Welcome / Continue learning
2. Registered class cards
3. Attendance progress
4. Quiz progress
5. Upcoming lessons
6. Upcoming deadlines

Primary actions:
- Open class
- Join lesson
- Continue assignment

## Class Detail

Shared:
- Class header
- Class status
- Teacher information
- Expiration date
- Role-specific tabs

Admin:
- Overview
- Students
- Lessons
- Materials
- Schedule

Teacher:
- Overview
- Lessons
- Quizzes
- Students
- Schedule
- Materials

Student:
- Overview
- Lessons
- Quizzes
- Materials
- Schedule

## Workflow-Critical States

Enrollment:
- Available
- Full
- Pending
- Approved
- Declined
- Expired

Lesson:
- Draft
- Pending approval
- Approved
- Confirmed
- Completed
- Cancelled

Attendance:
- Not opened
- Open
- Successfully recorded
- Failed code entry
- Locked
- Closed

Quiz:
- Upcoming
- Available
- In progress
- Submitted
- Passed
- Failed
- Expired
- Retake pending

Requests:
- Waiting
- Approved
- Declined

Certificate:
- Eligible
- Not eligible
- Issued
- Under review
- Revoked

## Screen Design Checklist

For every screen document:
- Role
- Goal
- Entry point
- Visible information
- Primary action
- Secondary actions
- Component list
- UI states
- Empty state
- Error state
- Responsive behavior

Do not assume a list of states is a
complete business state machine.

Refer to user-workflow-guideline.md
for transitions and permissions.
