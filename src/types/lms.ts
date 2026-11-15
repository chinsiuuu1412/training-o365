export type Role = "admin" | "manager" | "student";
export interface MockSession { id: string; userId: string; role: Role; revision: number; generation: string }
export interface MockSessionRecord extends MockSession { issuedAt: string; revoked: boolean }
export interface User { id: string; name: string; role: Role; initials: string; email?: string; phone?: string; studentNumber?: string; school?: string; universityClass?: string; gender?: string; credentialVersion?: number; sessionVersion?: number; status?: "active" | "suspended"; statusReason?: string }
export interface Class { id: string; name: string; code: string; managerId: string; capacity: number; totalLessons: number; expiresAt: string; color: string; description?: string; attendanceThreshold?: number; quizThreshold?: number }
export interface Enrollment { classId: string; studentId: string; status: "approved" | "pending" | "declined" | "cancelled" | "removed"; declineCount?: number; retryAt?: string; lastReason?: string; lastDeclinedReason?: string; declineReason?: string; cycleId?: string; pendingRequestId?: string }
export interface EnrollmentCycle { id: string; classId: string; studentId: string; status: "active" | "ended"; approvedAt?: string; endedAt?: string; endReason?: string; legacy?: boolean }
export interface EnrollmentContext { classId: string; studentId: string; cycleId: string | null }
export interface AttendanceOverride { id: string; lessonId: string; studentId: string; cycleId: string; actorId: string; at: string; before: boolean; after: boolean; reason: string }
export interface LessonDraft { location?: string; title: string; description: string; startsAt: string; endsAt: string; materialIds: string[]; attendanceCode: string }
export interface Lesson { location?: string; id: string; classId: string; name: string; completed: boolean; description?: string; materialIds?: string[]; attendanceCode?: string; draft?: LessonDraft }
export interface Attendance { cycleId?: string; lessonId: string; studentId: string; recorded: boolean; codeEntryRevoked?: boolean; failures?: number; absenceReason?: string; recordedAt?: string; recordedBy?: string; reason?: string }
export interface QuizQuestion { id: string; prompt: string; options: { id: string; text: string }[]; correctOptionId: string }
export interface QuizGrant { cycleId?: string; cycleTargets?: EnrollmentContext[]; id: string; studentId?: string; extraAttempts: number; newDueAt: string; reason: string; grantedAt: string; grantedBy: string }
export interface Quiz { id: string; classId: string; kind: "test" | "assignment"; passingScore: number; title: string; opensAt: string; dueAt: string; timeLimitMinutes: number; status?: "draft" | "published"; questions?: QuizQuestion[]; attemptLimit?: number; grants?: QuizGrant[]; contentLocked?: boolean }
export interface QuizAttempt { cycleId?: string; quizId: string; studentId: string; score: number; valid: boolean; id?: string; status?: "active" | "paused" | "submitted"; answers?: Record<string, string>; questions?: QuizQuestion[]; passingScore?: number; startedAt?: string; lastResumedAt?: string; remainingMs?: number; timeOffsetMs?: number; submittedAt?: string; submissionReason?: "manual" | "duration" | "deadline" | "exit" | "legacy"; dueAt?: string; invalidatedAt?: string; invalidatedBy?: string; invalidationReason?: string }
export interface ApprovalRequest { cycleId?: string; id: string; classId: string; senderId: string; kind: "schedule" | "enrollment" | "test-retake" | "manager-leave" | "attendance-correction" | "quiz-correction" | "absence"; quizId?: string; attemptId?: string; attemptScore?: number; attemptNumber?: number; lessonId?: string; studentId?: string; proposedStartsAt?: string; proposedEndsAt?: string; proposalTitle?: string; proposalLocation?: string; proposalDescription?: string; proposalMaterialIds?: string[]; proposalAttendanceCode?: string; leaveRequestId?: string; title: string; description: string; createdAt: string; status: "waiting" | "approved" | "declined" | "cancelled"; resolutionReason?: string; resolvedAt?: string }
export interface Notification { id: string; recipientId: string; classId?: string; title: string; description: string; createdAt: string; href: string; senderId?: string; messageId?: string; read?: boolean }
export interface Schedule { id: string; lessonId: string; startsAt: string; endsAt: string; status: "draft" | "declined" | "pending" | "approved" | "confirmed" | "cancelled" }
export interface AssignmentDraft { cycleId?: string; studentId: string; quizId: string; answeredQuestions: number; totalQuestions: number; remainingMinutes: number; updatedAt: string }
export interface Material {
  id: string;
  classId: string;
  lessonId?: string;
  title: string;
  kind: "document" | "video";
  expiresAt?: string;
  description?: string;
  fileName?: string;
  sizeBytes?: number;
  mimeType?: string;
  source?: "file" | "youtube";
  youtubeUrl?: string;
  uploadedBy?: string;
  createdAt?: string;
  removedAt?: string;
  removedBy?: string;
  removalReason?: string;
}
export interface GeneralRequest {
  id: string;
  senderId: string;
  recipientId: string;
  classId?: string;
  title: string;
  description: string;
  createdAt: string;
  status: "waiting" | "approved" | "declined";
  resolutionReason?: string;
  resolvedAt?: string;
}
export interface RequestReceipt {
  requestId: string;
  source: "workflow" | "general" | "completion" | "appeal";
  userId: string;
  revision: string;
}
export interface CompletionSnapshot {
  className: string;
  classCode: string;
  studentName: string;
  email: string;
  capturedAt: string;
  attendedSessions: number;
  requiredSessions: number;
  passedQuizzes: number;
  requiredQuizzes: number;
  attendancePercent: number;
  quizPercent: number;
  attendanceThreshold: number;
  quizThreshold: number;
}
export interface Certificate {
  id: string;
  classId: string;
  studentId: string;
  enrollmentCycle: string;
  status: "issued" | "under-review" | "revoked";
  basis: "criteria" | "exception";
  issuedAt: string;
  exceptionRequestId?: string;
  snapshot: CompletionSnapshot;
  acknowledgedReview?: string;
  reviewCause?: "progress" | "request";
  history: { status: Certificate["status"]; at: string; reason: string; actorId?: string; requestId?: string }[];
  deliveries: { id: string; kind: "issuance" | "revocation"; email: string; at: string; status: "simulated" }[];
}
export interface CompletionRequest {
  id: string;
  classId: string;
  studentId: string;
  enrollmentCycle: string;
  kind: "exception" | "revoke";
  certificateId?: string;
  appealId?: string;
  senderId: string;
  reason: string;
  createdAt: string;
  status: "waiting" | "approved" | "declined" | "cancelled";
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionReason?: string;
  decisionMode?: "cross-approval" | "timeout";
}
export interface CompletionAppeal {
  id: string;
  classId: string;
  studentId: string;
  enrollmentCycle: string;
  reason: string;
  createdAt: string;
  status: "waiting" | "forwarded" | "approved" | "declined" | "cancelled";
  resolutionReason?: string;
  resolvedAt?: string;
  requestId?: string;
  snapshot: CompletionSnapshot;
}
export interface ClassFinalization {
  id: string;
  classId: string;
  finalizedAt: string;
  finalizedBy: string;
  fingerprint: string;
  snapshots?: { studentId: string; enrollmentCycle: string; snapshot: CompletionSnapshot }[];
}
export interface LmsState { lessonWorkflowVersion?: 2; attendanceOverrides?: AttendanceOverride[]; enrollmentCycles?: EnrollmentCycle[]; mockGeneration?: string; mockSessions?: MockSessionRecord[]; referenceTime: string; users: User[]; classes: Class[]; enrollments: Enrollment[]; lessons: Lesson[]; attendance: Attendance[]; quizzes: Quiz[]; attempts: QuizAttempt[]; requests: ApprovalRequest[]; notifications: Notification[]; schedules: Schedule[]; assignmentDrafts: AssignmentDraft[]; materials: Material[]; generalRequests?: GeneralRequest[]; requestReceipts?: RequestReceipt[]; certificates?: Certificate[]; completionRequests?: CompletionRequest[]; completionAppeals?: CompletionAppeal[]; classFinalizations?: ClassFinalization[] }
