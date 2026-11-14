import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, isValidState, migrateQuizState } from '../src/mocks/state.ts';
import { executeQuiz, getAttemptRemaining, getQuizAvailability, syncDueQuizAttempts } from '../src/mocks/services/quizzes.ts';
import { execute } from '../src/mocks/services/management.ts';
import { getStudentProgress } from '../src/mocks/services/dashboard.ts';
import type { LmsState, QuizQuestion } from '../src/types/lms.ts';

const now = Date.parse('2026-11-14T02:00:00Z');
const dueAt = new Date(now + 3600000).toISOString();
const questions: QuizQuestion[] = [{ id: 'q1', prompt: '2 + 2?', options: [{ id: 'a', text: '4' }, { id: 'b', text: '5' }], correctOptionId: 'a' }, { id: 'q2', prompt: '3 + 3?', options: [{ id: 'a', text: '7' }, { id: 'b', text: '6' }], correctOptionId: 'b' }];
function draft(kind: 'test' | 'assignment' = 'assignment') {
  return executeQuiz(createInitialState(), 't1', { type: 'saveQuiz', classId: 'giai-tich', kind, title: 'Quiz mới', passingScore: 50, timeLimitMinutes: 10, opensAt: new Date(now - 60000).toISOString(), dueAt, questions }, now);
}
function published(kind: 'test' | 'assignment' = 'assignment') { const s = draft(kind); return executeQuiz(s, 't1', { type: 'publishQuiz', quizId: s.quizzes.at(-1)!.id }, now); }
function started(kind: 'test' | 'assignment' = 'assignment') { const s = published(kind); return executeQuiz(s, 's1', { type: 'startQuiz', quizId: s.quizzes.at(-1)!.id }, now); }
function answer(s: LmsState, questionId = 'q1', optionId = 'a', time = now) { return executeQuiz(s, 's1', { type: 'answerQuiz', attemptId: s.attempts.at(-1)!.id!, questionId, optionId }, time); }
function end(s: LmsState, type: 'submitQuiz' | 'syncQuiz' | 'simulateQuizExpiry' | 'simulateTestExit' = 'submitQuiz', time = now) { return executeQuiz(s, 's1', { type, attemptId: s.attempts.at(-1)!.id! }, time); }

test('builder validates dates, question options, correct answer, caps and assignment default', () => {
  const s = draft(); assert.equal(s.quizzes.at(-1)!.attemptLimit, 10); assert.equal(s.quizzes.at(-1)!.status, 'draft');
  const command = { type: 'saveQuiz' as const, classId: 'giai-tich', kind: 'test' as const, title: 'Bài', passingScore: 60, timeLimitMinutes: 10, opensAt: new Date(now).toISOString(), dueAt, questions };
  for (const patch of [{ attemptLimit: 2 }, { passingScore: -1 }, { timeLimitMinutes: 0 }, { dueAt: command.opensAt }, { questions: [] }, { questions: [{ ...questions[0], correctOptionId: 'missing' }] }, { questions: [questions[0], questions[0]] }]) assert.throws(() => executeQuiz(s, 't1', { ...command, ...patch }, now));
  assert(isValidState(s));
});

test('drafts require publish and commands work through management dispatch', () => {
  const s = draft(); const quizId = s.quizzes.at(-1)!.id;
  assert.throws(() => executeQuiz(s, 's1', { type: 'startQuiz', quizId }, now));
  assert.equal(execute(s, 't1', { type: 'publishQuiz', quizId }, now).quizzes.at(-1)!.status, 'published');
});

test('editing an unattempted published quiz requires preview and republication; drafts do not dilute progress', () => {
  const original = createInitialState();
  const saved = draft();
  assert.deepEqual(getStudentProgress('giai-tich', 's1', saved), getStudentProgress('giai-tich', 's1', original));
  const live = published();
  const quiz = live.quizzes.at(-1)!;
  const edited = executeQuiz(live, 't1', { type: 'saveQuiz', quizId: quiz.id, classId: quiz.classId, kind: quiz.kind, title: 'Revised', passingScore: quiz.passingScore, timeLimitMinutes: quiz.timeLimitMinutes, opensAt: quiz.opensAt, dueAt: quiz.dueAt, questions }, now);
  assert.equal(edited.quizzes.at(-1)!.status, 'draft');
  assert.throws(() => executeQuiz(edited, 's1', { type: 'startQuiz', quizId: quiz.id }, now));
});

test('role, assignment, enrollment, suspension and class expiry are enforced without mutation', () => {
  const s = published(); const quizId = s.quizzes.at(-1)!.id; const before = JSON.stringify(s);
  assert.throws(() => executeQuiz(s, 't2', { type: 'publishQuiz', quizId }, now));
  assert.throws(() => executeQuiz(s, 'a1', { type: 'startQuiz', quizId }, now));
  assert.equal(JSON.stringify(s), before);
  s.users.find(u => u.id === 's1')!.status = 'suspended'; assert.throws(() => executeQuiz(s, 's1', { type: 'startQuiz', quizId }, now));
  s.users.find(u => u.id === 's1')!.status = 'active'; s.enrollments.find(e => e.classId === 'giai-tich' && e.studentId === 's1')!.status = 'removed'; assert.throws(() => executeQuiz(s, 's1', { type: 'startQuiz', quizId }, now));
  assert.throws(() => executeQuiz(published(), 's1', { type: 'startQuiz', quizId }, Date.parse('2028-01-01')));
});

test('open/deadline exact boundaries and duplicate active attempts preserve caps', () => {
  const s = published(); const quizId = s.quizzes.at(-1)!.id;
  assert.throws(() => executeQuiz(s, 's1', { type: 'startQuiz', quizId }, now - 60001));
  assert.throws(() => executeQuiz(s, 's1', { type: 'startQuiz', quizId }, Date.parse(dueAt)));
  const begun = started(); assert.throws(() => executeQuiz(begun, 's1', { type: 'startQuiz', quizId: begun.quizzes.at(-1)!.id }, now));
});

test('assignment grades early submission, snapshots questions and freezes settings', () => {
  const initial = started(); let s = answer(initial); s = end(s);
  assert.equal(s.attempts.at(-1)!.score, 50); assert(s.attempts.at(-1)!.valid); assert.equal(initial.attempts.at(-1)!.score, 0);
  assert.equal(getQuizAvailability(s, s.quizzes.at(-1)!.id, 's1', now).bestScore, 50);
  const q = s.quizzes.at(-1)!;
  assert.throws(() => executeQuiz(s, 't1', { type: 'saveQuiz', quizId: q.id, classId: q.classId, kind: q.kind, title: 'Đổi', passingScore: 100, opensAt: q.opensAt, dueAt: q.dueAt, timeLimitMinutes: 1, questions }, now));
  assert(isValidState(s));
});

test('test rejects early submit, auto submits duration, sync is idempotent', () => {
  let s = answer(started('test')); assert.throws(() => end(s));
  s = end(s, 'syncQuiz', now + 600000); assert.equal(s.attempts.at(-1)!.score, 50); assert.equal(s.attempts.at(-1)!.submissionReason, 'duration');
  assert.deepEqual(end(s, 'syncQuiz', now + 700000), s);
});

test('deadline submits saved answers and rejects late answer mutation', () => {
  let s = started('test'); s.attempts.at(-1)!.dueAt = new Date(now + 5000).toISOString(); s = answer(s);
  s = answer(s, 'q2', 'b', now + 5000); assert.equal(s.attempts.at(-1)!.score, 50); assert.equal(s.attempts.at(-1)!.submissionReason, 'deadline');
});

test('pause persists duration across reload, resume counts again, deadline applies while paused', () => {
  let s = started(); const attemptId = s.attempts.at(-1)!.id!;
  s = executeQuiz(s, 's1', { type: 'pauseQuiz', attemptId }, now + 60000);
  s = JSON.parse(JSON.stringify(s)); assert.equal(getAttemptRemaining(s.attempts.at(-1)!, now + 300000), 540000);
  s = executeQuiz(s, 's1', { type: 'resumeQuiz', attemptId }, now + 300000); assert.equal(getAttemptRemaining(s.attempts.at(-1)!, now + 360000), 480000);
  s = executeQuiz(s, 's1', { type: 'pauseQuiz', attemptId }, now + 360000); s = end(s, 'syncQuiz', Date.parse(dueAt)); assert.equal(s.attempts.at(-1)!.submissionReason, 'deadline');
});

test('explicit Test interruption records zero, duration simulation leaves shared clock unchanged', () => {
  const s = end(answer(started('test')), 'simulateTestExit'); assert.equal(s.attempts.at(-1)!.score, 0); assert.equal(s.attempts.at(-1)!.valid, true);
  const initial = started(); const simulated = end(answer(initial), 'simulateQuizExpiry'); assert.equal(simulated.referenceTime, initial.referenceTime); assert.equal(simulated.attempts.at(-1)!.score, 50);
});

test('attempt ownership, valid answer and Test pause restrictions', () => {
  const s = started('test'); const attemptId = s.attempts.at(-1)!.id!;
  assert.throws(() => executeQuiz(s, 's2', { type: 'syncQuiz', attemptId }, now));
  assert.throws(() => answer(s, 'q1', 'missing')); assert.throws(() => executeQuiz(s, 's1', { type: 'pauseQuiz', attemptId }, now));
});

test('retake approval requires deadline, rejection reason, approval notifies admin and preserves best', () => {
  let s = end(answer(started('test')), 'simulateQuizExpiry'); const quizId = s.quizzes.at(-1)!.id;
  s = executeQuiz(s, 's1', { type: 'requestRetake', quizId, reason: 'Ôn lại' }, now); const requestId = s.requests.at(-1)!.id;
  assert.throws(() => executeQuiz(s, 't1', { type: 'decideRetake', requestId, approved: false, reason: '' }, now));
  assert.throws(() => executeQuiz(s, 't1', { type: 'decideRetake', requestId, approved: true, reason: 'Đồng ý' }, now));
  s = executeQuiz(s, 't1', { type: 'decideRetake', requestId, approved: true, reason: 'Đồng ý', newDueAt: dueAt }, now);
  assert(s.notifications.some(n => n.recipientId === 'a1' && n.description.includes('Đồng ý')));
  assert.equal(getQuizAvailability(s, quizId, 's1', now).remainingAttempts, 1);
  s = executeQuiz(s, 's1', { type: 'startQuiz', quizId }, now); s = end(s, 'simulateTestExit');
  assert.equal(getQuizAvailability(s, quizId, 's1', now).bestScore, 50);
});

test('per-student and whole-class extra grants are scoped and assignment limited to ten', () => {
  let s = published(); const quizId = s.quizzes.at(-1)!.id;
  assert.throws(() => executeQuiz(s, 't1', { type: 'reopenQuiz', quizId, extraAttempts: 11, newDueAt: dueAt, reason: 'Thêm' }, now));
  s = executeQuiz(s, 't1', { type: 'reopenQuiz', quizId, studentId: 's1', extraAttempts: 2, newDueAt: dueAt, reason: 'Thêm' }, now);
  assert.equal(getQuizAvailability(s, quizId, 's1', now).remainingAttempts, 12); assert.equal(getQuizAvailability(s, quizId, 's2', now).remainingAttempts, 10);
  s = executeQuiz(s, 't1', { type: 'reopenQuiz', quizId, extraAttempts: 1, newDueAt: dueAt, reason: 'Cả lớp' }, now);
  assert.equal(getQuizAvailability(s, quizId, 's2', now).remainingAttempts, 11); assert(isValidState(s));
});

test('migration adds deterministic content and distinct attempt ids preserving historical scores', () => {
  const s = createInitialState(); const original = s.attempts[0]; s.attempts.push({ quizId: original.quizId, studentId: original.studentId, score: 93, valid: true });
  const migrated = migrateQuizState(s); assert.equal(migrated.attempts.at(-1)!.score, 93); assert.equal(new Set(migrated.attempts.map(a => a.id)).size, migrated.attempts.length); assert.deepEqual(migrateQuizState(migrated), migrated);
  assert(migrated.quizzes.every(q => q.questions?.length === 3)); assert(isValidState(migrated));
});

test('persisted malformed active attempts and question snapshots are rejected', () => {
  const s = started(); s.attempts.at(-1)!.remainingMs = -1; assert.equal(isValidState(s), false);
  const q = draft(); q.quizzes.at(-1)!.questions![0].correctOptionId = 'missing'; assert.equal(isValidState(q), false);
});

test('custom initial assignment cap accepts more than ten while system timer finalizes inaccessible students', () => {
  let s = draft(); const q = s.quizzes.at(-1)!;
  s = executeQuiz(s, 't1', { type: 'saveQuiz', quizId: q.id, classId: q.classId, kind: 'assignment', title: q.title, passingScore: q.passingScore, timeLimitMinutes: 10, opensAt: q.opensAt, dueAt: q.dueAt, questions, attemptLimit: 20 }, now);
  assert.equal(s.quizzes.at(-1)!.attemptLimit, 20); assert(isValidState(s));
  s = answer(started()); s.users.find(u => u.id === 's1')!.status = 'suspended';
  s.enrollments.find(e => e.studentId === 's1' && e.classId === 'giai-tich')!.status = 'removed';
  const final = syncDueQuizAttempts(s, now + 600000);
  assert.equal(final.attempts.at(-1)!.score, 50); assert.equal(final.attempts.at(-1)!.status, 'submitted'); assert.equal(s.attempts.at(-1)!.status, 'active');
  assert.equal(syncDueQuizAttempts(final, now + 600001), final);
});

test('content remains locked after re-enrollment removes the last student attempt', () => {
  let s = started(); const quiz = s.quizzes.at(-1)!;
  assert.equal(quiz.contentLocked, true);
  s = execute(s, 't1', { type: 'removeStudent', classId: quiz.classId, studentId: 's1', reason: 'Rút lớp' }, now);
  s = execute(s, 's1', { type: 'requestEnrollment', classId: quiz.classId, reason: 'Tham gia lại' }, now);
  s = execute(s, 't1', { type: 'decideEnrollment', requestId: s.requests.at(-1)!.id, decision: 'approved', reason: '' }, now);
  assert.equal(s.attempts.filter(a => a.quizId === quiz.id).length, 0);
  s = migrateQuizState(s);
  assert.equal(s.quizzes.at(-1)!.contentLocked, true);
  assert.throws(() => executeQuiz(s, 't1', { type: 'saveQuiz', quizId: quiz.id, classId: quiz.classId, kind: quiz.kind, title: 'Đổi đề', passingScore: 80, timeLimitMinutes: 20, opensAt: quiz.opensAt, dueAt: quiz.dueAt, questions }, now));
  const legacy = createInitialState(); delete legacy.quizzes[0].contentLocked;
  assert.equal(migrateQuizState(legacy).quizzes[0].contentLocked, true);
  const corrupt = createInitialState(); Object.assign(corrupt.quizzes[0], { contentLocked: 'invalid' });
  assert.equal(isValidState(migrateQuizState(corrupt)), false);
});
