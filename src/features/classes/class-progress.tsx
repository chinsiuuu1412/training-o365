"use client";
import { useState } from 'react';
import type { Role } from '@/types/lms';
import type { Progress } from '@/lib/api/classes';
import { useApiResource } from '@/state/api-data-provider';
import { ProgressCard } from '@/components/shared/progress-card';
import { Card } from '@/components/ui/card';
import { Pagination, ResourceFeedback } from '@/components/shared/management-ui';
import { reasonLabels } from '@/features/enrollments/enrollment-history';

export function ProgressSummary({ progress }: { progress: Progress }) {
    return <div className="space-y-3">
        <ProgressCard title={progress.completed ? 'Hoàn thành' : 'Chưa hoàn thành'} description="Kết quả và lý do do response cung cấp." metrics={[
            { label: 'Attendance', value: progress.attendance_percent, detail: progress.attendance_count + '/' + progress.total_sessions + ' buổi bắt buộc' },
            { label: 'Quiz', value: progress.quiz_percent, detail: progress.passed_quiz_count + '/' + progress.published_quiz_count + ' Quiz đã phát hành', color: 'teal' }
        ]} />
        {progress.incomplete_reasons.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">{progress.incomplete_reasons.map(reason => <li key={reason}>{reasonLabels[reason] ?? reason}</li>)}</ul>}
    </div>;
}
export function ClassProgress({ role, classId }: { role: Role; classId: number }) {
    return role === 'student' ? <StudentProgress classId={classId} /> : <StaffProgress role={role} classId={classId} />;
}
function StudentProgress({ classId }: { classId: number }) {
    const resource = useApiResource('dashboard:student', s => s.dashboard.get('student'));
    const rows = resource.data?.classes.find(row => row.class.id === classId)?.enrollments ?? [];
    return <section className="space-y-4"><h2 className="text-xl font-semibold">Tiến độ theo lần ghi danh</h2><ResourceFeedback resource={resource} />
        {rows.map(row => <Card key={row.enrollment.id} className="space-y-4 p-5"><h3 className="font-semibold">Lần học {row.enrollment.cycle_number} · {row.enrollment.status === 'enrolled' ? 'Đang ghi danh' : 'Lịch sử đã kết thúc'}</h3><ProgressSummary progress={row.progress} /></Card>)}
        {resource.data && !rows.length && <p className="text-sm">Chưa có dữ liệu tiến độ.</p>}
    </section>;
}
function StaffProgress({ role, classId }: { role: 'admin' | 'manager'; classId: number }) {
    const [page, setPage] = useState(1);
    const resource = useApiResource('class-progress:' + role + ':' + classId + ':' + page, s => s.progress.list(role, classId, page));
    const roster = useApiResource('progress-roster:' + role + ':' + classId, s => s.enrollments.allRoster(role, classId));
    return <section className="space-y-4"><h2 className="text-xl font-semibold">Tiến độ lớp</h2><ResourceFeedback resource={resource} /><ResourceFeedback resource={roster} />
        {resource.data && <>
            {resource.data.items.map(row => <Card key={row.enrollment.id} className="space-y-4 p-5">
                <h3 className="font-semibold">{roster.data?.find(item => item.enrollment.id === row.enrollment.id)?.student.name ?? 'User #' + row.enrollment.student_id} · Lần học {row.enrollment.cycle_number}</h3>
                <p className="text-sm">Enrollment ID {row.enrollment.id} · {row.enrollment.status === 'enrolled' ? 'Đang ghi danh' : 'Lịch sử đã kết thúc'}</p><ProgressSummary progress={row.progress} />
            </Card>)}
            {!resource.data.items.length && <p className="text-sm">Chưa có lượt ghi danh.</p>}<Pagination {...resource.data} onPage={setPage} />
        </>}
    </section>;
}
