"use client";
import { useState } from 'react';
import type { EnrollmentRequest } from '@/lib/api/enrollments';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { ActionForm, DataTable, Field, Feedback, Pagination, ResourceFeedback } from '@/components/shared/management-ui';
import { EmptyState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
export function EnrollmentQueue({ classId, role = 'manager', readonly = false }: {
    classId: number;
    role?: 'admin' | 'manager';
    readonly?: boolean;
}) {
    const { services, write } = useApiData();
    const [page, setPage] = useState(1), [decision, setDecision] = useState<{
        request: EnrollmentRequest;
        approve: boolean;
    } | null>(null), [message, setMessage] = useState('');
    const resource = useApiResource('requests:' + role + ':' + classId + ':' + page, s => s.enrollments.requests(role, classId, page));
    return <section className="space-y-4">
    <h2 className="text-xl font-semibold">Yêu cầu ghi danh</h2>
    <Feedback message={message}/>
    <ResourceFeedback resource={resource}/>
        {resource.data && <>
            {resource.data.items.length ? <DataTable caption="Yêu cầu ghi danh" columns={['Học viên', 'Lý do', 'Trạng thái / thời gian', 'Thao tác']}>
                {resource.data.items.map(row => <tr key={row.id}>
                <th scope="row" className="p-4 font-medium">
                {row.full_name}<p className="text-xs font-normal">MSSV: {row.student_number} · User ID: {row.student_id}
                </p>
                <p className="text-xs font-normal">Request ID: {row.id}
                </p>
                </th>
                <td className="max-w-sm whitespace-pre-wrap p-4">
                {row.reason}{row.decision_reason && <p className="mt-2 text-red-800">Phản hồi: {row.decision_reason}
                    </p>}
                </td>
                <td className="p-4">
                {({
                    pending: 'Đang chờ', approved: 'Đã duyệt', declined: 'Từ chối', cancelled: 'Đã hủy'
                })[row.status]}<p className="mt-1 text-xs">
                {formatApiDate(row.created_at)}
                </p>
                </td>
                <td className="p-4">
                    {role === 'manager' && !readonly && row.status === 'pending' && <div className="flex gap-2">
                    <Button onClick={() => setDecision({
                        request: row, approve: true
                    })}>Phê duyệt</Button>
                    <Button variant="outline" onClick={() => setDecision({
                        request: row, approve: false
                    })}>Từ chối</Button>
                    </div>}
                </td>
                </tr>)}
            </DataTable> : <EmptyState title="Chưa có yêu cầu" description="Danh sách lấy theo lớp và quyền hiện tại."/>}<Pagination {...resource.data} onPage={setPage}/>
        </>}
 <Dialog open={!!decision} onOpenChange={open => {
            if (!open)
                setDecision(null);
        }} title={decision?.approve ? 'Phê duyệt ghi danh?' : 'Từ chối ghi danh?'} description="Quyền Manager hiện tại, sức chứa và trạng thái Student được kiểm tra lại khi xử lý.">
    <ActionForm key={decision?.request.id + '-' + decision?.approve} onCancel={() => setDecision(null)} submitLabel="Xác nhận quyết định" onSubmit={async (form) => {
            if (!decision)
                return;
            await write(async () => (await services).enrollments.review(classId, decision.request.id, decision.approve ? 'approve' : 'decline', String(form.get('reason') ?? '')));
            setDecision(null);
            setMessage('Đã xử lý yêu cầu và đọc lại dữ liệu liên quan.');
        }}>
        {decision?.approve ? <p className="text-sm">Tạo enrollment_id mới; không mang kết quả của lần ghi danh cũ.</p> : <Field label="Lý do từ chối *">
        <textarea name="reason" className="form-control" required maxLength={2000}/>
        </Field>}
    </ActionForm>
    </Dialog>
    </section>;
}
