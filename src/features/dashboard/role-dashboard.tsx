"use client";
import Link from 'next/link';
import { BookOpen, Users, Bell, ClipboardCheck } from 'lucide-react';
import type { Role } from '@/types/lms';
import { useApiResource, formatApiDate, useApiData } from '@/state/api-data-provider';
import { classCardData, isApiClass } from '@/lib/api/classes';
import { detailHref } from '@/config/routes';
import { PageHeader } from '@/components/shared/page-header';
import { ClassCard } from '@/components/shared/class-card';
import { StatCard } from '@/components/shared/stat-card';
import { ProgressCard } from '@/components/shared/progress-card';
import { ResourceFeedback } from '@/components/shared/management-ui';
import { EmptyState } from '@/components/shared/states';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { schedulingEnabled, quizzesEnabled } from '@/state/auth-provider';
import { reasonLabels } from '@/features/enrollments/enrollment-history';
export function RoleDashboard({ role }: {
    role: Role;
}) {
    const resource = useApiResource('dashboard:' + role, s => s.dashboard.get(role));
    const { now } = useApiData();
    const data = resource.data;
    return <div className="dashboard-page space-y-6">
    <PageHeader title="Tổng quan" description="Số liệu, tiến độ và agenda lấy từ response dùng chung theo quyền." actions={<Button variant="outline" onClick={() => void resource.refresh()}>Làm mới</Button>}/>
    <ResourceFeedback resource={resource}/>
        {data && <>
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Lớp có dữ liệu" value={data.classes.length} detail="Gồm lịch sử theo phạm vi tài khoản" icon={BookOpen}/>
        <StatCard label="Lượt ghi danh" value={data.enrolled_count} detail="Theo định nghĩa enrolled_count của API" icon={Users}/>
        <StatCard label="Thông báo chưa đọc" value={data.unread_count} detail="Tổng từ response dashboard" icon={Bell}/>
        <StatCard label={role === 'admin' ? 'Lịch chờ duyệt' : 'Yêu cầu ghi danh chờ'} value={role === 'admin' ? data.pending_schedules ?? 0 : data.agenda.pending_enrollment_requests} detail={role === 'student' ? 'Student không có quyền duyệt yêu cầu' : 'Theo phạm vi role hiện tại'} icon={ClipboardCheck}/>
        </div>
 {role === 'admin' && <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Tài khoản Student" value={data.student_count ?? 0} detail="Gồm tài khoản vô hiệu hóa" icon={Users}/>
            <StatCard label="Tài khoản Manager" value={data.manager_count ?? 0} detail="Gồm tài khoản vô hiệu hóa" icon={Users}/>
            </div>}
 <section className="space-y-4">
        <h2 className="text-xl font-semibold">Lớp và tiến độ theo lần ghi danh</h2>
            {data.classes.length ? <div className="grid items-start gap-5 md:grid-cols-2">
                {data.classes.map(row => {
                    if (isApiClass(row.class))
                        return <ClassCard key={row.class.id} course={classCardData(row.class)} expired={row.class.is_expired} href={detailHref(role, String(row.class.id))}/>;
                    const course = row.class, expired = !!now && now >= Date.parse(course.end_date + 'T00:00:00+07:00') + 86400000;
                    return <Card key={course.id} className="space-y-4 p-5">
                    <h3 className="text-lg font-semibold">
                    {course.name}
                    </h3>
                    <p className="text-sm">
                    {course.code} · Hạn Việt Nam: {course.end_date}
                    </p>
                        {row.enrollments.map(item => <div key={item.enrollment.id} className="space-y-3">
                        <p className="text-sm">Lần học {item.enrollment.cycle_number} · Enrollment #{item.enrollment.id} · {item.enrollment.status === 'removed' ? 'Đã gỡ' : expired ? 'Lớp hết hạn' : 'Đang ghi danh'}
                        </p>
                        <ProgressCard title={item.progress.completed ? 'Hoàn thành' : 'Chưa hoàn thành'} description="Kết quả do API cung cấp, không lấy từ chứng chỉ mock." metrics={[{
                                label: 'Attendance', value: Math.round(item.progress.attendance_percent * 10) / 10, detail: item.progress.attendance_count + '/' + item.progress.total_sessions + ' buổi'
                            }, {
                                label: 'Quiz', value: Math.round(item.progress.quiz_percent * 10) / 10, detail: item.progress.passed_quiz_count + '/' + item.progress.published_quiz_count + ' bài', color: 'teal'
                            }]}/>
                            {item.progress.incomplete_reasons.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">{item.progress.incomplete_reasons.map(reason => <li key={reason}>{reasonLabels[reason] ?? reason}</li>)}</ul>}
                            {item.enrollment.status === 'enrolled' && !expired && now > 0 && <Button asChild variant="outline">
                            <Link href={detailHref('student', String(course.id))}>Mở lớp {course.name}
                            </Link>
                            </Button>}
                        </div>)}<Button asChild variant="outline">
                    <Link href="/student/classes/?view=history">Xem lịch sử ghi danh</Link>
                    </Button>
                    </Card>;
                })}
            </div> : <EmptyState title="Chưa có lớp trong phạm vi" description="Student có thể tìm lớp; Manager chờ được phân công."/>}
        </section>
 <section className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
        <h2 className="text-xl font-semibold">Buổi học sắp tới</h2>
            {data.agenda.upcoming_sessions.length ? data.agenda.upcoming_sessions.map(session => <article key={session.id} className="border-t pt-3 text-sm">
            <h3 className="font-semibold">
            {session.title}
            </h3>
            <p>
            {formatApiDate(session.starts_at)} — {formatApiDate(session.ends_at)}
            </p>
            <p>
            {session.location}
            </p>
            <Button asChild variant="outline" size="sm">
            <Link href={detailHref(role, String(session.class_id), undefined, schedulingEnabled ? 'lessons' : 'overview') + (schedulingEnabled ? '&sessionId=' + session.id : '')}>{schedulingEnabled ? 'Xem buổi học' : 'Xem lớp'}</Link>
            </Button>
            </article>) : <p className="text-sm">Không có buổi học sắp tới trong agenda.</p>}
        </Card>
        <Card className="space-y-3 p-5">
        <h2 className="text-xl font-semibold">Quiz và hạn nộp sắp tới</h2>
            {data.agenda.quizzes.length ? data.agenda.quizzes.map(quiz => <article key={quiz.id} className="border-t pt-3 text-sm">
            <h3 className="font-semibold">
            {quiz.title}
            </h3>
            <p>
            {quiz.quiz_type === 'test' ? 'Quiz Test' : 'Quiz Assignment'} · Hạn {formatApiDate(quiz.deadline)}
            </p>
            {quizzesEnabled && <Button asChild variant="outline" size="sm"><Link href={role === 'student' ? detailHref(role, String(quiz.class_id), String(quiz.id)) : detailHref(role, String(quiz.class_id), undefined, 'quizzes')}>{role === 'student' ? 'Xem / Làm Quiz' : 'Xem Quiz của lớp'}</Link></Button>}
            </article>) : <p className="text-sm">Không có Quiz trong agenda.</p>}{data.agenda.active_attempts.length > 0 && <p className="text-sm">
            {data.agenda.active_attempts.length} lượt đang làm.</p>}{quizzesEnabled && role === 'student' && data.agenda.active_attempts.map(item => <Button asChild variant="outline" key={item.attempt_id}><Link href={detailHref(role, String(item.quiz.class_id), String(item.quiz.id))}>Tiếp tục · {item.quiz.title}</Link></Button>)}
        </Card>
        </section>
        </>}
    </div>;
}
