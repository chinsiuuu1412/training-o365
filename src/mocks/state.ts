import * as seed from "./seed.ts";
import type { LmsState } from "../types/lms.ts";

// Defaults retain the original seed references for the existing projection tests.
export const baseState: LmsState = { ...seed, materials: seed.classes.map(c => ({ id: `material-${c.id}`, classId: c.id, title: `Đề cương ${c.name}`, kind: "document" })) };

export function createInitialState(): LmsState {
  const state = structuredClone(baseState);
  state.users = state.users.map(u => ({ ...u, email: `${u.id}@hocviet.example`, phone: "", status: "active" }));
  state.classes = state.classes.map(c => ({ ...c, description: `Kiến thức nền tảng và bài tập thực hành ${c.name}.`, attendanceThreshold: 80, quizThreshold: 70 }));
  state.enrollments = state.enrollments.map(e => ({ ...e, declineCount: 0, lastReason: state.requests.find(r => r.kind === "enrollment" && r.classId === e.classId && r.senderId === e.studentId && r.status === "waiting")?.description }));
  return migrateLessonState(state);
}

export function isValidState(value: unknown): value is LmsState {
  if (!value || typeof value !== "object") return false;
  const state = value as LmsState;
  const keys = ["users", "classes", "enrollments", "lessons", "attendance", "quizzes", "attempts", "requests", "notifications", "schedules", "assignmentDrafts", "materials"] as const;
  if (!keys.every(key => Array.isArray(state[key]) && state[key].every(row => row && typeof row === "object"))) return false;
  const text = (v: unknown) => typeof v === "string";
  const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v as string));
  if (!date(state.referenceTime)) return false;
  if (!state.users.every(u => text(u.id) && text(u.name) && text(u.initials) && text(u.email) && ["admin", "teacher", "student"].includes(u.role) && ["active", "suspended"].includes(u.status ?? "active"))) return false;
  if (!["admin", "teacher", "student"].every(role => state.users.some(u => u.role === role))) return false;
  if (!state.classes.every(c => text(c.id) && text(c.name) && text(c.code) && text(c.description) && date(c.expiresAt) && Number.isInteger(c.capacity) && c.capacity > 0 && Number.isInteger(c.totalLessons) && c.totalLessons >= 0 && [c.attendanceThreshold, c.quizThreshold].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100) && state.users.some(u => u.id === c.teacherId && u.role === "teacher"))) return false;
  const hasClass = (id: string) => state.classes.some(c => c.id === id);
  const hasUser = (id: string) => state.users.some(u => u.id === id);
  if (!state.enrollments.every(e => hasClass(e.classId) && hasUser(e.studentId) && ["approved", "pending", "declined", "cancelled", "removed"].includes(e.status) && (e.lastReason === undefined || text(e.lastReason)))) return false;
  if (!state.lessons.every(l => text(l.id) && hasClass(l.classId) && text(l.name) && (l.description === undefined || text(l.description)) && typeof l.completed === "boolean" && (l.materialIds === undefined || (Array.isArray(l.materialIds) && l.materialIds.every(text))) && (l.attendanceCode === undefined || text(l.attendanceCode)) && (l.draft === undefined || (!!l.draft && text(l.draft.title) && text(l.draft.description) && text(l.draft.attendanceCode) && date(l.draft.startsAt) && date(l.draft.endsAt) && Array.isArray(l.draft.materialIds) && l.draft.materialIds.every(text))))) return false;
  if (!state.quizzes.every(q => text(q.id) && hasClass(q.classId) && text(q.title) && ["test", "assignment"].includes(q.kind) && date(q.opensAt) && date(q.dueAt) && Number.isFinite(q.passingScore))) return false;
  if (!state.attendance.every(a => hasUser(a.studentId) && state.lessons.some(l => l.id === a.lessonId) && typeof a.recorded === "boolean" && (a.failures === undefined || (Number.isInteger(a.failures) && a.failures >= 0 && a.failures <= 3)) && (a.absenceReason === undefined || text(a.absenceReason)))) return false;
  if (!state.attempts.every(a => hasUser(a.studentId) && state.quizzes.some(q => q.id === a.quizId) && Number.isFinite(a.score) && typeof a.valid === "boolean")) return false;
  if (!state.requests.every(r => text(r.id) && hasClass(r.classId) && hasUser(r.senderId) && text(r.title) && text(r.description) && date(r.createdAt) && ["schedule", "enrollment", "test-retake", "teacher-leave", "attendance-correction", "absence"].includes(r.kind) && ["waiting", "approved", "declined", "cancelled"].includes(r.status)
    && (r.lessonId === undefined || state.lessons.some(l => l.id === r.lessonId && l.classId === r.classId))
    && (r.studentId === undefined || state.users.some(u => u.id === r.studentId && u.role === "student"))
    && [r.proposedStartsAt, r.proposedEndsAt, r.resolvedAt].every(v => v === undefined || date(v))
    && [r.proposalTitle, r.proposalDescription, r.proposalAttendanceCode, r.leaveRequestId, r.resolutionReason].every(v => v === undefined || text(v))
    && (r.proposalMaterialIds === undefined || (Array.isArray(r.proposalMaterialIds) && r.proposalMaterialIds.every(text))))) return false;
  if (!state.notifications.every(n => text(n.id) && hasUser(n.recipientId) && text(n.title) && text(n.description) && date(n.createdAt))) return false;
  if (!state.schedules.every(s => text(s.id) && state.lessons.some(l => l.id === s.lessonId) && date(s.startsAt) && date(s.endsAt) && Date.parse(s.endsAt) > Date.parse(s.startsAt) && ["draft", "declined", "pending", "approved", "confirmed", "cancelled"].includes(s.status))) return false;
  if (!state.assignmentDrafts.every(d => hasUser(d.studentId) && state.quizzes.some(q => q.id === d.quizId) && date(d.updatedAt) && [d.answeredQuestions, d.totalQuestions, d.remainingMinutes].every(Number.isFinite))) return false;
  return state.materials.every(m => text(m.id) && hasClass(m.classId) && text(m.title) && ["document", "video"].includes(m.kind));
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

