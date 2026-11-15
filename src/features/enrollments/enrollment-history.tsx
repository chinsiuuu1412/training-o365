"use client";
import { useState } from 'react';
import type { Role } from '@/types/lms';
import type { ApiClass } from '@/lib/api/classes';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { ProgressCard } from '@/components/shared/progress-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/states';
import { Pagination, ResourceFeedback } from '@/components/shared/management-ui';
import { Card } from '@/components/ui/card';
export const reasonLabels: Record<string, string> = {
    total_sessions_not_set: 'Chưa thiết lập tổng số buổi', required_sessions_not_ended: 'Các buổi bắt buộc chưa kết thúc', attendance_below_threshold: 'Attendance chưa đạt ngưỡng', quiz_below_threshold: 'Quiz chưa đạt ngưỡng'
};
export function EnrollmentHistory({ role, course }: {
    role: Role;
    course?: ApiClass;
    classId?: string;
}) {
    const { now } = useApiData();
    const [page, setPage] = useState(1);
    const resource = useApiResource('history:' + role + ':' + course?.id + ':' + page, async (s) => {
        if (role === 'student')
            return s.enrollments.history(page);
        if (!course)
            throw new Error('Cần chọn lớp được phân công.');
        const rows = await s.enrollments.roster(role, course.id, page);
        return {
            ...rows, items: rows.items.map(row => ({
                ...row, class: course
            }))
        };
    });
    return <section className="space-y-5">
    <h2 className="text-xl font-semibold">Lịch sử ghi danh</h2>
    <p className="text-sm leading-6 text-muted-foreground">Mỗi enrollment_id là một lần học riêng. Lịch sử chỉ có tổng quát, không cấp lại quyền vào nội dung lớp.</p>
    <ResourceFeedback resource={resource}/>
        {resource.data && <>
            {resource.data.items.map(row => <Card key={row.enrollment.id} data-enrollment-id={row.enrollment.id} className="space-y-4 p-5">
            <div className="flex flex-wrap justify-between gap-3">
            <h3 className="font-semibold">
            {row.class.name} · Lần học {row.enrollment.cycle_number}
            </h3>
            <StatusBadge status={row.progress.completed ? 'approved' : 'pending'} label={row.progress.completed ? 'Hoàn thành' : 'Chưa hoàn thành'}/>
            </div>
            <p className="text-sm">Mã lần ghi danh: {row.enrollment.id} · Mã yêu cầu: {row.enrollment.request_id}
            </p>
            <p className="text-sm">Hạn lớp: {row.class.end_date} (Việt Nam){now >= Date.parse(row.class.end_date + 'T00:00:00+07:00') + 86400000 ? ' · Lớp đã hết hạn, chỉ xem lịch sử' : ''}
            </p>
            <p className="text-sm">
            {row.enrollment.status === 'removed' ? 'Đã kết thúc lần ghi danh' : 'Lần ghi danh được duyệt; quyền nội dung còn tùy hạn lớp'}
            </p>
            <p className="text-sm">Được duyệt: {formatApiDate(row.enrollment.approved_at)}{row.enrollment.removed_at ? ' · Gỡ: ' + formatApiDate(row.enrollment.removed_at) : ''}
            </p>
                {row.enrollment.removal_reason && <p className="text-sm">Lý do: {row.enrollment.removal_reason}
                </p>}<ProgressCard title="Tiến độ của lần ghi danh" description="Số liệu và Completed do response cung cấp." metrics={[{
                    label: 'Attendance', value: Math.round(row.progress.attendance_percent * 10) / 10, detail: row.progress.attendance_count + '/' + row.progress.total_sessions + ' buổi bắt buộc'
                }, {
                    label: 'Quiz', value: Math.round(row.progress.quiz_percent * 10) / 10, detail: row.progress.passed_quiz_count + '/' + row.progress.published_quiz_count + ' bài đã phát hành', color: 'teal'
                }]}/>
                {row.progress.incomplete_reasons.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">
                    {row.progress.incomplete_reasons.map(reason => <li key={reason}>
                    {reasonLabels[reason] ?? reason}
                    </li>)}
                </ul>}
            </Card>)}{!resource.data.items.length && <EmptyState title="Chưa có lịch sử ghi danh" description="Lịch sử chỉ xuất hiện sau khi yêu cầu đã được duyệt."/>}<Pagination {...resource.data} onPage={setPage}/>
        </>}
    </section>;
}
