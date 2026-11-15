import type { EnrollmentContext, LmsState, QuizGrant } from '../../types/lms.ts';

export const initialCycleId = (classId: string, studentId: string) => `initial-${classId}-${studentId}`;
export function firstCycleId(state: LmsState, classId: string, studentId: string) {
  return state.enrollmentCycles?.find(cycle => cycle.classId === classId && cycle.studentId === studentId)?.id ?? initialCycleId(classId, studentId);
}
export function currentCycleId(state: LmsState, classId: string, studentId: string): string | undefined {
  const enrollment = state.enrollments.find(item => item.classId === classId && item.studentId === studentId);
  return enrollment?.cycleId ?? (enrollment && ['approved', 'removed'].includes(enrollment.status) ? firstCycleId(state, classId, studentId) : undefined);
}
export function inEnrollmentCycle(state: LmsState, classId: string, studentId: string, record: { cycleId?: string }, cycleId = currentCycleId(state, classId, studentId)) {
  return !!cycleId && (record.cycleId ?? firstCycleId(state, classId, studentId)) === cycleId;
}
export function grantForCycle(state: LmsState, classId: string, studentId: string, grant: QuizGrant) {
  const cycleId = currentCycleId(state, classId, studentId);
  if (!cycleId) return false;
  if (grant.studentId) return grant.studentId === studentId && inEnrollmentCycle(state, classId, studentId, grant, cycleId);
  return grant.cycleTargets ? grant.cycleTargets.some(target => target.studentId === studentId && target.classId === classId && target.cycleId === cycleId) : cycleId === firstCycleId(state, classId, studentId);
}

type ScopedAction = { type: string; classId?: string; lessonId?: string; quizId?: string; attemptId?: string; requestId?: string; studentId?: string; enrollmentContext?: EnrollmentContext[]; expectedRequestId?: string };
function targetFor(state: LmsState, actorId: string, command: ScopedAction) {
  const attempt = command.attemptId ? state.attempts.find(item => item.id === command.attemptId) : undefined;
  const request = command.requestId ? state.requests.find(item => item.id === command.requestId) : undefined;
  const quizId = command.quizId ?? attempt?.quizId ?? request?.quizId;
  const classId = command.classId ?? request?.classId ?? state.quizzes.find(item => item.id === quizId)?.classId ?? state.lessons.find(item => item.id === command.lessonId)?.classId;
  const studentId = command.studentId ?? attempt?.studentId ?? request?.studentId ?? (request && ['enrollment', 'test-retake', 'absence'].includes(request.kind) ? request.senderId : undefined) ?? (state.users.find(user => user.id === actorId)?.role === 'student' ? actorId : undefined);
  return { classId, studentId };
}
export function captureEnrollmentContext<T extends ScopedAction>(state: LmsState, actorId: string, command: T): T & { enrollmentContext?: EnrollmentContext[]; expectedRequestId?: string } {
  const { classId, studentId } = targetFor(state, actorId, command);
  let contexts = command.enrollmentContext;
  if (!contexts && classId && studentId) contexts = [{ classId, studentId, cycleId: currentCycleId(state, classId, studentId) ?? null }];
  if (!contexts && classId && command.type === 'reopenQuiz') contexts = state.enrollments.filter(item => item.classId === classId && item.status === 'approved').map(item => ({ classId, studentId: item.studentId, cycleId: currentCycleId(state, classId, item.studentId) ?? null }));
  const pending = command.type === 'cancelEnrollment' && classId ? state.requests.find(request => request.classId === classId && request.senderId === actorId && request.kind === 'enrollment' && request.status === 'waiting') : undefined;
  return { ...command, enrollmentContext: contexts, expectedRequestId: command.expectedRequestId ?? pending?.id };
}
export function assertEnrollmentContext(state: LmsState, command: ScopedAction) {
  for (const target of command.enrollmentContext ?? []) if ((currentCycleId(state, target.classId, target.studentId) ?? null) !== target.cycleId) throw new Error('Lần ghi danh đã thay đổi. Mở lại màn hình trước khi thao tác.');
  if (command.expectedRequestId && command.type === 'cancelEnrollment' && !state.requests.some(request => request.id === command.expectedRequestId && request.kind === 'enrollment' && request.status === 'waiting')) throw new Error('Yêu cầu đang mở đã thay đổi; không thể hủy yêu cầu mới bằng thao tác cũ.');
}

export function migrateEnrollmentCycles(original: LmsState): LmsState {
  if (original.enrollmentCycles !== undefined) return original;
  const state = structuredClone(original);
  state.enrollmentCycles = [];
  for (const enrollment of state.enrollments) {
    if (enrollment.cycleId || ['approved', 'removed'].includes(enrollment.status)) {
      enrollment.cycleId ??= initialCycleId(enrollment.classId, enrollment.studentId);
      state.enrollmentCycles.push({ id: enrollment.cycleId, classId: enrollment.classId, studentId: enrollment.studentId, status: enrollment.status === 'approved' ? 'active' : 'ended', legacy: true });
    }
    const pending = state.requests.find(request => request.classId === enrollment.classId && request.senderId === enrollment.studentId && request.kind === 'enrollment' && request.status === 'waiting');
    if (pending) enrollment.pendingRequestId = pending.id;
    const declined = state.requests.filter(request => request.classId === enrollment.classId && request.senderId === enrollment.studentId && request.kind === 'enrollment' && request.status === 'declined').at(-1);
    if (declined) enrollment.lastDeclinedReason = declined.description;
  }
  const bind = (record: { cycleId?: string }, classId: string | undefined, studentId: string) => {
    if (classId && record.cycleId === undefined) record.cycleId = currentCycleId(state, classId, studentId);
  };
  for (const record of state.attendance) bind(record, state.lessons.find(lesson => lesson.id === record.lessonId)?.classId, record.studentId);
  for (const record of [...state.attempts, ...state.assignmentDrafts]) bind(record, state.quizzes.find(quiz => quiz.id === record.quizId)?.classId, record.studentId);
  for (const request of state.requests) {
    const studentId = request.studentId ?? (['test-retake', 'absence'].includes(request.kind) ? request.senderId : undefined);
    if (studentId) bind(request, request.classId, studentId);
  }
  for (const quiz of state.quizzes) for (const grant of quiz.grants ?? []) {
    if (grant.studentId) bind(grant, quiz.classId, grant.studentId);
    else grant.cycleTargets ??= state.enrollmentCycles.filter(cycle => cycle.classId === quiz.classId).map(cycle => ({ classId: cycle.classId, studentId: cycle.studentId, cycleId: cycle.id }));
  }
  // Existing certificate records remain historical; only replace their legacy cycle alias.
  for (const record of [...(state.certificates ?? []), ...(state.completionRequests ?? []), ...(state.completionAppeals ?? [])]) if (record.enrollmentCycle === 'initial') record.enrollmentCycle = firstCycleId(state, record.classId, record.studentId);
  for (const seal of state.classFinalizations ?? []) for (const snapshot of seal.snapshots ?? []) if (snapshot.enrollmentCycle === 'initial') snapshot.enrollmentCycle = firstCycleId(state, seal.classId, snapshot.studentId);
  return state;
}

export function validEnrollmentCycles(state: LmsState) {
  if (new Set(state.enrollments.map(item => `${item.classId}:${item.studentId}`)).size !== state.enrollments.length) return false;
  if (!state.enrollments.every(item => state.users.some(user => user.id === item.studentId && user.role === 'student') && (item.declineCount === undefined || Number.isInteger(item.declineCount) && item.declineCount >= 0 && item.declineCount <= 3) && (item.retryAt === undefined || Number.isFinite(Date.parse(item.retryAt))) && [item.lastDeclinedReason, item.declineReason, item.cycleId].every(value => value === undefined || typeof value === 'string'))) return false;
  if (state.enrollmentCycles === undefined) return true;
  const cycles = state.enrollmentCycles;
  if (!Array.isArray(cycles) || new Set(cycles.map(cycle => cycle?.id)).size !== cycles.length) return false;
  if (!cycles.every(cycle => cycle && typeof cycle.id === 'string' && !!cycle.id && state.classes.some(course => course.id === cycle.classId) && state.users.some(user => user.id === cycle.studentId && user.role === 'student') && ['active', 'ended'].includes(cycle.status) && [cycle.approvedAt, cycle.endedAt].every(value => value === undefined || Number.isFinite(Date.parse(value))) && (cycle.endReason === undefined || typeof cycle.endReason === 'string'))) return false;
  const active = cycles.filter(cycle => cycle.status === 'active');
  if (new Set(active.map(cycle => `${cycle.classId}:${cycle.studentId}`)).size !== active.length) return false;
  if (!active.every(cycle => state.enrollments.some(item => item.classId === cycle.classId && item.studentId === cycle.studentId && item.cycleId === cycle.id && item.status === 'approved'))) return false;
  if (!state.enrollments.every(item => item.status !== 'approved' || cycles.some(cycle => cycle.id === item.cycleId && cycle.classId === item.classId && cycle.studentId === item.studentId && cycle.status === 'active'))) return false;
  const linked = (classId: string | undefined, studentId: string, cycleId: string | undefined) => cycleId === undefined ? true : cycles.some(cycle => cycle.id === cycleId && cycle.classId === classId && cycle.studentId === studentId);
  if (!state.enrollments.every(item => linked(item.classId, item.studentId, item.cycleId) && (item.pendingRequestId === undefined || state.requests.some(request => request.id === item.pendingRequestId && request.classId === item.classId && request.senderId === item.studentId && request.kind === 'enrollment' && request.status === 'waiting')))) return false;
  if (!state.attendance.every(record => linked(state.lessons.find(lesson => lesson.id === record.lessonId)?.classId, record.studentId, record.cycleId))) return false;
  if (![...state.attempts, ...state.assignmentDrafts].every(record => linked(state.quizzes.find(quiz => quiz.id === record.quizId)?.classId, record.studentId, record.cycleId))) return false;
  if (!state.requests.every(request => linked(request.classId, request.studentId ?? request.senderId, request.cycleId))) return false;
  return state.quizzes.every(quiz => (quiz.grants ?? []).every(grant => linked(quiz.classId, grant.studentId ?? '', grant.cycleId) && (grant.cycleTargets === undefined || Array.isArray(grant.cycleTargets) && grant.cycleTargets.every(target => target && target.classId === quiz.classId && typeof target.cycleId === 'string' && linked(target.classId, target.studentId, target.cycleId)))));
}
