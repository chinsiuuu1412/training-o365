"use client";
import { useState } from 'react';
import type { Account } from '@/lib/api/accounts';
import { useApiData, useApiResource } from '@/state/api-data-provider';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
import { ActionForm, ConfirmAction, DataTable, Feedback, Field, Pagination, ResourceFeedback } from '@/components/shared/management-ui';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { AccountProfileDialog } from './account-profile';
export function AccountsList({ role }: {
    role: 'student' | 'manager';
}) {
    const { services, write } = useApiData();
    const [search, setSearch] = useState(''), [filter, setFilter] = useState('all'), [page, setPage] = useState(1), [editing, setEditing] = useState<Account | 'new' | null>(null), [reset, setReset] = useState<Account | null>(null), [message, setMessage] = useState('');
    const resource = useApiResource('accounts:' + role + ':' + search + ':' + filter + ':' + page, s => s.accounts.list({
        role, search, active: filter === 'all' ? undefined : filter === 'active', page
    }));
    const user = editing && editing !== 'new' ? editing : undefined;
    const student = role === 'student';
    return <div className="dashboard-page management-content space-y-6">
    <PageHeader title={student ? 'Học viên' : 'Quản lý lớp'} description="Quản lý hồ sơ, cấp/reset mật khẩu thủ công. Vô hiệu hóa không xóa ghi danh hoặc phân công." actions={<Button onClick={() => setEditing('new')}>Thêm {student ? 'học viên' : 'quản lý lớp'}
        </Button>}/>
    <Feedback message={message}/>
    <div className="flex flex-wrap gap-4">
    <Field label="Tìm tài khoản">
    <input className="form-control" value={search} onChange={e => {
            setSearch(e.target.value);
            setPage(1);
        }} placeholder="Họ tên, email hoặc MSSV"/>
    </Field>
    <Field label="Trạng thái">
    <select className="form-control" value={filter} onChange={e => {
            setFilter(e.target.value);
            setPage(1);
        }}>
    <option value="all">Tất cả</option>
    <option value="active">Đang hoạt động</option>
    <option value="suspended">Đã vô hiệu hóa</option>
    </select>
    </Field>
    <Button variant="outline" onClick={() => void resource.refresh()}>Làm mới</Button>
    </div>
    <ResourceFeedback resource={resource}/>
 {resource.data && <>
            {resource.data.items.length ? <DataTable caption="Danh sách tài khoản" columns={['Họ tên / MSSV', 'Liên hệ', 'Trạng thái', 'Thao tác']}>
                {resource.data.items.map(row => <tr key={row.userId}>
                <th scope="row" className="p-4 font-medium">
                {row.name}{row.studentNumber && <p className="mt-1 text-xs font-normal">MSSV: {row.studentNumber}
                    </p>}<p className="mt-1 text-xs font-normal text-muted-foreground">User ID: {row.userId}
                </p>
                </th>
                <td className="p-4">
                <p>
                {row.email}
                </p>
                    {student && <p>
                    {row.phone}
                    </p>}
                </td>
                <td className="p-4">
                <StatusBadge status={row.status === 'active' ? 'active' : 'suspended'}/>
                </td>
                <td className="p-4">
                <div className="flex flex-wrap gap-2">
                <AccountProfileDialog user={row}/>
                <Button variant="outline" onClick={() => setEditing(row)}>Sửa hồ sơ</Button>
                <Button variant="outline" onClick={() => setReset(row)}>Reset mật khẩu</Button>
                <ConfirmAction title={row.status === 'active' ? 'Vô hiệu hóa tài khoản?' : 'Khôi phục tài khoản?'} trigger={row.status === 'active' ? 'Vô hiệu hóa' : 'Khôi phục'} description="Bắt buộc lý do. Giữ enrollment và phân công; phiên cũ mất hiệu lực khi trạng thái đổi." onConfirm={async (reason) => {
                        await write(async () => (await services).accounts.setStatus(row.userId, row.status !== 'active', reason));
                        setMessage('Đã cập nhật trạng thái tài khoản.');
                    }}/>
                </div>
                </td>
                </tr>)}
            </DataTable> : <EmptyState title="Không có tài khoản phù hợp" description="Thay từ khóa hoặc bộ lọc."/>}<Pagination {...resource.data} onPage={setPage}/>
        </>}
 <Dialog open={!!editing} onOpenChange={open => {
            if (!open)
                setEditing(null);
        }} title={user ? 'Sửa hồ sơ tài khoản' : 'Thêm tài khoản'} description="Chỉ Admin cập nhật hồ sơ. Thông tin cấp phát được gửi thủ công, không có email tự động.">
        {editing && <ActionForm key={user?.id ?? 'new'} submitLabel="Lưu tài khoản" onCancel={() => setEditing(null)} onSubmit={async (form) => {
                const input: Record<string, unknown> = {
                    email: String(form.get('email')), full_name: String(form.get('full_name')), role: student ? 'student' : 'class_manager', password: form.get('password'), student_id: student ? String(form.get('student_id')) : null, school_or_institute: student ? String(form.get('school_or_institute')) : null, university_class: student ? String(form.get('university_class')) : null, phone_number: student ? String(form.get('phone_number')) : null, gender: student ? (form.get('gender') || null) : null
                };
                await write(async () => user ? (await services).accounts.update(user.userId, input) : (await services).accounts.create(input));
                setEditing(null);
                setMessage(user ? 'Đã lưu hồ sơ.' : 'Đã tạo tài khoản. Người phụ trách gửi thông tin cấp phát thủ công.');
            }}>
        <Field label="Họ và tên *">
        <input className="form-control" name="full_name" required maxLength={200} defaultValue={user?.name}/>
        </Field>
        <Field label="Email *">
        <input className="form-control" name="email" type="email" required defaultValue={user?.email}/>
        </Field>
 {student && <>
            <Field label="MSSV *" hint="Đúng 9 chữ số; giữ số 0 đầu. Không phải user ID.">
            <input className="form-control" name="student_id" type="text" inputMode="numeric" required pattern="[0-9]{9}" defaultValue={user?.studentNumber}/>
            </Field>
            <Field label="Trường/Viện HUST *">
            <input className="form-control" name="school_or_institute" required maxLength={200} defaultValue={user?.school}/>
            </Field>
            <Field label="Lớp–Khóa đại học *">
            <input className="form-control" name="university_class" required maxLength={200} defaultValue={user?.universityClass}/>
            </Field>
            <Field label="Số điện thoại *">
            <input className="form-control" name="phone_number" type="tel" required defaultValue={user?.phone}/>
            </Field>
            <Field label="Giới tính">
            <select className="form-control" name="gender" defaultValue={user?.gender ?? ''}>
            <option value="">Chưa cung cấp</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
            </select>
            </Field>
            </>}
 {!user && <Field label="Mật khẩu cấp phát *" hint="12–72 byte UTF-8; không lưu hoặc hiển thị lại sau khi tạo.">
            <input className="form-control" type="password" autoComplete="new-password" name="password" required/>
            </Field>}
        </ActionForm>}
    </Dialog>
 <Dialog open={!!reset} onOpenChange={open => {
            if (!open)
                setReset(null);
        }} title="Reset mật khẩu" description="Thu hồi phiên cũ; người phụ trách tự gửi mật khẩu mới, không có email tự động.">
    <ActionForm key={reset?.id} submitLabel="Xác nhận reset" onCancel={() => setReset(null)} onSubmit={async (form) => {
            if (!reset)
                return;
            await write(async () => (await services).accounts.resetPassword(reset.userId, String(form.get('new_password'))));
            setReset(null);
            setMessage('Đã reset. Gửi thông tin cấp phát thủ công cho tài khoản.');
        }}>
    <Field label="Mật khẩu mới *">
    <input className="form-control" name="new_password" type="password" autoComplete="new-password" required/>
    </Field>
    </ActionForm>
    </Dialog>
    </div>;
}
