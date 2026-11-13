export type Role = "admin" | "teacher" | "student";
export interface User { id: string; name: string; role: Role; initials: string }
export interface Class { id: string; name: string; code: string; teacherId: string; capacity: number; totalLessons: number; expiresAt: string; color: string }
export interface Enrollment { classId: string; studentId: string; status: "approved" | "pending" }
export interface Lesson { id: string; classId: string; name: string; completed: boolean }
export interface Attendance { lessonId: string; studentId: string; recorded: boolean }
export interface Quiz { id: string; classId: string; kind: "test" | "assignment"; passingScore: number; title: string; opensAt: string; dueAt: string; timeLimitMinutes: number }
export interface QuizAttempt { quizId: string; studentId: string; score: number; valid: boolean }
export interface ApprovalRequest { id: string; classId: string; senderId: string; kind: "schedule" | "enrollment" | "test-retake"; quizId?: string; title: string; description: string; createdAt: string; status: "waiting" | "approved" | "declined" }
export interface Notification { id: string; recipientId: string; classId?: string; title: string; description: string; createdAt: string; href: string }
export interface Schedule { id: string; lessonId: string; startsAt: string; endsAt: string; status: "pending" | "approved" | "confirmed" | "cancelled" }
export interface AssignmentDraft { studentId: string; quizId: string; answeredQuestions: number; totalQuestions: number; remainingMinutes: number; updatedAt: string }
