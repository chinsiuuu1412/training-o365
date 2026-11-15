import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, isValidState } from '../src/mocks/state.ts';
import { execute } from '../src/mocks/services/management.ts';
import { demoLoginCode, loginMock, logoutMock, requireMockSession, getVisibleAccount } from '../src/mocks/services/authentication.ts';
import { executeAuthenticated } from '../src/mocks/services/session-command.ts';
import { legacyDestination } from '../src/config/legacy-routes.ts';
import { decodeDemoStore, DEMO_STORE_KEY } from '../src/mocks/demo-storage.ts';

const now = Date.parse('2026-11-14T09:00:00+07:00');
function login(userId = 's1') {
  const state = createInitialState();
  const user = state.users.find(user => user.id === userId)!;
  return loginMock(state, user.email!, demoLoginCode(user), now, `mock-${userId}`);
}

test('mock login uses case-insensitive email, generic errors and explicit role authorization', () => {
  const { state, session } = login();
  assert.equal(requireMockSession(state, session, 'student').id, 's1');
  assert.throws(() => requireMockSession(state, session, 'admin'));
  assert.throws(() => requireMockSession(state, null, 'student'));
  assert.equal(loginMock(createInitialState(), state.users.find(u => u.id === 's1')!.email!.toUpperCase(), demoLoginCode(state.users.find(u => u.id === 's1')!), now, 'other').session.userId, 's1');
  const error = (email: string) => { try { loginMock(state, email, 'incorrect', now, 'bad'); } catch (cause) { return (cause as Error).message; } };
  assert.equal(error('missing@sis.hust.edu.vn'), error(state.users.find(u => u.id === 's1')!.email!));
});

test('logout, password reset/change and suspend invalidate old mock sessions, including after restore', () => {
  const { state, session } = login();
  assert.throws(() => requireMockSession(logoutMock(state, session), session));
  const admin = loginMock(state, state.users[0].email!, demoLoginCode(state.users[0]), now, 'admin');
  const reset = executeAuthenticated(admin.state, admin.session, { type: 'resetDemoPassword', userId: 's1' }, now);
  assert.throws(() => requireMockSession(reset, session));
  const user = reset.users.find(u => u.id === 's1')!;
  assert.notEqual(demoLoginCode(user), demoLoginCode(state.users.find(u => u.id === 's1')!));
  const reentered = loginMock(reset, user.email!, demoLoginCode(user), now, 'reentered');
  const changed = executeAuthenticated(reentered.state, reentered.session, { type: 'changeDemoPassword', currentCode: demoLoginCode(user) }, now);
  assert.throws(() => requireMockSession(changed, reentered.session));
  assert.throws(() => executeAuthenticated(reentered.state, reentered.session, { type: 'resetDemoPassword', userId: 't1' }, now));
  const suspended = executeAuthenticated(admin.state, admin.session, { type: 'setAccountStatus', userId: 's1', suspended: true, reason: 'Kiểm tra demo' }, now);
  const restored = executeAuthenticated(suspended, admin.session, { type: 'setAccountStatus', userId: 's1', suspended: false, reason: 'Khôi phục demo' }, now);
  assert.throws(() => requireMockSession(restored, session));
  assert.deepEqual(suspended.enrollments, state.enrollments);
  const manager = login('t1');
  const suspendedManager = execute(manager.state, 'a1', { type: 'setAccountStatus', userId: 't1', suspended: true, reason: 'Mô phỏng' }, now);
  assert.deepEqual(suspendedManager.classes, manager.state.classes);
  assert.equal(demoLoginCode(suspendedManager.users.find(user => user.id === 't1')!), demoLoginCode(manager.state.users.find(user => user.id === 't1')!));
  assert.throws(() => requireMockSession(suspendedManager, manager.session));
});

test('Student profile requires fields, exact domain and unique text MSSV/email preserving leading zeros', () => {
  const state = createInitialState();
  const data = { type: 'saveAccount' as const, role: 'student' as const, name: 'Học viên tổng hợp', email: 'new@sis.hust.edu.vn', phone: '0012345678', studentNumber: '0000123', school: 'Viện mô phỏng', universityClass: 'Lớp mẫu - K71', gender: '' };
  const saved = execute(state, 'a1', data, now);
  const user = saved.users.at(-1)!;
  assert.equal(user.studentNumber, '0000123'); assert.equal(user.phone, '0012345678');
  for (const field of ['name', 'phone', 'studentNumber', 'school', 'universityClass'] as const) assert.throws(() => execute(state, 'a1', { ...data, [field]: '' }, now));
  for (const email of ['new@fake-sis.hust.edu.vn', 'new@sub.sis.hust.edu.vn', 'new@sis.hust.edu.vn.example']) assert.throws(() => execute(state, 'a1', { ...data, email }, now));
  assert.throws(() => execute(saved, 'a1', { ...data, email: 'other@sis.hust.edu.vn' }, now + 1));
  assert.throws(() => execute(saved, 'a1', { ...data, studentNumber: 'different', email: data.email.toUpperCase() }, now + 1));
  assert.doesNotThrow(() => execute(state, 'a1', { type: 'saveAccount', role: 'manager', name: 'Quản lý mẫu', email: 'manager@example.invalid', phone: '' }, now));
  assert(isValidState(saved));
});

test('profile projections restrict Student to self and Manager to currently enrolled students of assigned classes', () => {
  const student = login();
  assert.equal(getVisibleAccount(student.state, student.session, 's1').id, 's1');
  assert.throws(() => getVisibleAccount(student.state, student.session, 's2'));
  const manager = login('t1');
  assert.equal(getVisibleAccount(manager.state, manager.session, 's1').id, 's1');
  assert.throws(() => getVisibleAccount(manager.state, manager.session, 't2'));
  const reassigned = execute(manager.state, 'a1', { type: 'saveClass', course: { ...manager.state.classes[0], managerId: 't2' }, reason: 'Đổi phụ trách' }, now);
  const removed = execute(reassigned, 'a1', { type: 'removeStudent', classId: 'dai-so', studentId: 's1', reason: 'Mô phỏng' }, now);
  assert.throws(() => getVisibleAccount(removed, manager.session, 's1'));
});

test('legacy routes preserve equivalent class/tab links and reject unknown or unsafe targets', () => {
  assert.equal(legacyDestination('/teacher/classes/giai-tich', 'tab=students'), '/manager/classes/giai-tich?tab=students');
  assert.equal(legacyDestination('/teacher'), '/manager');
  assert.equal(legacyDestination('/admin/teachers'), '/admin/managers');
  assert.equal(legacyDestination('/teacher/unknown'), null);
  assert.equal(legacyDestination('/teacher/../admin'), null);
});

test('demo v2 storage rejects v1/corruption with reset feedback and never silently overwrites legacy data', () => {
  assert.match(DEMO_STORE_KEY, /o365.*demo.*v2/);
  assert.throws(() => decodeDemoStore(JSON.stringify({ version: 1, state: createInitialState() })), /Khôi phục/);
  assert.throws(() => decodeDemoStore('{broken'), /Khôi phục/);
  assert.throws(() => decodeDemoStore(JSON.stringify({ version: 2, state: {} })), /Khôi phục/);
});

test('a valid v2 store restores a session while dataset reset and malformed session records invalidate it', () => {
  const { state, session } = login();
  state.mockGeneration = session.generation;
  const restored = decodeDemoStore(JSON.stringify({ version: 2, state, demoEpoch: now, realEpoch: now }));
  assert.equal(requireMockSession(restored.state, session).id, 's1');
  assert.throws(() => requireMockSession({ ...restored.state, mockGeneration: 'new-dataset' }, session));
  const corrupt = structuredClone(state);
  corrupt.mockSessions![0].revision = -1;
  assert(!isValidState(corrupt));
  assert(!JSON.stringify(state).includes('currentCode'));
  assert(!JSON.stringify(state).includes(demoLoginCode(state.users.find(user => user.id === 's1')!)));
});

test('authenticated dispatch rejects stale or forged session metadata before any domain mutation', () => {
  const { state, session } = login('t1');
  assert.throws(() => executeAuthenticated(state, { ...session, role: 'admin' }, { type: 'setAccountStatus', userId: 's1', suspended: true, reason: 'Forbidden' }, now));
  const exited = logoutMock(state, session);
  assert.throws(() => executeAuthenticated(exited, session, { type: 'setLessonCount', classId: 'giai-tich', count: 1 }, now));
  assert.equal(state.users.find(user => user.id === 's1')!.status, 'active');
});
