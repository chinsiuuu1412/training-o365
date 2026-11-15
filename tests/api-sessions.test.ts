import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../src/lib/api/client.ts';
import { AuthService } from '../src/lib/api/auth.ts';
import { SessionsService, remainingAttendanceAttempts } from '../src/lib/api/sessions.ts';
import { enrollmentId } from '../src/lib/api/dto.ts';
import { createFixtureTransport } from '../src/mocks/api-fixture.ts';
import { EnrollmentService } from '../src/lib/api/enrollments.ts';
import { DashboardService } from '../src/lib/api/dashboard.ts';

async function setup() {
    const fixture = createFixtureTransport(), client = new ApiClient(fixture.transport);
    const auth = new AuthService(client), service = new SessionsService(client);
    await auth.login('manager1@example.test', 'O365-demo-12345');
    return { fixture, client, auth, service };
}
const codeError = (code: string) => (error: unknown) => error instanceof ApiError && error.code === code;
const times = { starts_at: '2026-11-21T02:00:00Z', ends_at: '2026-11-21T04:00:00Z' };

test('Manager draft/submit and Admin review preserve effective schedule until approval; duplicate actions rejected', async () => {
    const { fixture, auth, service } = await setup();
    const old = (await service.detail('manager', 1, 11)).session;
    const draft = await service.saveDraft(1, 11, times);
    assert.equal(draft.status, 'draft');
    assert.equal((await service.saveDraft(1, 11, times)).id, draft.id);
    await service.submit(1, 11, draft.id);
    await assert.rejects(() => service.submit(1, 11, draft.id), codeError('proposal_processed'));
    await assert.rejects(() => service.saveDraft(1, 11, times), codeError('schedule_pending'));
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    assert.equal((await service.detail('student', 1, 11)).session.starts_at, old.starts_at);
    assert.equal('attendance_code' in (await service.detail('student', 1, 11)).session, false);
    await auth.login('admin@example.test', 'O365-demo-12345');
    assert((await service.pending()).items.some(row => row.id === draft.id));
    await service.review(1, 11, draft.id, 'reject', 'Đổi phòng học');
    assert.equal((await service.detail('admin', 1, 11)).session.starts_at, old.starts_at);
    await auth.login('manager1@example.test', 'O365-demo-12345');
    const next = await service.saveDraft(1, 11, times);
    assert.notEqual(next.id, draft.id);
    await service.submit(1, 11, next.id);
    await auth.login('admin@example.test', 'O365-demo-12345');
    await service.review(1, 11, next.id, 'approve');
    await assert.rejects(() => service.review(1, 11, next.id, 'approve'), codeError('proposal_processed'));
    assert.equal((await service.detail('admin', 1, 11)).session.starts_at, times.starts_at);
    fixture.setTime(Date.parse(times.starts_at));
    await auth.login('manager1@example.test', 'O365-demo-12345');
    await assert.rejects(() => service.saveDraft(1, 11, { starts_at: '2026-11-22T02:00:00Z', ends_at: '2026-11-22T04:00:00Z' }), codeError('session_started'));
});

test('Session metadata, fixed numbering, draft time validation and stale approval are enforced', async () => {
    const { fixture, auth, service } = await setup();
    const session = await service.create(1, { session_number: 3, title: 'Thực hành Word', description: '', location: '', attendance_code: 'WORD03' });
    assert.equal(session.starts_at, null);
    await assert.rejects(() => service.create(1, { session_number: 3, title: 'Trùng', description: '', location: '', attendance_code: 'A' }), codeError('session_exists'));
    await assert.rejects(() => service.create(1, { session_number: 4, title: 'Ngoài tổng', description: '', location: '', attendance_code: 'A' }));
    await assert.rejects(() => service.saveDraft(1, session.id, { starts_at: 'bad', ends_at: times.ends_at }));
    const draft = await service.saveDraft(1, session.id, times);
    await service.submit(1, session.id, draft.id);
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    await assert.rejects(() => service.detail('student', 1, session.id), codeError('not_found'));
    await auth.login('admin@example.test', 'O365-demo-12345');
    fixture.setTime(Date.parse(times.starts_at));
    await assert.rejects(() => service.review(1, session.id, draft.id, 'approve'), codeError('schedule_in_past'));
    assert.equal((await service.detail('admin', 1, session.id)).proposals[0].status, 'pending');
});

test('Attendance start inclusive/end exclusive, idempotent credit and 422 durable wrong attempts survive a fresh client', async () => {
    const { fixture, auth, service } = await setup();
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    const start = Date.parse('2026-11-20T02:00:00Z'), end = Date.parse('2026-11-20T04:00:00Z');
    fixture.setTime(start - 1);
    await assert.rejects(() => service.attend(1, 11, enrollmentId(1000), 'WORD02'), codeError('attendance_closed'));
    fixture.setTime(start);
    for (const remaining of [2, 1, 0]) {
        await assert.rejects(() => service.attend(1, 11, enrollmentId(1000), 'wrong'), error => remainingAttendanceAttempts(error) === remaining);
    }
    const reload = createFixtureTransport(fixture.shared), reloadClient = new ApiClient(reload.transport), reloaded = new SessionsService(reloadClient);
    await new AuthService(reloadClient).login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    assert.equal((await reloaded.attendance('student', 1)).items.find(row => row.session_id === 11)!.wrong_count, 3);
    await assert.rejects(() => reloaded.attend(1, 11, enrollmentId(1000), 'WORD02'), codeError('attendance_locked'));
    await auth.login('manager1@example.test', 'O365-demo-12345');
    await service.override(1, 11, enrollmentId(1000), true, 'Đã xác minh');
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    assert.equal((await service.attend(1, 11, enrollmentId(1000), 'WORD02')).attendance.attended, true);
    const countBefore = (await service.attendance('student', 1)).items.length;
    await service.attend(1, 11, enrollmentId(1000), 'WORD02');
    assert.equal((await service.attendance('student', 1)).items.length, countBefore);
    fixture.setTime(end);
    await assert.rejects(() => service.attend(1, 11, enrollmentId(1000), 'WORD02'), codeError('attendance_closed'));
});

test('Manager override is authoritative, audited with boolean snapshots, scoped, and unavailable to Admin', async () => {
    const { fixture, auth, service, client } = await setup();
    const start = Date.parse('2026-11-20T02:00:00Z');
    await assert.rejects(() => service.override(1, 11, enrollmentId(1000), true, 'Xác minh sớm'), codeError('session_not_started'));
    fixture.setTime(start);
    await service.override(1, 11, enrollmentId(1000), true, 'Có mặt');
    await service.override(1, 11, enrollmentId(1000), false, 'Kiểm tra lại');
    const audit = (await service.audit('manager', 1)).items[0];
    assert.equal(audit.actor_id, 2);
    assert.equal(audit.reason, 'Kiểm tra lại');
    assert.equal(JSON.parse(audit.before_json).attended, true);
    assert.equal(JSON.parse(audit.after_json).attended, false);
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    const result = await service.attend(1, 11, enrollmentId(1000), 'WORD02');
    assert.equal(result.authoritative, true);
    assert.equal(result.attendance.attended, false);
    await auth.login('manager2@example.test', 'O365-demo-12345');
    await assert.rejects(() => service.override(1, 11, enrollmentId(1000), true, 'Ngoài lớp'), codeError('not_found'));
    await auth.login('admin@example.test', 'O365-demo-12345');
    assert((await service.attendance('admin', 1)).items.length);
    await assert.rejects(() => service.override(1, 11, enrollmentId(1000), true, 'Admin'), error => error instanceof ApiError && error.status === 403);
    await assert.rejects(() => client.request('/admin/classes/1/sessions/11/attendance/1000/override', { method: 'POST', body: { attended: true, reason: 'Admin' } }), error => error instanceof ApiError && error.status === 403);
    await auth.login('manager1@example.test', 'O365-demo-12345');
    fixture.setTime(Date.parse('2026-11-20T04:00:00Z'));
    assert.equal((await service.override(1, 11, enrollmentId(1000), true, 'Xác minh sau buổi')).attended, true);
    fixture.setTime(Date.parse('2026-12-31T17:00:00Z'));
    await assert.rejects(() => service.override(1, 11, enrollmentId(1000), true, 'Lớp hết hạn'), codeError('class_expired'));
});

test('Absence autoapproves separately, no credit, duplicates and already-attended blocked; Manager may later verify', async () => {
    const { fixture, auth, service, client } = await setup();
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    const absence = await service.absence(1, 11, enrollmentId(1000), 'Có lịch khám');
    assert.equal(absence.enrollment_id, 1000);
    await assert.rejects(() => service.absence(1, 11, enrollmentId(1000), 'Gửi lặp'), codeError('absence_exists'));
    assert.equal((await service.attendance('student', 1)).items.some(row => row.session_id === 11 && row.attended), false);
    await auth.login('manager1@example.test', 'O365-demo-12345');
    assert.equal((await service.absences('manager', 1)).items[0].reason, 'Có lịch khám');
    assert((await new DashboardService(client).get('manager')).unread_count > 0);
    fixture.setTime(Date.parse('2026-11-20T02:00:00Z'));
    await service.override(1, 11, enrollmentId(1000), true, 'Student thực tế tham gia');
    assert.equal((await service.absences('manager', 1)).items.length, 1);
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    await assert.rejects(() => service.absence(1, 11, enrollmentId(1000), 'Đã điểm danh'), codeError('already_attended'));
    fixture.setTime(Date.parse('2026-11-20T04:00:00Z'));
    await assert.rejects(() => service.absence(1, 11, enrollmentId(1000), 'Đã kết thúc'), codeError('session_ended'));
});

test('Removed cycle and another Student enrollment ID never update current-cycle attendance', async () => {
    const { fixture, auth, service, client } = await setup();
    const enrollments = new EnrollmentService(client);
    await enrollments.remove('manager', 1, enrollmentId(1000), 'Kết thúc lần học');
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    const request = await enrollments.request(1, 'Bắt đầu lần mới');
    await auth.login('manager1@example.test', 'O365-demo-12345');
    await enrollments.review(1, request.id, 'approve', '');
    const current = (await enrollments.roster('manager', 1)).items.find(row => row.enrollment.status === 'enrolled')!.enrollment;
    fixture.setTime(Date.parse('2026-11-20T02:00:00Z'));
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    await assert.rejects(() => service.attend(1, 11, enrollmentId(1000), 'WORD02'), codeError('stale_enrollment'));
    await assert.rejects(() => service.absence(1, 11, enrollmentId(1001), 'Sai lớp'), codeError('stale_enrollment'));
    assert.equal((await service.attend(1, 11, current.id, 'WORD02')).attendance.attended, true);
    await service.attend(1, 11, current.id, 'WORD02');
    assert.equal((await service.attendance('student', 1)).items.filter(row => row.session_id === 11).length, 1);
    assert((await service.attendance('student', 1)).items.every(row => row.enrollment_id === current.id));
    const history = await enrollments.history();
    assert.equal(history.items.find(row => row.enrollment.id === 1000)!.progress.attendance_count, 1);
    assert.equal(history.items.find(row => row.enrollment.id === current.id)!.progress.attendance_count, 1);
});

test('422 remaining_attempts is read from the envelope and invalid details never invent remaining attempts', () => {
    assert.equal(remainingAttendanceAttempts(new ApiError('Sai mã', { status: 422, code: 'wrong_attendance_code', details: { remaining_attempts: 1 } })), 1);
    for (const value of [null, '2', -1, 3, 0.5]) {
        assert.equal(remainingAttendanceAttempts(new ApiError('Sai mã', { status: 422, code: 'wrong_attendance_code', details: { remaining_attempts: value } })), null);
    }
    assert.equal(remainingAttendanceAttempts(new ApiError('Đã khóa', { status: 409, code: 'attendance_locked' })), null);
});
