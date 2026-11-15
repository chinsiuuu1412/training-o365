import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../src/lib/api/client.ts';
import { AuthService } from '../src/lib/api/auth.ts';
import { MessagesService, announcementFromDto } from '../src/lib/api/messages.ts';
import { MaterialsService, httpsMaterialUrl, youtubeExpiryExempt, materialStatus } from '../src/lib/api/materials.ts';
import { AccountsService } from '../src/lib/api/accounts.ts';
import { ClassesService } from '../src/lib/api/classes.ts';
import { EnrollmentService } from '../src/lib/api/enrollments.ts';
import { DashboardService } from '../src/lib/api/dashboard.ts';
import { SessionsService } from '../src/lib/api/sessions.ts';
import { QuizzesService } from '../src/lib/api/quizzes.ts';
import { userId, enrollmentId } from '../src/lib/api/dto.ts';
import { createFixtureTransport } from '../src/mocks/api-fixture.ts';
import { deferredMvpLocation, staticDestination } from '../src/config/routes.ts';

const errorCode = (code: string) => (error: unknown) => error instanceof ApiError && error.code === code;
async function setup() {
    const fixture = createFixtureTransport(), client = new ApiClient(fixture.transport), auth = new AuthService(client);
    await auth.login('admin@example.test', 'O365-demo-12345');
    return { fixture, client, auth, messages: new MessagesService(client), materials: new MaterialsService(client) };
}
const linkInput = (patch: Record<string, unknown> = {}) => ({ title: 'Link tổng hợp', description: '', material_type: 'document', url: 'https://example.test/document', session_id: null, expires_at: null, ...patch });
function studentInput(index: number) {
    return { role: 'student', full_name: 'Học viên tổng hợp ' + index, email: 'paging' + index + '@sis.hust.edu.vn', password: 'Synthetic-pass-123', student_id: String(800000000 + index), school_or_institute: 'Viện tổng hợp', university_class: 'K71', phone_number: '0912345678', gender: null };
}
test('Inbox detail never marks read, explicit PATCH is idempotent and read state belongs to each recipient', async () => {
    const { messages, auth, client } = await setup();
    const sent = await messages.send('admin', { recipient_ids: [userId(5), userId(6), userId(5)], title: 'Nhắc lịch', content: 'Nội dung tổng hợp' });
    assert.equal(sent.recipient_count, 2);
    await assert.rejects(() => messages.detail(sent.announcement_id), errorCode('not_found'));
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    const before = await messages.unreadCount();
    assert.equal((await messages.detail(sent.announcement_id)).is_read, false);
    assert.equal(await messages.unreadCount(), before);
    await messages.read(sent.announcement_id, true);
    await messages.read(sent.announcement_id, true);
    assert.equal(await messages.unreadCount(), before - 1);
    assert.equal((await new DashboardService(client).get('student')).unread_count, before - 1);
    await messages.read(sent.announcement_id, false);
    assert.equal(await messages.unreadCount(), before);
    await auth.login('student002@sis.hust.edu.vn', 'O365-demo-12345');
    assert.equal((await messages.detail(sent.announcement_id)).is_read, false);
    await assert.rejects(() => client.request('/announcements/' + sent.announcement_id + '/read', { method: 'PATCH', body: { is_read: 'true' } }), errorCode('invalid_request'));
    assert.throws(() => announcementFromDto({ ...(sent as unknown as Record<string, unknown>), automated: true }));
});
test('Recipient scope is rechecked atomically at send after removal/reassignment; Student cannot compose', async () => {
    const { messages, auth, client } = await setup();
    await auth.login('manager1@example.test', 'O365-demo-12345');
    assert.deepEqual((await messages.allRecipients('manager')).map(row => row.userId), [5]);
    await assert.rejects(() => messages.send('manager', { recipient_ids: [userId(5), userId(6)], title: 'Ngoài phạm vi', content: 'Không gửi một phần' }), errorCode('invalid_recipients'));
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    assert.equal((await messages.inbox()).items.some(row => row.title === 'Ngoài phạm vi'), false);
    await assert.rejects(() => client.request('/student/announcements', { method: 'POST', body: { recipient_ids: [2], title: 'X', content: 'Y' } }), error => error instanceof ApiError && error.status === 403);
    await auth.login('admin@example.test', 'O365-demo-12345');
    const classes = new ClassesService(client), course = await classes.detail('admin', 1);
    await classes.save({ ...course, manager_id: 3, confirm_reassignment: true, reassignment_reason: 'Đổi phụ trách' }, 1);
    await auth.login('manager1@example.test', 'O365-demo-12345');
    await assert.rejects(() => messages.send('manager', { recipient_ids: [userId(5)], title: 'Mất quyền', content: 'X' }), errorCode('invalid_recipients'));
    await auth.login('manager2@example.test', 'O365-demo-12345');
    await new EnrollmentService(client).remove('manager', 1, enrollmentId(1000), 'Rời lớp');
    await assert.rejects(() => messages.send('manager', { recipient_ids: [userId(5)], title: 'Đã rời lớp', content: 'X' }), errorCode('invalid_recipients'));
});
test('Select-all loads every directory page, sends concrete User IDs and supports exclusion', async () => {
    const fixture = createFixtureTransport(), calls: string[] = [], client = new ApiClient(async (url, init) => { calls.push(url); return fixture.transport(url, init); });
    await new AuthService(client).login('admin@example.test', 'O365-demo-12345');
    const accounts = new AccountsService(client), messages = new MessagesService(client);
    for (let index = 0; index < 105; index++) await accounts.create(studentInput(index));
    const all = await messages.allRecipients('admin');
    assert.equal(all.length, 110);
    assert(calls.some(path => path.includes('/recipients?page=2&page_size=100')));
    const selected = all.filter(row => row.userId !== 5).map(row => row.userId);
    const receipt = await messages.send('admin', { recipient_ids: selected, title: 'Mọi trang', content: 'Danh sách ID cụ thể' });
    assert.equal(receipt.recipient_count, 109);
    await new AuthService(client).login('paging104@sis.hust.edu.vn', 'Synthetic-pass-123');
    assert.equal((await messages.detail(receipt.announcement_id)).title, 'Mọi trang');
    await new AuthService(client).login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    await assert.rejects(() => messages.detail(receipt.announcement_id), errorCode('not_found'));
});
test('Class audience traverses all roster pages and deduplicates recipients without sending class IDs', async () => {
    const { auth, client, messages } = await setup();
    const classes = new ClassesService(client), accounts = new AccountsService(client), enrollments = new EnrollmentService(client);
    await classes.save({ ...await classes.detail('admin', 1), capacity: 40 }, 1);
    const users = [];
    for (let index = 0; index < 21; index++) users.push(await accounts.create(studentInput(index)));
    for (const user of users) {
        await auth.login(user.email!, 'Synthetic-pass-123');
        const request = await enrollments.request(1, 'Tham gia lớp tổng hợp');
        await auth.login('manager1@example.test', 'O365-demo-12345');
        await enrollments.review(1, request.id, 'approve', '');
    }
    const audience = await messages.classAudience('manager', [1, 1], false);
    assert.equal(audience.length, 22);
    assert.equal(new Set(audience.map(row => row.userId)).size, 22);
    await auth.login('admin@example.test', 'O365-demo-12345');
    const withManager = await messages.classAudience('admin', [1], true);
    assert.equal(withManager.length, 23);
    assert(withManager.some(row => row.userId === 2));
});
test('HTTPS validation matches material contract and YouTube exception applies only to exact video hosts', () => {
    for (const url of ['http://example.test/x', 'javascript:alert(1)', 'https://a:b@example.test/x', 'https://example.test/\r\nx', '\nhttps://example.test/x', 'https://example.test/' + 'é'.repeat(2000)]) assert.throws(() => httpsMaterialUrl(url));
    assert.equal(httpsMaterialUrl('https://example.test/doc?q=1'), 'https://example.test/doc?q=1');
    for (const host of ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com']) assert(youtubeExpiryExempt({ material_type: 'video', url: 'https://' + host + '/x' }));
    assert.equal(youtubeExpiryExempt({ material_type: 'document', url: 'https://youtube.com/x' }), false);
    assert.equal(youtubeExpiryExempt({ material_type: 'video', url: 'https://youtube.com.evil.test/x' }), false);
});
test('Material expiration uses exact boundary, while YouTube still obeys class/enrollment scope', async () => {
    const { fixture, auth, materials, client } = await setup();
    await auth.login('manager1@example.test', 'O365-demo-12345');
    const expiry = fixture.now() + 1000, link = await materials.save(1, linkInput({ expires_at: new Date(expiry).toISOString() }));
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    fixture.setTime(expiry - 1);
    assert.equal((await materials.detail('student', 1, link.id)).id, link.id);
    fixture.setTime(expiry);
    await assert.rejects(() => materials.detail('student', 1, link.id), errorCode('material_expired'));
    assert.equal((await materials.list('student', 1)).items.some(row => row.id === link.id), false);
    const video = await materials.detail('student', 1, 2);
    assert.equal(materialStatus(video, '2026-12-31T17:00:00Z', fixture.now()), 'available');
    await auth.login('manager1@example.test', 'O365-demo-12345');
    await new EnrollmentService(client).remove('manager', 1, enrollmentId(1000), 'Kết thúc enrollment');
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    await assert.rejects(() => materials.detail('student', 1, 2), errorCode('not_found'));
    fixture.setTime(Date.parse('2026-12-31T17:00:00Z'));
    await assert.rejects(() => materials.detail('student', 1, 2), errorCode('class_expired'));
    await auth.login('manager1@example.test', 'O365-demo-12345');
    assert.equal((await materials.detail('manager', 1, 2)).id, 2);
});
test('Manager manages links only in assigned classes and same-class sessions; Admin cannot create', async () => {
    const { materials, auth, client } = await setup();
    await assert.rejects(() => materials.save(1, linkInput()), error => error instanceof ApiError && error.status === 403);
    await auth.login('manager1@example.test', 'O365-demo-12345');
    await assert.rejects(() => materials.save(1, linkInput({ session_id: 21 })), errorCode('invalid_request'));
    const material = await materials.save(1, linkInput({ session_id: 11 }));
    const updated = await materials.save(1, linkInput({ title: 'Link đã sửa', material_type: 'video' }), material.id);
    assert.equal(updated.title, 'Link đã sửa');
    await auth.login('manager2@example.test', 'O365-demo-12345');
    await assert.rejects(() => materials.detail('manager', 1, material.id), errorCode('not_found'));
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    await assert.rejects(() => client.request('/student/classes/1/materials', { method: 'POST', body: linkInput() }), error => error instanceof ApiError && error.status === 403);
});
test('Both staff roles require removal reason, retain audit/history and Admin feedback reaches Manager Inbox', async () => {
    const { materials, messages, auth, client } = await setup();
    await assert.rejects(() => materials.remove('admin', 1, 2, '  '));
    await client.request('/admin/classes/1/materials/2', { method: 'DELETE' }).then(() => assert.fail('Missing reason accepted'), errorCode('invalid_request'));
    await materials.remove('admin', 1, 2, 'Link không phù hợp');
    await auth.login('manager1@example.test', 'O365-demo-12345');
    assert((await messages.inbox()).items.some(row => row.content === 'Link không phù hợp' && row.class_id === 1));
    assert.equal((await materials.detail('manager', 1, 2)).deletion_reason, 'Link không phù hợp');
    await assert.rejects(() => materials.remove('manager', 1, 1, ''));
    await materials.remove('manager', 1, 1, 'Đã có bản mới');
    const audit = await new SessionsService(client).audit('manager', 1);
    assert.equal(audit.items.filter(row => row.action === 'material_delete').length, 2);
    assert.equal(JSON.parse(audit.items[0].after_json).deletion_reason, 'Đã có bản mới');
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    await assert.rejects(() => materials.detail('student', 1, 1), errorCode('material_expired'));
    assert.equal((await materials.list('student', 1)).items.some(row => [1, 2].includes(row.id)), false);
});
test('Deferred deep links are blocked while enrollment queue and approved material links remain MVP', () => {
    for (const href of ['/teacher/requests', '/teacher/certificates', '/teacher/notifications?folder=sent', '/teacher/library?source=file', '/manager/classes/1?tab=certificates']) assert.equal(staticDestination(href), null);
    assert(deferredMvpLocation('notifications', new URLSearchParams('folder=sent')));
    assert(deferredMvpLocation('library', new URLSearchParams('upload=true')));
    assert.equal(deferredMvpLocation('classes', new URLSearchParams('tab=requests')), false);
    assert.equal(deferredMvpLocation('classes', new URLSearchParams('tab=materials')), false);
});

test('Manual and cutoff Quiz results reach the same Inbox exactly once across replay and repeated recovery', async () => {
    const { fixture, client, auth, messages } = await setup();
    await auth.login('manager1@example.test', 'O365-demo-12345');
    const quizzes = new QuizzesService(client);
    const definition = await quizzes.save(1, { title: 'Inbox Quiz', description: '', quiz_type: 'assignment', duration_seconds: 10, open_at: '2026-11-15T00:00:00Z', deadline: '2026-12-01T10:00:00Z', pass_score: 50, questions: [{ question_text: 'Q', options: [{ option_text: 'A', is_correct: true }, { option_text: 'B', is_correct: false }] }] });
    await quizzes.publish(1, definition.quiz.id);
    await auth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    const runner = await quizzes.start(1, definition.quiz.id, enrollmentId(1000), crypto.randomUUID()), key = crypto.randomUUID();
    await quizzes.submit(1, runner.attempt, key);
    await quizzes.submit(1, runner.attempt, key);
    const manual = (await messages.inbox()).items.filter(row => row.title.startsWith('Kết quả Quiz'));
    assert.equal(manual.length, 1);
    const second = await quizzes.start(1, definition.quiz.id, enrollmentId(1000), crypto.randomUUID());
    fixture.setTime(Date.parse(second.attempt.effective_cutoff_at));
    await quizzes.attempt(1, second.attempt.id);
    await quizzes.attempt(1, second.attempt.id);
    assert.equal((await messages.inbox()).items.filter(row => row.title === 'Đã có kết quả Quiz').length, 1);
});
