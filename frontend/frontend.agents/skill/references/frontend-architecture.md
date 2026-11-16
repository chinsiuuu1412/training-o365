
# LMS Frontend Architecture

## Stack

Next.js App Router
TypeScript
Tailwind CSS
shadcn/ui
Lucide React
Recharts
Motion for React

## Folder Structure

src/
  app/
    (auth)/
    admin/
    teacher/
    student/
  components/
    ui/
    layout/
    shared/
  features/
    auth/
    classes/
    enrollments/
    lessons/
    attendance/
    quizzes/
    schedules/
    materials/
    notifications/
    certificates/
  mocks/
    seed.ts
    services/
  config/
    navigation.ts
  types/
  lib/

## Architecture Principles

1. Separate UI from business logic.
2. Keep components reusable.
3. Group feature-specific code together.
4. Use TypeScript interfaces for domain data.
5. Create a shared AppShell.
6. Define navigation per role.
7. Use mock services instead of direct
   hardcoded data in page components.
8. Prepare replaceable API service boundaries.

## Required Data Entities

- User
- Class
- Enrollment
- Lesson
- Schedule
- Attendance
- Quiz
- Question
- QuizAttempt
- Material
- Notification
- ApprovalRequest
- Certificate

## Mock Data

Simulate three classes:
- Giải tích
- Đại số
- Nhập môn Công nghệ thông tin

Use consistent IDs and relationships.

Do not generate random statistics separately
for each dashboard.

## Routing

Use role-specific route groups.

Use nested class routes and reusable
class layouts.

Ensure each navigation item resolves to
a real screen or explicitly marked stub.

## Interaction

For the UI-first milestone:
- Functional routing
- Tabs
- Search and filtering
- Forms with validation
- Dialog open/close
- Role switching for demo
- Display of mock workflow states

Complex quiz, attendance, and approval rules
may be represented by mock scenarios before
full implementation.

## Security Boundary

Frontend role switching is only for demo.

Actual authentication, authorization,
deadline validation, assessment integrity
and protected resources must be enforced
by the backend in a production system.
