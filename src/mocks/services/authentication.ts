import type { LmsState, MockSession, Role, User } from '../../types/lms.ts';

export type SecurityCommand = { type: 'resetDemoPassword'; userId: string } | { type: 'changeDemoPassword'; currentCode: string };
const failure = 'Email hoặc mã đăng nhập mô phỏng không đúng.';
export function demoLoginCode(user: User) { return `O365-DEMO-${user.id}-v${user.credentialVersion ?? 1}`; }
export function requireMockSession(state: LmsState, session: MockSession | null, role?: Role): User {
  const user = session && state.users.find(user => user.id === session.userId);
  const record = session && state.mockSessions?.find(record => record.id === session.id && record.userId === session.userId);
  if (!session || !user || user.status === 'suspended' || user.role !== session.role || session.generation !== (state.mockGeneration ?? 'seed-demo') || session.revision !== (user.sessionVersion ?? 1) || !record || record.revoked || record.revision !== session.revision || record.role !== session.role || record.generation !== session.generation) throw new Error('Phiên mô phỏng đã hết hiệu lực. Vui lòng đăng nhập lại.');
  if (role && user.role !== role) throw new Error('Bạn không có quyền truy cập vai trò này.');
  return user;
}
export function loginMock(original: LmsState, email: string, code: string, now: number, id: string) {
  const user = original.users.find(user => user.email?.trim().toLowerCase() === email.trim().toLowerCase());
  if (!user || user.status === 'suspended' || code !== demoLoginCode(user)) throw new Error(failure);
  if (original.mockSessions?.some(session => session.id === id)) throw new Error('Định danh phiên mô phỏng bị trùng.');
  const state = structuredClone(original);
  const session: MockSession = { id, userId: user.id, role: user.role, revision: user.sessionVersion ?? 1, generation: state.mockGeneration ?? 'seed-demo' };
  state.mockSessions ??= [];
  state.mockSessions.push({ ...session, issuedAt: new Date(now).toISOString(), revoked: false });
  return { state, session };
}
export function logoutMock(original: LmsState, session: MockSession | null) {
  const state = structuredClone(original);
  const record = state.mockSessions?.find(record => record.id === session?.id && record.userId === session?.userId);
  if (record) record.revoked = true;
  return state;
}
export function executeAccountSecurity(original: LmsState, actorId: string, command: SecurityCommand): LmsState {
  const state = structuredClone(original);
  const actor = state.users.find(user => user.id === actorId);
  if (!actor || actor.status === 'suspended') throw new Error('Tài khoản không khả dụng.');
  const target = command.type === 'changeDemoPassword' ? actor : state.users.find(user => user.id === command.userId);
  if (!target || (command.type === 'resetDemoPassword' && (actor.role !== 'admin' || target.role === 'admin'))) throw new Error('Chỉ Admin cấp lại mã cho Student/Manager.');
  if (command.type === 'changeDemoPassword' && command.currentCode !== demoLoginCode(actor)) throw new Error('Mã đăng nhập mô phỏng hiện tại không đúng.');
  target.credentialVersion = (target.credentialVersion ?? 1) + 1;
  target.sessionVersion = (target.sessionVersion ?? 1) + 1;
  return state;
}
export function getVisibleAccount(state: LmsState, session: MockSession | null, userId: string): User {
  const actor = requireMockSession(state, session);
  const target = state.users.find(user => user.id === userId);
  const permitted = target && (actor.id === target.id || actor.role === 'admin' || (actor.role === 'manager' && target.role === 'student' && state.classes.some(course => course.managerId === actor.id && state.enrollments.some(enrollment => enrollment.classId === course.id && enrollment.studentId === target.id && enrollment.status === 'approved'))));
  if (!permitted || !target) throw new Error('Bạn không có quyền xem hồ sơ này.');
  // Return a projection, not the session/credential metadata from the account entity.
  return { id: target.id, name: target.name, role: target.role, initials: target.initials, email: target.email, phone: target.phone, studentNumber: target.studentNumber, school: target.school, universityClass: target.universityClass, gender: target.gender, status: target.status, statusReason: target.statusReason };
}
