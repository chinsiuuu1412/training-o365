import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../src/lib/api/client.ts';
import { AuthService } from '../src/lib/api/auth.ts';
import { EnrollmentService, enrollmentAvailability } from '../src/lib/api/enrollments.ts';
import { ClassesService } from '../src/lib/api/classes.ts';
import { createFixtureTransport } from '../src/mocks/api-fixture.ts';
import { enrollmentId } from '../src/lib/api/dto.ts';
const reason = 'Em muốn học lớp này';
test('pending/cancel do not reserve seats or count declines; boundary 599999/600000 and lifetime third decline', async () => {
    const f = createFixtureTransport(), client = new ApiClient(f.transport), auth = new AuthService(client), enroll = new EnrollmentService(client);
    await auth.login('student002@sis.hust.edu.vn', 'O365-demo-12345');
    let request = await enroll.request(1, reason);
    await enroll.cancel(1, request.id);
    assert.equal(enrollmentAvailability(await enroll.allOwnRequests(), 1, f.now()).declines, 0);
    for (let i = 1; i <= 3; i++) {
        request = await enroll.request(1, reason + ' ' + i);
        await auth.logout();
        await auth.login('manager1@example.test', 'O365-demo-12345');
        await enroll.review(1, request.id, 'decline', 'Cần bổ sung');
        await auth.logout();
        await auth.login('student002@sis.hust.edu.vn', 'O365-demo-12345');
        assert.equal(enrollmentAvailability(await enroll.allOwnRequests(), 1, f.now()).declines, i);
        f.advanceTime(599999);
        await assert.rejects(() => enroll.request(1, reason + ' khác'), e => e instanceof ApiError && ['decline_cooldown', 'decline_limit'].includes(e.code));
        f.advanceTime(1);
        if (i < 3)
            await assert.rejects(() => enroll.request(1, reason + ' ' + i), e => e instanceof ApiError && e.code === 'new_reason_required');
    }
    await assert.rejects(() => enroll.request(1, 'Lý do thứ tư'), e => e instanceof ApiError && e.code === 'decline_limit');
});
test('last seat approval is authoritative; re-enrollment separates enrollment_id and historical progress', async () => {
    const f = createFixtureTransport(), client = new ApiClient(f.transport), auth = new AuthService(client), enroll = new EnrollmentService(client), classes = new ClassesService(client);
    await auth.login('admin@example.test', 'O365-demo-12345');
    const c = await classes.detail('admin', 1);
    await classes.save({
        ...c, capacity: 2
    }, 1);
    await auth.logout();
    await auth.login('student002@sis.hust.edu.vn', 'O365-demo-12345');
    const r1 = await enroll.request(1, 'Suất cuối');
    await auth.logout();
    await auth.login('student003@sis.hust.edu.vn', 'O365-demo-12345');
    const r2 = await enroll.request(1, 'Cùng suất cuối');
    await auth.logout();
    await auth.login('manager1@example.test', 'O365-demo-12345');
    const decisions = await Promise.allSettled([enroll.review(1, r1.id, 'approve', ''), enroll.review(1, r2.id, 'approve', '')]);
    assert.equal(decisions.filter(r => r.status === 'fulfilled').length, 1);
    const rows = await enroll.roster('manager', 1);
    const old = rows.items.find(row => row.enrollment.student_id === 6)!;
    await enroll.remove('manager', 1, old.enrollment.id, 'Học lại');
    await auth.logout();
    await auth.login('student002@sis.hust.edu.vn', 'O365-demo-12345');
    const again = await enroll.request(1, 'Lần học mới');
    await auth.logout();
    await auth.login('manager1@example.test', 'O365-demo-12345');
    await enroll.review(1, again.id, 'approve', '');
    await auth.logout();
    await auth.login('student002@sis.hust.edu.vn', 'O365-demo-12345');
    const history = await enroll.history();
    assert.equal(history.items.length, 2);
    assert.notEqual(history.items[0].enrollment.id, old.enrollment.id);
    assert.equal(history.items[0].enrollment.cycle_number, 2);
    assert.equal(history.items[0].progress.attendance_count, 0);
    assert.equal(history.items[1].enrollment.status, 'removed');
});
test('expiry is Vietnam midnight exclusive; removed/expired content denied but summaries remain own-only', async () => {
    const f = createFixtureTransport(), client = new ApiClient(f.transport), auth = new AuthService(client), enroll = new EnrollmentService(client), classes = new ClassesService(client);
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    const history = await enroll.history();
    assert(history.items.every(row => row.enrollment.student_id === 5));
    const course = await classes.detail('student', 1);
    f.setTime(Date.parse(course.expires_at) - 1);
    assert.equal((await classes.detail('student', 1)).id, 1);
    f.advanceTime(1);
    await assert.rejects(() => classes.detail('student', 1), e => e instanceof ApiError && e.code === 'class_expired');
    assert((await enroll.history()).items.length > 0);
});
test('old nonzero progress remains historical; stale remove cannot affect the new cycle', async () => {
    const f = createFixtureTransport(), client = new ApiClient(f.transport), auth = new AuthService(client), enroll = new EnrollmentService(client);
    await auth.login('manager1@example.test', 'O365-demo-12345');
    await enroll.remove('manager', 1, enrollmentId(1000), 'Học lại');
    await auth.logout();
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    const request = await enroll.request(1, 'Bắt đầu lần học mới');
    await auth.logout();
    await auth.login('manager1@example.test', 'O365-demo-12345');
    await enroll.review(1, request.id, 'approve', '');
    await assert.rejects(() => enroll.remove('manager', 1, enrollmentId(1000), 'Thao tác cũ'), e => e instanceof ApiError && e.code === 'stale_enrollment');
    await auth.logout();
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    const rows = (await enroll.history()).items.filter(row => row.enrollment.class_id === 1);
    assert.equal(rows[0].progress.attendance_count, 0);
    assert.equal(rows[0].progress.passed_quiz_count, 0);
    assert.equal(rows[1].progress.attendance_count, 1);
    assert.equal(rows[1].progress.passed_quiz_count, 1);
    assert.equal(rows[0].enrollment.status, 'enrolled');
});
test('all request pages are loaded before deriving lifetime decline limits', async () => {
    const requests = Array.from({
        length: 103
    }, (_, i) => ({
        id: 1000 - i, class_id: 1, student_id: 6, reason: 'Lý do ' + i, status: i >= 100 ? 'declined' : 'cancelled', decision_reason: i >= 100 ? 'Từ chối' : null, decided_by: i >= 100 ? 2 : null, created_at: '2026-11-15T02:00:00Z', decided_at: '2026-11-15T02:00:00Z'
    }));
    const calls: string[] = [];
    const client = new ApiClient(async (url) => {
        calls.push(url);
        const page = Number(new URL(url, 'https://fixture.invalid').searchParams.get('page'));
        return Response.json({
            data: {
                items: requests.slice((page - 1) * 100, page * 100), page, page_size: 100, total: 103
            }, error: null
        });
    });
    const rows = await new EnrollmentService(client).allOwnRequests();
    assert.equal(calls.length, 2);
    assert.equal(enrollmentAvailability(rows, 1, Date.parse('2026-11-16T02:00:00Z')).declines, 3);
    assert(!enrollmentAvailability(rows, 1, Date.parse('2026-11-16T02:00:00Z')).canRequest);
});
