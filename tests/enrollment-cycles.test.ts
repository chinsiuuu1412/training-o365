import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, isValidState } from '../src/mocks/state.ts';
import { execute, getEnrollmentState, memberCount, isExpired, canAccessClass, getEnrollmentRequests } from '../src/mocks/services/management.ts';
import { currentCycleId, captureEnrollmentContext, migrateEnrollmentCycles } from '../src/mocks/services/enrollment-cycles.ts';
import { getEnrollmentHistory } from '../src/mocks/services/enrollment-history.ts';
import { getProgressDetails } from '../src/mocks/services/progress.ts';
import { getQuizAvailability, syncDueQuizAttempts } from '../src/mocks/services/quizzes.ts';
import { decodeDemoStore } from '../src/mocks/demo-storage.ts';
import { demoLoginCode, loginMock, requireMockSession } from '../src/mocks/services/authentication.ts';
import { advanceDemoClock, getDemoTime } from '../src/mocks/demo-clock.ts';

const now = Date.parse('2026-11-14T09:00:00+07:00');
test('relative clock advancement uses latest elapsed time rather than the pre-reload display epoch', () => {
  const store = { version: 4 as const, state: createInitialState(), demoEpoch: now, realEpoch: 1000 };
  const advanced = advanceDemoClock(store, 600000, 61000);
  assert.equal(advanced.demoEpoch, now + 660000);
  assert.equal(getDemoTime(advanced, 62000), now + 661000);
  assert.equal(store.demoEpoch, now);
  assert.throws(() => advanceDemoClock(store, -1, 61000));
});
function rejoin(original = createInitialState()) {
  let state = execute(original, 't1', { type: 'removeStudent', classId: 'giai-tich', studentId: 's1', reason: 'Kết thúc lần cũ' }, now);
  state = execute(state, 's1', { type: 'requestEnrollment', classId: 'giai-tich', reason: 'Xin học lại' }, now);
  const requestId = state.requests.findLast(request => request.kind === 'enrollment' && request.senderId === 's1')!.id;
  return execute(state, 't1', { type: 'decideEnrollment', requestId, decision: 'approved', reason: '' }, now);
}

test('class date uses the Vietnam end of day, rejects impossible dates and expired-class mutations', () => {
  const state = createInitialState(); const course = state.classes[0];
  course.expiresAt = '2026-11-14';
  assert(!isExpired(course, Date.parse('2026-11-14T23:59:59.999+07:00')));
  assert(isExpired(course, Date.parse('2026-11-15T00:00:00+07:00')));
  assert.throws(() => execute(state, 'a1', { type: 'saveClass', course: { ...course, expiresAt: '2027-02-30' }, reason: '' }, now), /Ngày/);
  assert.throws(() => execute(state, 'a1', { type: 'saveClass', course: { ...course, expiresAt: '2027-01-01' }, reason: 'Mở lại' }, now + 86400000), /hết hạn/);
  const fresh = execute(createInitialState(), 'a1', { type: 'saveClass', course: { ...course, id: '', code: 'DEMO-NEW', expiresAt: '2027-01-01' }, reason: '' }, now);
  const newClass = fresh.classes.at(-1)!;
  const configured = execute(fresh, 't1', { type: 'setLessonCount', classId: newClass.id, count: 3 }, now);
  assert.equal(configured.classes.at(-1)!.totalLessons, 3);
  assert.throws(() => execute(configured, 't1', { type: 'setLessonCount', classId: newClass.id, count: 4 }, now));
  assert.throws(() => execute(fresh, 't2', { type: 'setLessonCount', classId: newClass.id, count: 3 }, now));
  assert.throws(() => execute(fresh, 't1', { type: 'setLessonCount', classId: newClass.id, count: 3 }, Date.parse('2027-01-02T00:00:00+07:00')));
});

test('pending requests do not reserve seats; sequential approval of the last seat has one winner', () => {
  let state = createInitialState(); const course = state.classes.find(item => item.id === 'dai-so')!;
  course.capacity = memberCount(state, course.id) + 1;
  const count = memberCount(state, course.id);
  state = execute(state, 's6', { type: 'requestEnrollment', classId: course.id, reason: 'Xin suất cuối' }, now);
  assert.equal(memberCount(state, course.id), count);
  const second = state.requests.findLast(request => request.kind === 'enrollment' && request.senderId === 's6')!;
  state = execute(state, 't1', { type: 'decideEnrollment', requestId: 'r4', decision: 'approved', reason: '' }, now);
  const serialized = JSON.stringify(state);
  assert.throws(() => execute(state, 't1', { type: 'decideEnrollment', requestId: second.id, decision: 'approved', reason: '' }, now), /đủ sĩ số/);
  assert.equal(JSON.stringify(state), serialized);
  assert.equal(memberCount(state, course.id), course.capacity);
});

test('reassignment transfers queue access and rejects commands from the old Manager', () => {
  const original = createInitialState(); const course = original.classes.find(course => course.id === 'dai-so')!;
  assert.throws(() => execute(original, 'a1', { type: 'saveClass', course: { ...course, managerId: 't2' }, reason: '' }, now));
  const state = execute(original, 'a1', { type: 'saveClass', course: { ...course, managerId: 't2' }, reason: 'Đổi phụ trách' }, now);
  assert.equal(getEnrollmentRequests(state, 't1', course.id).length, 0);
  assert(getEnrollmentRequests(state, 't2', course.id).some(request => request.id === 'r4'));
  assert.throws(() => execute(state, 't1', { type: 'decideEnrollment', requestId: 'r4', decision: 'approved', reason: '' }, now));
  assert.doesNotThrow(() => execute(state, 't2', { type: 'decideEnrollment', requestId: 'r4', decision: 'approved', reason: '' }, now));
  assert.deepEqual(state.attendance, original.attendance); assert.deepEqual(state.materials, original.materials);
});

test('decline cooldown boundary and reason survive cancel; three declines persist for the Student-class pair', () => {
  let state = createInitialState(); let time = now;
  for (let index = 1; index <= 3; index++) {
    const pending = state.requests.findLast(request => request.classId === 'dai-so' && request.senderId === 's3' && request.status === 'waiting')!;
    state = execute(state, 't1', { type: 'decideEnrollment', requestId: pending.id, decision: 'declined', reason: 'Cần bổ sung' }, time);
    assert.equal(getEnrollmentState(state, 'dai-so', 's3', time).declineCount, index);
    assert.throws(() => execute(state, 's3', { type: 'requestEnrollment', classId: 'dai-so', reason: 'Lý do mới ' + index }, time + 599999));
    if (index < 3) {
      time += 600000;
      state = execute(state, 's3', { type: 'requestEnrollment', classId: 'dai-so', reason: 'Lý do mới ' + index }, time);
      const staleCancel = captureEnrollmentContext(state, 's3', { type: 'cancelEnrollment' as const, classId: 'dai-so' });
      state = execute(state, 's3', staleCancel, time);
      assert.equal(getEnrollmentState(state, 'dai-so', 's3', time).declineCount, index);
      assert.throws(() => execute(state, 's3', { type: 'requestEnrollment', classId: 'dai-so', reason: pending.description }, time), /lý do mới/);
      state = execute(state, 's3', { type: 'requestEnrollment', classId: 'dai-so', reason: 'Sau hủy ' + index }, time);
      assert.throws(() => execute(state, 's3', staleCancel, time), /yêu cầu/);
    }
  }
  assert.throws(() => execute(state, 's3', { type: 'requestEnrollment', classId: 'dai-so', reason: 'Lần thứ tư' }, time + 600000), /3/);
});

test('re-enrollment preserves all old records and grants while new-cycle progress and attempt budget start fresh', () => {
  let original = createInitialState();
  original = execute(original, 't1', { type: 'reopenQuiz', quizId: 'giai-tich-q1', studentId: 's1', reason: 'Lượt cũ', extraAttempts: 1, newDueAt: '2026-11-20T09:00:00+07:00' }, now);
  const oldCycle = currentCycleId(original, 'giai-tich', 's1')!;
  const state = rejoin(original);
  const newCycle = currentCycleId(state, 'giai-tich', 's1')!;
  assert.notEqual(oldCycle, newCycle);
  assert.deepEqual(state.attendance, original.attendance); assert.deepEqual(state.attempts, original.attempts);
  assert.equal(getProgressDetails(state, 'giai-tich', 's1').attendedSessions, 0);
  assert.equal(getProgressDetails(state, 'giai-tich', 's1').passedQuizzes, 0);
  assert(getProgressDetails(state, 'giai-tich', 's1', oldCycle).attendedSessions > 0);
  assert.equal(getQuizAvailability(state, 'giai-tich-q1', 's1', now).remainingAttempts, 1);
  assert.equal(getQuizAvailability(state, 'giai-tich-q1', 's1', now).effectiveDueAt, state.quizzes[0].dueAt);
  assert.equal(state.enrollmentCycles!.filter(cycle => cycle.classId === 'giai-tich' && cycle.studentId === 's1').length, 2);
  assert(isValidState(state));
});

test('old-cycle user actions are rejected and automatic finalization updates only the old cycle', () => {
  let original = execute(createInitialState(), 's1', { type: 'startQuiz', quizId: 'giai-tich-q6' }, now);
  const attempt = original.attempts.at(-1)!;
  const stale = captureEnrollmentContext(original, 't1', { type: 'removeStudent' as const, classId: 'giai-tich', studentId: 's1', reason: 'Thao tác cũ' });
  const staleCode = captureEnrollmentContext(original, 's1', { type: 'enterAttendance' as const, lessonId: 'giai-tich-l9', code: 'HOCVIET' });
  original = rejoin(original);
  assert.throws(() => execute(original, 't1', stale, now), /lần ghi danh/i);
  assert.throws(() => execute(original, 's1', staleCode, now), /lần ghi danh/i);
  assert.throws(() => execute(original, 's1', { type: 'answerQuiz', attemptId: attempt.id!, questionId: attempt.questions![0].id, optionId: attempt.questions![0].options[0].id }, now), /lần ghi danh/);
  const final = syncDueQuizAttempts(original, now + 3600000);
  assert.equal(final.attempts.find(item => item.id === attempt.id)!.status, 'submitted');
  assert.equal(getProgressDetails(final, 'giai-tich', 's1').passedQuizzes, 0);
});

test('removed or expired Student gets own cycle summaries without class contents; history uses current thresholds', () => {
  const original = createInitialState();
  const removed = execute(original, 'a1', { type: 'removeStudent', classId: 'giai-tich', studentId: 's1', reason: 'Kết thúc' }, now);
  assert(!canAccessClass(removed, 's1', 'giai-tich'));
  const rows = getEnrollmentHistory(removed, 's1', now, 'giai-tich');
  assert.equal(rows.length, 1); assert.equal(rows[0].ended, true);
  assert(rows[0].progress.attendedSessions > 0);
  assert(!JSON.stringify(rows).includes('correctOptionId')); assert(!JSON.stringify(rows).includes('attendanceCode'));
  assert(rows.every(row => row.studentId === 's1'));
  removed.classes[0].expiresAt = '2026-11-14';
  assert(!canAccessClass({ ...removed, referenceTime: '2026-11-15T00:00:00+07:00' }, 's1', 'giai-tich'));
  removed.classes[0].attendanceThreshold = 99;
  assert.equal(getEnrollmentHistory(removed, 's1', now, 'giai-tich')[0].attendanceThreshold, 99);
  assert.equal(getEnrollmentHistory(removed, 't2', now, 'giai-tich').length, 0);
});

test('migration preserves P1 demo data and sessions; corrupt cross-cycle references fail validation', () => {
  const state = createInitialState();
  const legacy = structuredClone(state); delete legacy.enrollmentCycles;
  for (const enrollment of legacy.enrollments) delete enrollment.cycleId;
  for (const record of [...legacy.attendance, ...legacy.attempts, ...legacy.assignmentDrafts]) delete record.cycleId;
  const migrated = migrateEnrollmentCycles(legacy);
  assert.equal(migrated.attendance.length, state.attendance.length); assert(isValidState(migrated));
  const decoded = decodeDemoStore(JSON.stringify({ version: 2, state: { ...legacy, mockGeneration: 'demo-p1', mockSessions: [] }, demoEpoch: now, realEpoch: now }));
  assert.equal(decoded.version, 4); assert.equal(decoded.state.mockGeneration, 'demo-p1'); assert(decoded.state.enrollmentCycles!.length > 0);
  const corrupt = structuredClone(migrated); corrupt.attendance[0].cycleId = 'unknown-cycle'; assert(!isValidState(corrupt));
  const wrong = migrated.enrollmentCycles!.find(cycle => cycle.studentId !== migrated.attendance[0].studentId)!;
  const crossCycle = structuredClone(migrated);
  crossCycle.attendance[0].cycleId = wrong.id; assert(!isValidState(crossCycle));
});

test('bulk grants stay bound to the original cycles and P1 session metadata survives schema migration', () => {
  const original = execute(createInitialState(), 't1', { type: 'reopenQuiz', quizId: 'giai-tich-q1', reason: 'Cấp cả lớp cũ', extraAttempts: 2, newDueAt: '2026-11-20T09:00:00+07:00' }, now);
  assert(getQuizAvailability(original, 'giai-tich-q1', 's1', now).remainingAttempts > 1);
  const returned = rejoin(original);
  assert.equal(getQuizAvailability(returned, 'giai-tich-q1', 's1', now).remainingAttempts, 1);
  const state = createInitialState(); state.mockGeneration = 'p1-dataset';
  const loggedIn = loginMock(state, state.users[0].email!, demoLoginCode(state.users[0]), now, 'p1-session');
  delete loggedIn.state.enrollmentCycles;
  const store = decodeDemoStore(JSON.stringify({ version: 2, state: loggedIn.state, demoEpoch: now, realEpoch: now }));
  assert.equal(requireMockSession(store.state, loggedIn.session).id, 'a1');
  assert.match(store.migrationNotice!, /schema 4/);
});

test('historical completion recomputes exact thresholds without restoring class access', () => {
  let state = createInitialState(); const course = state.classes[0];
  course.totalLessons = 1; course.attendanceThreshold = 80; course.quizThreshold = 50;
  const lesson = state.lessons.find(lesson => lesson.classId === course.id)!;
  const quiz = state.quizzes.find(quiz => quiz.classId === course.id)!;
  state.lessons = state.lessons.filter(item => item.classId !== course.id || item.id === lesson.id);
  state.quizzes = state.quizzes.filter(item => item.classId !== course.id || item.id === quiz.id);
  state.schedules.push({ id: 'history-approved', lessonId: lesson.id, status: 'approved', startsAt: '2026-11-13T08:00:00+07:00', endsAt: '2026-11-13T09:00:00+07:00' });
  const cycleId = currentCycleId(state, course.id, 's1');
  state.attendance = [{ lessonId: lesson.id, studentId: 's1', cycleId, recorded: true }];
  state.attempts = [{ quizId: quiz.id, studentId: 's1', cycleId, score: 100, valid: true, status: 'submitted' }];
  state = execute(state, 'a1', { type: 'removeStudent', classId: course.id, studentId: 's1', reason: 'Đã học xong' }, now);
  assert(getEnrollmentHistory(state, 's1', now, course.id)[0].completed);
  assert(!canAccessClass(state, 's1', course.id));
  state.attendance[0].recorded = false;
  assert(!getEnrollmentHistory(state, 's1', now, course.id)[0].completed);
  state.classes[0].attendanceThreshold = 0;
  assert(getEnrollmentHistory(state, 's1', now, course.id)[0].completed);
  assert(!canAccessClass(state, 's1', course.id));
});
