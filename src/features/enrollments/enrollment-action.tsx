"use client";
import { useState } from 'react';
import type { ApiClass } from '@/lib/api/classes';
import { enrollmentAvailability } from '@/lib/api/enrollments';
import { useApiData, useApiResource } from '@/state/api-data-provider';
import { ActionForm, ConfirmAction, Field, Feedback, ResourceFeedback } from '@/components/shared/management-ui';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { LoadingState } from '@/components/shared/states';
export function EnrollmentAction({ course, enrolled = false }: {
    course: ApiClass;
    enrolled?: boolean;
}) {
    const { services, write, now } = useApiData();
    const requests = useApiResource('own-requests-all', s => s.enrollments.allOwnRequests());
    const [open, setOpen] = useState(false), [message, setMessage] = useState('');
    const info = requests.data ? enrollmentAvailability(requests.data, course.id, now) : undefined;
    const full = course.enrolled_count >= course.capacity, expired = course.is_expired, seconds = info ? Math.max(0, Math.ceil((info.retryAt - now) / 1000)) : 0;
    if (!now)
        return <LoadingState />;
    return <div className="space-y-3">
    <Feedback message={message}/>
    <ResourceFeedback resource={requests}/>
        {enrolled ? <p className="text-sm text-emerald-800">Đã ghi danh hiện hành.</p> : info && <>
            {info.lastDeclined && <div className="space-y-2 text-sm">
            <p>Lý do từ chối: {info.lastDeclined.decision_reason}
            </p>
            <p>Đã bị từ chối {info.declines}/3 lần theo cặp Student–lớp.</p>
                {seconds > 0 && <p role="status">Có thể gửi lại sau {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                </p>}{info.declines >= 3 && <p>Đã hết lượt gửi lại.</p>}
            </div>}{info.pending ? <>
            <p className="text-sm">Đang chờ Manager phê duyệt. Pending chưa chiếm chỗ.</p>
            <ConfirmAction title="Hủy yêu cầu?" trigger="Hủy yêu cầu" description="Hủy không tăng số decline; có thể gửi lại nếu đủ điều kiện." needsReason={false} onConfirm={async () => {
                    await write(async () => (await services).enrollments.cancel(course.id, info.pending!.id));
                    setMessage('Đã hủy yêu cầu.');
                }}/>
            </> : <>
            <p className="text-sm">
            {expired ? 'Lớp đã hết hạn.' : full ? 'Lớp đã đủ sĩ số.' : 'Lớp còn nhận yêu cầu.'}
            </p>
            <Button disabled={!info.canRequest || expired || full || requests.loading || !!requests.error} onClick={() => setOpen(true)}>
            {info.lastDeclined ? 'Gửi lại yêu cầu' : 'Gửi yêu cầu đăng ký'}
            </Button>
            </>}
        </>}
 <Dialog open={open} onOpenChange={setOpen} title="Gửi yêu cầu đăng ký" description="Cần Manager duyệt. Hệ thống kiểm tra lại trạng thái lớp, sĩ số và giới hạn khi gửi.">
    <ActionForm onCancel={() => setOpen(false)} submitLabel="Xác nhận đăng ký" onSubmit={async (form) => {
            const reason = String(form.get('reason')).trim();
            if (info?.lastDeclined?.reason === reason)
                throw new Error('Lý do tham gia phải khác lần bị từ chối gần nhất.');
            await write(async () => (await services).enrollments.request(course.id, reason));
            setOpen(false);
            setMessage('Đã gửi yêu cầu, đang chờ phê duyệt.');
        }}>
    <Field label="Lý do tham gia *">
    <textarea className="form-control" name="reason" required maxLength={2000}/>
    </Field>
    </ActionForm>
    </Dialog>
    </div>;
}
