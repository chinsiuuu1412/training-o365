"use client";
import { useState } from 'react';
import type { ApiClass } from '@/lib/api/classes';
import { useApiData, useApiResource } from '@/state/api-data-provider';
import { ActionForm, Field, ResourceFeedback } from '@/components/shared/management-ui';
export function ClassForm({ course, onSaved, onCancel }: {
    course?: ApiClass;
    onSaved: () => void;
    onCancel: () => void;
}) {
    const { services, write } = useApiData();
    const managers = useApiResource('managers-directory', s => s.accounts.allManagers());
    const [manager, setManager] = useState(String(course?.manager_id ?? ''));
    const changed = !!course && Number(manager) !== course.manager_id;
    if (course?.is_expired)
        return <p>Lớp đã hết hạn, chỉ xem lịch sử.</p>;
    return <>
    <ResourceFeedback resource={managers}/>
        {managers.data && <ActionForm submitLabel={changed ? 'Xác nhận đổi Manager và lưu' : 'Lưu lớp học'} onCancel={onCancel} onSubmit={async (form) => {
                const input = {
                    name: String(form.get('name')), code: String(form.get('code')), description: String(form.get('description')), manager_id: Number(manager), capacity: Number(form.get('capacity')), end_date: String(form.get('end_date')), min_attendance_percent: Number(form.get('attendance')), min_quiz_percent: Number(form.get('quiz')), ...(changed ? {
                        reassignment_reason: String(form.get('reason')), confirm_reassignment: form.get('confirm') === 'on'
                    } : {})
                };
                await write(async () => (await services).classes.save(input, course?.id));
                onSaved();
            }}>
 <Field label="Tên lớp *">
        <input name="name" className="form-control" required maxLength={200} defaultValue={course?.name}/>
        </Field>
        <Field label="Mã lớp *">
        <input name="code" className="form-control" required maxLength={60} defaultValue={course?.code}/>
        </Field>
        <Field label="Mô tả">
        <textarea name="description" className="form-control" maxLength={10000} defaultValue={course?.description}/>
        </Field>
        <Field label="Manager phụ trách *">
        <select value={manager} onChange={e => setManager(e.target.value)} className="form-control" required>
        <option value="">Chọn Manager</option>
            {managers.data.filter(user => user.status === 'active' || user.userId === course?.manager_id).map(user => <option key={user.id} value={user.userId}>
            {user.name}{user.status === 'suspended' ? ' · Đã vô hiệu hóa' : ''}
            </option>)}
        </select>
        </Field>
 {changed && <>
            <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6">Manager mới tiếp nhận cả yêu cầu pending. Giữ enrollment và dữ liệu học tập.</p>
            <Field label="Lý do đổi Manager *">
            <textarea name="reason" className="form-control" required maxLength={2000}/>
            </Field>
            <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="confirm" required/>Tôi xác nhận chuyển quyền cho Manager mới</label>
            </>}
 <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sĩ số tối đa *">
        <input name="capacity" className="form-control" type="number" min={Math.max(1, course?.enrolled_count ?? 0)} step="1" required defaultValue={course?.capacity ?? 30}/>
        </Field>
        <Field label="Ngày hết hạn Việt Nam *">
        <input name="end_date" className="form-control" type="date" required defaultValue={course?.end_date}/>
        </Field>
        <Field label="Attendance tối thiểu (%) *">
        <input name="attendance" className="form-control" type="number" min="0" max="100" step="any" required defaultValue={course?.min_attendance_percent ?? 80}/>
        </Field>
        <Field label="Quiz tối thiểu (%) *">
        <input name="quiz" className="form-control" type="number" min="0" max="100" step="any" required defaultValue={course?.min_quiz_percent ?? 70}/>
        </Field>
        </div>
        </ActionForm>}
    </>;
}
