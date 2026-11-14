import type { LmsState, Quiz, QuizAttempt, QuizQuestion } from '../../types/lms.ts';
import { getBestValidScore } from './progress.ts';

type SaveQuiz = { type: 'saveQuiz'; quizId?: string; classId: string; kind: 'test' | 'assignment'; title: string; passingScore: number; timeLimitMinutes: number; opensAt: string; dueAt: string; attemptLimit?: number; questions: QuizQuestion[] };
export type QuizCommand = SaveQuiz
  | { type: 'publishQuiz' | 'startQuiz'; quizId: string }
  | { type: 'answerQuiz'; attemptId: string; questionId: string; optionId: string }
  | { type: 'submitQuiz' | 'syncQuiz' | 'pauseQuiz' | 'resumeQuiz' | 'simulateQuizExpiry' | 'simulateTestExit'; attemptId: string }
  | { type: 'requestRetake'; quizId: string; reason: string }
  | { type: 'decideRetake'; requestId: string; approved: boolean; reason: string; extraAttempts?: number; newDueAt?: string }
  | { type: 'reopenQuiz'; quizId: string; studentId?: string; reason: string; extraAttempts?: number; newDueAt: string };
export const quizCommandTypes = ['saveQuiz', 'publishQuiz', 'startQuiz', 'answerQuiz', 'submitQuiz', 'syncQuiz', 'pauseQuiz', 'resumeQuiz', 'simulateQuizExpiry', 'simulateTestExit', 'requestRetake', 'decideRetake', 'reopenQuiz'];
function requireRule(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const active = (a: QuizAttempt) => a.status === 'active' || a.status === 'paused';
const expiredClass = (expiresAt: string, now: number) => expiresAt < new Date(now + 7 * 3600000).toISOString().slice(0, 10);

export function getAttemptRemaining(attempt: QuizAttempt, now: number): number {
  if (!active(attempt)) return 0;
  const elapsed = attempt.status === 'active' ? Math.max(0, now - Date.parse(attempt.lastResumedAt ?? attempt.startedAt ?? new Date(now).toISOString())) : 0;
  const duration = (attempt.remainingMs ?? 0) - elapsed - (attempt.timeOffsetMs ?? 0);
  const deadline = attempt.dueAt ? Date.parse(attempt.dueAt) - now : Infinity;
  return Math.max(0, Math.min(duration, deadline));
}

export function getQuizAvailability(state: LmsState, quizId: string, studentId: string, now: number) {
  const quiz = state.quizzes.find(q => q.id === quizId);
  const attempts = state.attempts.filter(a => a.quizId === quizId && a.studentId === studentId);
  const grants = (quiz?.grants ?? []).filter(g => !g.studentId || g.studentId === studentId);
  const effectiveDueAt = grants.reduce((date, g) => Date.parse(g.newDueAt) > Date.parse(date) ? g.newDueAt : date, quiz?.dueAt ?? new Date(0).toISOString());
  const attemptLimit = (quiz?.attemptLimit ?? (quiz?.kind === 'assignment' ? 10 : 1)) + grants.reduce((sum, g) => sum + g.extraAttempts, 0);
  const remainingAttempts = Math.max(0, attemptLimit - attempts.length);
  const currentAttempt = attempts.find(active);
  const bestScore = getBestValidScore(attempts);
  const retake = state.requests.filter(r => r.kind === 'test-retake' && r.quizId === quizId && r.senderId === studentId).at(-1);
  const course = state.classes.find(c => c.id === quiz?.classId);
  const user = state.users.find(u => u.id === studentId);
  let status: 'draft' | 'not-open' | 'closed' | 'exhausted' | 'available' | 'active' | 'paused' | 'unavailable' = 'available';
  if (!quiz || !course || user?.role !== 'student' || user.status === 'suspended' || expiredClass(course.expiresAt, now) || !state.enrollments.some(e => e.classId === course.id && e.studentId === studentId && e.status === 'approved')) status = 'unavailable';
  else if (quiz.status === 'draft') status = 'draft';
  else if (currentAttempt) status = currentAttempt.status === 'paused' ? 'paused' : 'active';
  else if (now < Date.parse(quiz.opensAt)) status = 'not-open';
  else if (now >= Date.parse(effectiveDueAt)) status = 'closed';
  else if (!remainingAttempts) status = 'exhausted';
  return { status, remainingAttempts, bestScore, currentAttempt, retake, effectiveDueAt, attemptLimit };
}

function validateQuiz(quiz: Quiz) {
  requireRule(quiz.kind === 'test' || quiz.kind === 'assignment', 'Loại Quiz không hợp lệ.');
  requireRule(quiz.title.trim(), 'Nhập tên bài Quiz.');
  requireRule(Number.isFinite(quiz.passingScore) && quiz.passingScore >= 0 && quiz.passingScore <= 100, 'Điểm đạt phải từ 0 đến 100.');
  requireRule(Number.isFinite(quiz.timeLimitMinutes) && quiz.timeLimitMinutes > 0, 'Thời gian làm bài phải lớn hơn 0.');
  requireRule(Number.isFinite(Date.parse(quiz.opensAt)) && Number.isFinite(Date.parse(quiz.dueAt)) && Date.parse(quiz.dueAt) > Date.parse(quiz.opensAt), 'Hạn nộp phải sau giờ mở.');
  const limit = quiz.attemptLimit ?? (quiz.kind === 'test' ? 1 : 10);
  requireRule(Number.isSafeInteger(limit) && limit >= 1 && (quiz.kind === 'assignment' || limit === 1), 'Giới hạn lượt làm không hợp lệ.');
  requireRule(quiz.questions?.length, 'Thêm ít nhất một câu hỏi.');
  requireRule(new Set(quiz.questions.map(q => q.id)).size === quiz.questions.length, 'Mã câu hỏi bị trùng.');
  for (const question of quiz.questions) {
    requireRule(question.id && question.prompt.trim() && question.options.length >= 2, 'Câu hỏi cần nội dung và ít nhất hai lựa chọn.');
    requireRule(question.options.every(o => o.id && o.text.trim()) && new Set(question.options.map(o => o.id)).size === question.options.length, 'Lựa chọn không hợp lệ hoặc trùng mã.');
    requireRule(question.options.some(o => o.id === question.correctOptionId), 'Chọn đúng một đáp án hợp lệ.');
  }
}

function submit(attempt: QuizAttempt, now: number, reason: QuizAttempt['submissionReason']) {
  if (!active(attempt)) return;
  const questions = attempt.questions ?? [];
  attempt.score = reason === 'exit' || !questions.length ? 0 : Math.round(questions.filter(q => attempt.answers?.[q.id] === q.correctOptionId).length * 10000 / questions.length) / 100;
  Object.assign(attempt, { status: 'submitted', valid: true, submittedAt: new Date(now).toISOString(), submissionReason: reason, remainingMs: 0, timeOffsetMs: 0 });
}

// Timer completion is a system transition, including after membership changes.
export function syncDueQuizAttempts(state: LmsState, now: number): LmsState {
  if (!state.attempts.some(a => active(a) && getAttemptRemaining(a, now) === 0)) return state;
  const result = structuredClone(state);
  for (const attempt of result.attempts) {
    if (!active(attempt) || getAttemptRemaining(attempt, now) > 0) continue;
    submit(attempt, now, attempt.dueAt && now >= Date.parse(attempt.dueAt) ? 'deadline' : 'duration');
  }
  return result;
}

export function executeQuiz(original: LmsState, actorId: string, command: QuizCommand, now: number): LmsState {
  const state = structuredClone(original);
  const actor = state.users.find(u => u.id === actorId);
  requireRule(actor && actor.status !== 'suspended', 'Tài khoản không khả dụng.');
  const isoNow = new Date(now).toISOString();
  const id = (prefix: string) => `${prefix}-${now}-${state.quizzes.length}-${state.attempts.length}-${state.requests.length}-${state.notifications.length}`;
  const notify = (recipientId: string, quiz: Quiz, title: string, description: string) => state.notifications.push({ id: id('quiz-notice'), recipientId, classId: quiz.classId, title, description, createdAt: isoNow, href: `/${state.users.find(u => u.id === recipientId)?.role ?? 'student'}/classes/${quiz.classId}` });
  const manage = (quiz: Pick<Quiz, 'classId'>) => {
    const course = state.classes.find(c => c.id === quiz.classId);
    requireRule(actor.role === 'teacher' && course?.teacherId === actor.id, 'Bạn không phụ trách lớp học này.');
    requireRule(!expiredClass(course.expiresAt, now), 'Lớp đã hết hạn.');
  };
  const student = (quiz: Quiz) => {
    const course = state.classes.find(c => c.id === quiz.classId);
    requireRule(actor.role === 'student' && course && !expiredClass(course.expiresAt, now) && state.enrollments.some(e => e.classId === quiz.classId && e.studentId === actor.id && e.status === 'approved'), 'Bạn không thể làm bài trong lớp này.');
  };
  const grant = (quiz: Quiz, studentId: string | undefined, reason: string, extraAttempts = 1, newDueAt?: string) => {
    requireRule(quiz.status !== 'draft', 'Quiz chưa được xuất bản.');
    requireRule(reason.trim(), 'Vui lòng nhập lý do.');
    requireRule(Number.isSafeInteger(extraAttempts) && extraAttempts > 0 && (quiz.kind === 'test' || extraAttempts <= 10), 'Số lượt bổ sung không hợp lệ.');
    requireRule(newDueAt && Number.isFinite(Date.parse(newDueAt)) && Date.parse(newDueAt) > now && Date.parse(newDueAt) > Date.parse(quiz.opensAt), 'Chọn thời hạn mới trong tương lai.');
    requireRule(!studentId || (state.users.some(u => u.id === studentId && u.role === 'student' && u.status !== 'suspended') && state.enrollments.some(e => e.classId === quiz.classId && e.studentId === studentId && e.status === 'approved')), 'Học viên không còn trong lớp.');
    quiz.grants ??= [];
    quiz.grants.push({ id: id('quiz-grant'), studentId, extraAttempts, newDueAt, reason: reason.trim(), grantedAt: isoNow, grantedBy: actor.id });
    for (const admin of state.users.filter(u => u.role === 'admin')) notify(admin.id, quiz, 'Quiz được mở lại', `${quiz.title}: ${reason.trim()} · ${extraAttempts} lượt · hạn ${newDueAt}`);
    const recipients = studentId ? [studentId] : state.enrollments.filter(e => e.classId === quiz.classId && e.status === 'approved').map(e => e.studentId);
    for (const recipient of recipients) notify(recipient, quiz, 'Được bổ sung lượt làm Quiz', `${quiz.title}: ${reason.trim()} · ${extraAttempts} lượt · hạn ${newDueAt}`);
  };

  if (command.type === 'saveQuiz') {
    manage(command);
    const current = state.quizzes.find(q => q.id === command.quizId);
    requireRule(!command.quizId || current, 'Không tìm thấy Quiz.');
    requireRule(!current || current.classId === command.classId, 'Không thể chuyển Quiz sang lớp khác.');
    requireRule(!current || (!current.contentLocked && !state.attempts.some(a => a.quizId === current.id)), 'Nội dung và điểm đã khóa sau lượt làm đầu tiên.');
    const quiz: Quiz = { ...current, id: current?.id ?? id('quiz'), classId: command.classId, kind: command.kind, title: command.title.trim(), passingScore: command.passingScore, timeLimitMinutes: command.timeLimitMinutes, opensAt: command.opensAt, dueAt: command.dueAt, attemptLimit: command.attemptLimit ?? (command.kind === 'test' ? 1 : 10), questions: structuredClone(command.questions), status: 'draft' };
    validateQuiz(quiz);
    if (current) Object.assign(current, quiz); else state.quizzes.push(quiz);
  } else if (command.type === 'decideRetake') {
    const request = state.requests.find(r => r.id === command.requestId && r.kind === 'test-retake');
    requireRule(request?.status === 'waiting', 'Yêu cầu không còn chờ duyệt.');
    const quiz = state.quizzes.find(q => q.id === request.quizId);
    requireRule(quiz, 'Không tìm thấy Quiz.');
    manage(quiz);
    if (command.approved) grant(quiz, request.senderId, command.reason || request.description, command.extraAttempts, command.newDueAt);
    else requireRule(command.reason.trim(), 'Nhập lý do từ chối.');
    Object.assign(request, { status: command.approved ? 'approved' : 'declined', resolutionReason: command.reason.trim() || request.description, resolvedAt: isoNow });
    notify(request.senderId, quiz, command.approved ? 'Yêu cầu làm lại được duyệt' : 'Yêu cầu làm lại bị từ chối', request.resolutionReason!);
  } else if ('quizId' in command) {
    const quiz = state.quizzes.find(q => q.id === command.quizId);
    requireRule(quiz, 'Không tìm thấy Quiz.');
    if (command.type === 'publishQuiz') { manage(quiz); validateQuiz(quiz); quiz.status = 'published'; }
    if (command.type === 'reopenQuiz') { manage(quiz); grant(quiz, command.studentId, command.reason, command.extraAttempts, command.newDueAt); }
    if (command.type === 'startQuiz') {
      student(quiz);
      const availability = getQuizAvailability(state, quiz.id, actor.id, now);
      requireRule(availability.status === 'available', 'Bài chưa mở, đã hết hạn hoặc hết lượt làm.');
      validateQuiz(quiz);
      quiz.contentLocked = true;
      state.attempts.push({ id: id('attempt'), quizId: quiz.id, studentId: actor.id, score: 0, valid: false, status: 'active', answers: {}, questions: structuredClone(quiz.questions), passingScore: quiz.passingScore, startedAt: isoNow, lastResumedAt: isoNow, remainingMs: quiz.timeLimitMinutes * 60000, timeOffsetMs: 0, dueAt: availability.effectiveDueAt });
      state.assignmentDrafts = state.assignmentDrafts.filter(d => d.quizId !== quiz.id || d.studentId !== actor.id);
    }
    if (command.type === 'requestRetake') {
      student(quiz);
      requireRule(quiz.kind === 'test' && quiz.status !== 'draft', 'Chỉ gửi yêu cầu làm lại Test đã xuất bản.');
      requireRule(command.reason.trim(), 'Vui lòng nhập lý do.');
      requireRule(state.attempts.some(a => a.quizId === quiz.id && a.studentId === actor.id && !active(a)), 'Cần hoàn thành một lượt làm trước.');
      requireRule(!state.attempts.some(a => a.quizId === quiz.id && a.studentId === actor.id && active(a)), 'Bạn đang có bài làm chưa hoàn thành.');
      requireRule(!state.requests.some(r => r.kind === 'test-retake' && r.quizId === quiz.id && r.senderId === actor.id && r.status === 'waiting'), 'Yêu cầu đang chờ duyệt.');
      state.requests.push({ id: id('retake'), kind: 'test-retake', quizId: quiz.id, classId: quiz.classId, senderId: actor.id, title: `Xin làm lại ${quiz.title}`, description: command.reason.trim(), createdAt: isoNow, status: 'waiting' });
      notify(state.classes.find(c => c.id === quiz.classId)!.teacherId, quiz, 'Học viên xin làm lại Test', `${actor.name}: ${command.reason.trim()}`);
    }
  } else {
    const attempt = state.attempts.find(a => a.id === command.attemptId);
    requireRule(attempt && attempt.studentId === actor.id, 'Không tìm thấy bài làm của bạn.');
    const quiz = state.quizzes.find(q => q.id === attempt.quizId);
    requireRule(quiz, 'Không tìm thấy Quiz.');
    student(quiz);
    if (!active(attempt)) { requireRule(command.type === 'syncQuiz', 'Bài đã nộp.'); return state; }
    const deadlineReached = !!attempt.dueAt && now >= Date.parse(attempt.dueAt);
    if (getAttemptRemaining(attempt, now) === 0) submit(attempt, now, deadlineReached ? 'deadline' : 'duration');
    else switch (command.type) {
      case 'syncQuiz': break;
      case 'answerQuiz': {
        requireRule(attempt.status === 'active', 'Tiếp tục bài làm trước khi chọn đáp án.');
        const question = attempt.questions?.find(q => q.id === command.questionId);
        requireRule(question && question.options.some(o => o.id === command.optionId), 'Lựa chọn không hợp lệ.');
        attempt.answers ??= {}; attempt.answers[question.id] = command.optionId;
        break;
      }
      case 'submitQuiz': requireRule(quiz.kind === 'assignment', 'Test tự nộp khi hết giờ.'); submit(attempt, now, 'manual'); break;
      case 'simulateTestExit': requireRule(quiz.kind === 'test', 'Thao tác dành cho Test.'); submit(attempt, now, 'exit'); break;
      case 'simulateQuizExpiry': attempt.timeOffsetMs = (attempt.timeOffsetMs ?? 0) + getAttemptRemaining(attempt, now); submit(attempt, now, 'duration'); break;
      case 'pauseQuiz': {
        requireRule(quiz.kind === 'assignment', 'Chỉ Assignment được tạm dừng.');
        if (attempt.status === 'active') {
          attempt.remainingMs = Math.max(0, (attempt.remainingMs ?? 0) - Math.max(0, now - Date.parse(attempt.lastResumedAt!)) - (attempt.timeOffsetMs ?? 0));
          attempt.timeOffsetMs = 0; attempt.status = 'paused';
        }
        break;
      }
      case 'resumeQuiz': requireRule(quiz.kind === 'assignment', 'Chỉ Assignment được tiếp tục.'); if (attempt.status === 'paused') { attempt.status = 'active'; attempt.lastResumedAt = isoNow; } break;
    }
  }
  return state;
}
