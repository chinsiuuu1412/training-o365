import * as seed from "./seed.ts";
import type { LmsState, QuizQuestion } from "../types/lms.ts";
import { isValidCompletionState } from "./validate-completion.ts";

// Defaults retain the original seed references for the existing projection tests.
export const baseState: LmsState = {
  ...seed,
  materials: seed.classes.flatMap(course => [
    {
      id: `material-${course.id}`, classId: course.id, title: `Đề cương ${course.name}`, kind: "document" as const,
      source: "file" as const, fileName: `de-cuong-${course.code}.pdf`, sizeBytes: 524288, mimeType: "application/pdf",
      uploadedBy: course.teacherId, createdAt: seed.referenceTime,
    },
    {
      id: `video-${course.id}`, classId: course.id, lessonId: `${course.id}-l1`, title: `Video ôn tập ${course.name}`, kind: "video" as const,
      source: "file" as const, fileName: `on-tap-${course.code}.mp4`, sizeBytes: 8388608, mimeType: "video/mp4",
      expiresAt: course.id === "giai-tich" ? "2026-11-13T23:59:00+07:00" : undefined,
      uploadedBy: course.teacherId, createdAt: seed.referenceTime,
    },
  ]),
};

export function createInitialState(): LmsState {
  const state = structuredClone(baseState);
  state.users = state.users.map(u => ({ ...u, email: `${u.id}@hocviet.example`, phone: "", status: "active" }));
  state.classes = state.classes.map(c => ({ ...c, description: `Kiến thức nền tảng và bài tập thực hành ${c.name}.`, attendanceThreshold: 80, quizThreshold: 70 }));
  state.enrollments = state.enrollments.map(e => ({ ...e, declineCount: 0, lastReason: state.requests.find(r => r.kind === "enrollment" && r.classId === e.classId && r.senderId === e.studentId && r.status === "waiting")?.description }));
  return migrateQuizState(migrateLessonState(state));
}

export function isValidState(value: unknown): value is LmsState {
  if (!value || typeof value !== "object") return false;
  const state = value as LmsState;
  const keys = ["users", "classes", "enrollments", "lessons", "attendance", "quizzes", "attempts", "requests", "notifications", "schedules", "assignmentDrafts", "materials"] as const;
  if (!keys.every(key => Array.isArray(state[key]) && state[key].every(row => row && typeof row === "object"))) return false;
  const text = (v: unknown) => typeof v === "string";
  const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v as string));
  const questions = (value: unknown): value is QuizQuestion[] => Array.isArray(value) && value.length > 0 && value.every(q => q && text(q.id) && q.id.length > 0 && text(q.prompt) && q.prompt.trim().length > 0 && Array.isArray(q.options) && q.options.length >= 2 && q.options.every((o: { id?: unknown; text?: unknown }) => o && text(o.id) && text(o.text)) && new Set(q.options.map((o: { id: string }) => o.id)).size === q.options.length && q.options.some((o: { id: string }) => o.id === q.correctOptionId)) && new Set(value.map(q => q.id)).size === value.length;
  if (!date(state.referenceTime)) return false;
  if (!state.users.every(u => text(u.id) && text(u.name) && text(u.initials) && text(u.email) && ["admin", "teacher", "student"].includes(u.role) && ["active", "suspended"].includes(u.status ?? "active"))) return false;
  if (!["admin", "teacher", "student"].every(role => state.users.some(u => u.role === role))) return false;
  if (!state.classes.every(c => text(c.id) && text(c.name) && text(c.code) && text(c.description) && date(c.expiresAt) && Number.isInteger(c.capacity) && c.capacity > 0 && Number.isInteger(c.totalLessons) && c.totalLessons >= 0 && [c.attendanceThreshold, c.quizThreshold].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100) && state.users.some(u => u.id === c.teacherId && u.role === "teacher"))) return false;
  const hasClass = (id: string) => state.classes.some(c => c.id === id);
  const hasUser = (id: string) => state.users.some(u => u.id === id);
  if (!state.enrollments.every(e => hasClass(e.classId) && hasUser(e.studentId) && ["approved", "pending", "declined", "cancelled", "removed"].includes(e.status) && (e.lastReason === undefined || text(e.lastReason)))) return false;
  if (!state.lessons.every(l => text(l.id) && hasClass(l.classId) && text(l.name) && (l.description === undefined || text(l.description)) && typeof l.completed === "boolean" && (l.materialIds === undefined || (Array.isArray(l.materialIds) && l.materialIds.every(text))) && (l.attendanceCode === undefined || text(l.attendanceCode)) && (l.draft === undefined || (!!l.draft && text(l.draft.title) && text(l.draft.description) && text(l.draft.attendanceCode) && date(l.draft.startsAt) && date(l.draft.endsAt) && Array.isArray(l.draft.materialIds) && l.draft.materialIds.every(text))))) return false;
  if (!state.quizzes.every(q => text(q.id) && hasClass(q.classId) && text(q.title) && ["test", "assignment"].includes(q.kind) && date(q.opensAt) && date(q.dueAt) && Number.isFinite(q.passingScore))) return false;
  if (!state.quizzes.every(q => q.contentLocked === undefined || typeof q.contentLocked === 'boolean')) return false;
  if (!state.quizzes.every(q => (q.status === undefined || ['draft', 'published'].includes(q.status)) && (q.questions === undefined || questions(q.questions)) && (q.attemptLimit === undefined || (Number.isSafeInteger(q.attemptLimit) && q.attemptLimit >= 1 && (q.kind === 'assignment' || q.attemptLimit === 1))) && (q.grants === undefined || (Array.isArray(q.grants) && q.grants.every(g => g && text(g.id) && (g.studentId === undefined || hasUser(g.studentId)) && Number.isSafeInteger(g.extraAttempts) && g.extraAttempts > 0 && (q.kind === 'test' || g.extraAttempts <= 10) && date(g.newDueAt) && text(g.reason) && date(g.grantedAt) && hasUser(g.grantedBy)))))) return false;
  if (!state.attendance.every(a => hasUser(a.studentId) && state.lessons.some(l => l.id === a.lessonId) && typeof a.recorded === "boolean" && (a.failures === undefined || (Number.isInteger(a.failures) && a.failures >= 0 && a.failures <= 3)) && (a.absenceReason === undefined || text(a.absenceReason)))) return false;
  if (!state.attempts.every(a => hasUser(a.studentId) && state.quizzes.some(q => q.id === a.quizId) && Number.isFinite(a.score) && typeof a.valid === "boolean")) return false;
  if (!state.attempts.every(a => (a.id === undefined || text(a.id)) && (a.status === undefined || ['active', 'paused', 'submitted'].includes(a.status)) && (a.questions === undefined || questions(a.questions)) && (a.answers === undefined || (!!a.answers && typeof a.answers === 'object' && !Array.isArray(a.answers) && Object.values(a.answers).every(text))) && [a.startedAt, a.lastResumedAt, a.submittedAt, a.dueAt].every(v => v === undefined || date(v)) && [a.remainingMs, a.timeOffsetMs].every(v => v === undefined || (Number.isFinite(v) && v >= 0)) && (!(a.status === 'active' || a.status === 'paused') || (!!a.id && !!a.startedAt && !!a.lastResumedAt && !!a.dueAt && a.remainingMs !== undefined && questions(a.questions) && !a.valid)))) return false;
  if (!state.requests.every(r => text(r.id) && hasClass(r.classId) && hasUser(r.senderId) && text(r.title) && text(r.description) && date(r.createdAt) && ["schedule", "enrollment", "test-retake", "teacher-leave", "attendance-correction", "absence"].includes(r.kind) && ["waiting", "approved", "declined", "cancelled"].includes(r.status)
    && (r.lessonId === undefined || state.lessons.some(l => l.id === r.lessonId && l.classId === r.classId))
    && (r.studentId === undefined || state.users.some(u => u.id === r.studentId && u.role === "student"))
    && [r.proposedStartsAt, r.proposedEndsAt, r.resolvedAt].every(v => v === undefined || date(v))
    && [r.proposalTitle, r.proposalDescription, r.proposalAttendanceCode, r.leaveRequestId, r.resolutionReason].every(v => v === undefined || text(v))
    && (r.proposalMaterialIds === undefined || (Array.isArray(r.proposalMaterialIds) && r.proposalMaterialIds.every(text))))) return false;
  if (!state.notifications.every(n => text(n.id) && hasUser(n.recipientId) && text(n.title) && text(n.description) && text(n.href) && date(n.createdAt) && (n.read === undefined || typeof n.read === "boolean") && (n.senderId === undefined || hasUser(n.senderId)) && (n.messageId === undefined || text(n.messageId)))) return false;
  if (state.generalRequests !== undefined && (!Array.isArray(state.generalRequests) || !state.generalRequests.every(r => r && text(r.id) && hasUser(r.senderId) && hasUser(r.recipientId) && (r.classId === undefined || hasClass(r.classId)) && text(r.title) && text(r.description) && date(r.createdAt) && ["waiting", "approved", "declined"].includes(r.status) && (r.resolutionReason === undefined || text(r.resolutionReason)) && (r.resolvedAt === undefined || date(r.resolvedAt))))) return false;
  if (state.requestReceipts !== undefined && (!Array.isArray(state.requestReceipts) || !state.requestReceipts.every(r => r && text(r.requestId) && ["workflow", "general", "completion", "appeal"].includes(r.source) && hasUser(r.userId) && text(r.revision)))) return false;
  if (!isValidCompletionState(state)) return false;
  if (!state.schedules.every(s => text(s.id) && state.lessons.some(l => l.id === s.lessonId) && date(s.startsAt) && date(s.endsAt) && Date.parse(s.endsAt) > Date.parse(s.startsAt) && ["draft", "declined", "pending", "approved", "confirmed", "cancelled"].includes(s.status))) return false;
  if (!state.assignmentDrafts.every(d => hasUser(d.studentId) && state.quizzes.some(q => q.id === d.quizId) && date(d.updatedAt) && [d.answeredQuestions, d.totalQuestions, d.remainingMinutes].every(Number.isFinite))) return false;
  return state.materials.every(m => text(m.id) && hasClass(m.classId) && text(m.title) && ["document", "video"].includes(m.kind)
    && (m.lessonId === undefined || state.lessons.some(l => l.id === m.lessonId && l.classId === m.classId))
    && [m.description, m.fileName, m.mimeType, m.youtubeUrl, m.removalReason].every(v => v === undefined || text(v))
    && [m.expiresAt, m.createdAt, m.removedAt].every(v => v === undefined || date(v))
    && (m.sizeBytes === undefined || (Number.isSafeInteger(m.sizeBytes) && m.sizeBytes > 0))
    && (m.source === undefined || ["file", "youtube"].includes(m.source))
    && [m.uploadedBy, m.removedBy].every(v => v === undefined || hasUser(v)));
}


// Upgrade only lesson metadata; preserve all account, class and enrollment changes.
export function migrateLessonState(state: LmsState): LmsState {
  if (!state || !Array.isArray(state.lessons) || !Array.isArray(state.requests) || !Array.isArray(state.schedules)) return state;
  const result = structuredClone(state);
  const legacy: Record<string, string> = { r1: 'giai-tich-l10', r2: 'dai-so-l7', r3: 'nhap-mon-cntt-l8' };
  for (const request of result.requests) {
    if (!request || request.kind !== 'schedule' || request.lessonId) continue;
    const lessonId = legacy[request.id];
    const schedule = result.schedules.find(s => s && s.lessonId === lessonId);
    if (schedule) Object.assign(request, { lessonId, proposedStartsAt: schedule.startsAt, proposedEndsAt: schedule.endsAt });
  }
  for (const lesson of result.lessons) {
    if (!lesson || typeof lesson !== "object") continue;
    if (lesson.attendanceCode === undefined) lesson.attendanceCode = 'HOCVIET';
    if (lesson.description === undefined) lesson.description = '';
    if (lesson.materialIds === undefined) lesson.materialIds = [];
  }
  return result;
}

// Legacy scores are authoritative. Adding playable content never recalculates them.
export function migrateQuizState(state: LmsState): LmsState {
  if (!state || !Array.isArray(state.quizzes) || !Array.isArray(state.attempts)) return state;
  const result = structuredClone(state);
  for (const quiz of result.quizzes) {
    if (!quiz || typeof quiz !== 'object') continue;
    quiz.status ??= 'published';
    quiz.attemptLimit ??= quiz.kind === 'test' ? 1 : 10;
    quiz.grants ??= [];
    if (quiz.contentLocked === undefined || quiz.contentLocked === false) quiz.contentLocked = result.attempts.some(a => a?.quizId === quiz.id);
    quiz.questions ??= [
      { id: `${quiz.id}-question-1`, prompt: 'Kết quả của 2 + 3 là bao nhiêu?', options: [{ id: 'a', text: '5' }, { id: 'b', text: '6' }, { id: 'c', text: '4' }], correctOptionId: 'a' },
      { id: `${quiz.id}-question-2`, prompt: 'Một giờ có bao nhiêu phút?', options: [{ id: 'a', text: '30 phút' }, { id: 'b', text: '60 phút' }, { id: 'c', text: '90 phút' }], correctOptionId: 'b' },
      { id: `${quiz.id}-question-3`, prompt: 'Số nào là số chẵn?', options: [{ id: 'a', text: '3' }, { id: 'b', text: '7' }, { id: 'c', text: '8' }], correctOptionId: 'c' },
    ];
  }
  result.attempts.forEach((attempt, index) => {
    if (!attempt || typeof attempt !== 'object') return;
    attempt.id ??= `legacy-attempt-${attempt.quizId}-${attempt.studentId}-${index}`;
    if (!attempt.status) {
      attempt.status = 'submitted';
      attempt.submissionReason = 'legacy';
    }
  });
  return result;
}

