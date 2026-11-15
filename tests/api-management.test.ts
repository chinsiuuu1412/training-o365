import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../src/lib/api/client.ts';
import { AuthService } from '../src/lib/api/auth.ts';
import { AccountsService, validateAccountInput } from '../src/lib/api/accounts.ts';
import { ClassesService } from '../src/lib/api/classes.ts';
import { createFixtureTransport } from '../src/mocks/api-fixture.ts';
import { userId } from '../src/lib/api/dto.ts';
const student = {
    email: 'new@sis.hust.edu.vn', full_name: 'Học viên mới', role: 'student', password: 'Synthetic-pass-123', student_id: '000123499', school_or_institute: 'Trường CNTT', university_class: 'K71', phone_number: '0912345678', gender: null
};
test('approved-v2 account input preserves text IDs and enforces Student versus staff fields', () => {
    const dto = validateAccountInput(student, true);
    assert.equal(dto.student_id, '000123499');
    assert.equal(dto.phone_number, '0912345678');
    for (const delta of [{
            student_id: '12345678'
        }, {
            student_id: 123456789
        }, {
            phone_number: '12345'
        }, {
            email: 'x@evil.sis.hust.edu.vn'
        }, {
            gender: 'unknown'
        }, {
            full_name: ' '
        }])
        assert.throws(() => validateAccountInput({
            ...student, ...delta
        }, true));
    const staff = validateAccountInput({
        ...student, role: 'class_manager', email: 'STAFF@EXAMPLE.TEST', student_id: null, school_or_institute: null, university_class: null, phone_number: null
    }, true);
    assert.equal(staff.email, 'staff@example.test');
    assert.equal(staff.student_id, null);
    assert.throws(() => validateAccountInput({
        ...student, role: 'class_manager'
    }, true));
    const update = validateAccountInput(student, false);
    assert(!('password' in update));
    assert(!('role' in update));
});
test('account CRUD, duplicate errors, suspend/reset and paginated role directory share the wire client', async () => {
    const fixture = createFixtureTransport(), client = new ApiClient(fixture.transport), auth = new AuthService(client), accounts = new AccountsService(client);
    await auth.login('admin@example.test', 'O365-demo-12345');
    const user = await accounts.create(student);
    assert.equal(user.studentNumber, '000123499');
    await assert.rejects(() => accounts.create({
        ...student, email: 'NEW@SIS.HUST.EDU.VN', student_id: '000123498'
    }), e => e instanceof ApiError && e.code === 'duplicate_email');
    await assert.rejects(() => accounts.create({
        ...student, email: 'other@sis.hust.edu.vn'
    }), e => e instanceof ApiError && e.code === 'duplicate_student_id');
    const edited = await accounts.update(user.userId, {
        ...student, full_name: 'Tên đã sửa'
    });
    assert.equal(edited.name, 'Tên đã sửa');
    await accounts.setStatus(user.userId, false, 'Tạm khóa có lý do');
    const page = await accounts.list({
        role: 'student', page: 1, pageSize: 1
    });
    assert.equal(page.items.length, 1);
    assert(page.total > 1);
    await accounts.resetPassword(user.userId, 'Reset-demo-pass-123');
    await auth.logout();
    await auth.login('manager1@example.test', 'O365-demo-12345');
    await assert.rejects(() => accounts.list({
        role: 'student'
    }), e => e instanceof ApiError && e.status === 403);
});
test('reassignment preserves enrollments, transfers pending scope and validates class updates', async () => {
    const fixture = createFixtureTransport(), client = new ApiClient(fixture.transport), auth = new AuthService(client), classes = new ClassesService(client);
    await auth.login('admin@example.test', 'O365-demo-12345');
    const course = await classes.detail('admin', 1);
    await assert.rejects(() => classes.save({
        ...course, manager_id: 3
    }, course.id), /lý do|xác nhận/i);
    const changed = await classes.save({
        ...course, manager_id: 3, reassignment_reason: 'Chuyển phụ trách', confirm_reassignment: true
    }, course.id);
    assert.equal(changed.manager_id, 3);
    await auth.logout();
    await auth.login('manager1@example.test', 'O365-demo-12345');
    await assert.rejects(() => classes.detail('manager', 1), e => e instanceof ApiError && e.status === 404);
    await auth.logout();
    await auth.login('manager2@example.test', 'O365-demo-12345');
    assert.equal((await classes.detail('manager', 1)).id, 1);
});
test('shared fixture clients revoke old sessions on reset/suspend and preserve assignment and enrollment', async () => {
    const admin = createFixtureTransport(), victim = createFixtureTransport(admin.shared), adminClient = new ApiClient(admin.transport), victimAuth = new AuthService(new ApiClient(victim.transport));
    const adminAuth = new AuthService(adminClient), accounts = new AccountsService(adminClient), classes = new ClassesService(adminClient);
    await adminAuth.login('admin@example.test', 'O365-demo-12345');
    await victimAuth.login('student001@sis.hust.edu.vn', 'O365-demo-12345');
    await accounts.resetPassword(userId(5), 'Reset-demo-pass-123');
    await assert.rejects(() => victimAuth.me(), e => e instanceof ApiError && e.status === 401);
    await victimAuth.login('student001@sis.hust.edu.vn', 'Reset-demo-pass-123');
    await accounts.setStatus(userId(5), false, 'Khóa kiểm thử');
    await assert.rejects(() => victimAuth.me());
    await accounts.setStatus(userId(5), true, 'Khôi phục kiểm thử');
    await assert.rejects(() => victimAuth.me());
    const course = await classes.detail('admin', 1);
    assert.equal(course.enrolled_count, 1);
    await accounts.setStatus(userId(2), false, 'Tạm khóa Manager');
    assert.equal((await classes.detail('admin', 1)).manager_id, 2);
});
