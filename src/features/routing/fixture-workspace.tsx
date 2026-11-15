"use client";
import { useState } from 'react';
import { useApiData, formatApiDate } from '@/state/api-data-provider';
import { useAuth } from '@/state/auth-provider';
import { Field, ConfirmAction, Feedback, ActionForm } from '@/components/shared/management-ui';
import { advanceFixtureClock, setFixtureClock, resetManagementFixture } from '@/mocks/management-fixture';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { utcLessonTime } from '@/features/lessons/lesson-status';
import { basePath } from '@/config/routes';
export function FixtureDataControls() {
    const { now, refresh } = useApiData();
    const [message, setMessage] = useState('');
    const [time, setTime] = useState(''), [confirmTime, setConfirmTime] = useState(false);
    return <details className="border-b bg-amber-50 px-4 py-3 text-sm sm:px-6">
    <summary className="cursor-pointer font-medium">Chế độ mô phỏng · Dữ liệu tổng hợp · {formatApiDate(now ? new Date(now).toISOString() : null)}
    </summary>
    <div className="mt-3 flex flex-wrap gap-3">
    <p className="w-full text-xs leading-6">Đồng hồ mô phỏng chạy liên tục giữa các tab và qua reload. Hạn và quyền thật phải được backend xác minh.</p>
    <Field label="Thời điểm mô phỏng (Việt Nam)">
        <input type="datetime-local" className="form-control" value={time} onChange={event => setTime(event.target.value)} />
    </Field>
    <Button variant="outline" disabled={!time} onClick={() => setConfirmTime(true)}>Đổi thời gian mô phỏng</Button>
    <Dialog open={confirmTime} onOpenChange={setConfirmTime} title="Đổi thời gian mô phỏng?" description="Mốc này áp dụng cho mọi tab dùng bộ dữ liệu tổng hợp. Các bản ghi đã ghi nhận được giữ lại.">
        <ActionForm submitLabel="Xác nhận đổi thời gian" onCancel={() => setConfirmTime(false)} onSubmit={async () => {
            await setFixtureClock(Date.parse(utcLessonTime(time)));
            await refresh();
            setConfirmTime(false);
            setMessage('Chế độ mô phỏng · Đã đổi thời gian.');
        }}><p>{time.replace('T', ' ')} (Việt Nam)</p></ActionForm>
    </Dialog>
    <ConfirmAction title="Tiến thêm 10 phút mô phỏng?" trigger="Tiến thêm 10 phút" needsReason={false} description="Đổi mốc fixture để thử cooldown; không đổi clock máy hoặc backend." onConfirm={async () => {
            await advanceFixtureClock(600000);
            await refresh();
            setMessage('Chế độ mô phỏng · Đã tiến 10 phút.');
        }}/>
    <ConfirmAction title="Khôi phục fixture approved-v2?" trigger="Khôi phục dữ liệu tổng hợp" needsReason={false} description="Chỉ reset kho fixture approved-v2 riêng; giữ kho mock cũ và storage ứng dụng khác." onConfirm={async () => {
            resetManagementFixture();
            window.location.assign(basePath + '/login/');
        }}/>
    </div>
    <Feedback message={message}/>
    </details>;
}
export function FixtureLoginChoices({ onChoose }: {
    onChoose: (email: string, password: string) => void;
}) {
    const { fixtureMode } = useAuth();
    if (!fixtureMode)
        return null;
    return <div className="space-y-4">
    <Field label="Chọn tài khoản mẫu">
    <select className="form-control" defaultValue="" onChange={event => onChoose(event.target.value, 'O365-demo-12345')}>
    <option value="" disabled>Chọn vai trò…</option>
    <option value="admin@example.test">Admin</option>
    <option value="manager1@example.test">Manager 1 · Trần Hoàng Nam</option>
    <option value="manager2@example.test">Manager 2 · Lê Thu Hà</option>
    <option value="student001@sis.hust.edu.vn">Student 1 · Nguyễn An</option>
    <option value="student002@sis.hust.edu.vn">Student 2 · Trần Bình</option>
    <option value="student003@sis.hust.edu.vn">Student 3 · Lê Chi</option>
    </select>
    </Field>
    <ConfirmAction title="Khôi phục fixture?" trigger="Khôi phục dữ liệu tổng hợp" description="Xóa riêng fixture approved-v2, không xóa kho v1 hoặc storage khác." needsReason={false} onConfirm={async () => {
            resetManagementFixture();
            window.location.reload();
        }}/>
    </div>;
}
