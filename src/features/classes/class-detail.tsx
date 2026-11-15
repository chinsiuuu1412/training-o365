"use client";
import { useState } from 'react';
import Link from 'next/link';
import type { Role } from '@/types/lms';
import type { ApiClass } from '@/lib/api/classes';
import { useApiData, useApiResource } from '@/state/api-data-provider';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
import { ActionForm, ConfirmAction, DataTable, Field, Feedback, Pagination, ResourceFeedback } from '@/components/shared/management-ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { AccountProfileDialog } from '@/features/accounts/account-profile';
import { EnrollmentAction } from '@/features/enrollments/enrollment-action';
import { EnrollmentQueue } from '@/features/enrollments/enrollment-queue';
import { EnrollmentHistory } from '@/features/enrollments/enrollment-history';
import { ClassForm } from './class-form';
import { LessonWorkspace } from '@/features/lessons/lesson-workspace';
import { schedulingEnabled, quizzesEnabled, communicationsEnabled } from '@/state/auth-provider';
import { LibraryWorkspace } from '@/features/materials/library-workspace';
import { ManagerQuizzes } from '@/features/quizzes/manager-quizzes';
import { StudentQuizzes } from '@/features/quizzes/student-quizzes';
import { ClassProgress } from './class-progress';
export function ClassDetail(props: {
    role: Role;
    classId: string;
    initialTab?: string;
    preview?: boolean;
}) {
    return props.role === 'student' && props.initialTab === 'history' ? <div className="space-y-5">
    <Button asChild variant="outline">
    <Link href="/student/classes/?view=history">Về lịch sử của tôi</Link>
    </Button>
    <EnrollmentHistory role="student"/>
    </div> : <ClassDetailView {...props}/>;
}
function ClassDetailView({ role, classId, initialTab = 'overview', preview = false }: {
    role: Role;
    classId: string;
    initialTab?: string;
    preview?: boolean;
}) {
    const [tab, setTab] = useState(initialTab), [editing, setEditing] = useState(false), [message, setMessage] = useState('');
    const { services, write } = useApiData();
    const resource = useApiResource('class:' + role + ':' + classId + ':' + preview, async (s) => role === 'student' && preview ? s.classes.preview(Number(classId)) : {
        class: await s.classes.detail(role, Number(classId)), upcoming_sessions: []
    });
    const course = resource.data?.class, upcoming = resource.data?.upcoming_sessions ?? [];
    const membership = useApiResource('membership:' + role + ':' + classId, async (s) => role === 'student' && preview ? (await s.dashboard.get('student')).classes.some(row => row.class.id === Number(classId) && row.enrollments.some(item => item.enrollment.status === 'enrolled')) : role === 'student');
    return <div className="dashboard-page management-content space-y-6">
    <Button asChild variant="outline">
    <Link href={'/' + role + '/classes/'}>Về danh sách lớp</Link>
    </Button>
    <ResourceFeedback resource={resource}/>
        {course && <>
        <PageHeader title={course.name} description={course.code + ' · ' + course.description} actions={role === 'admin' && !course.is_expired ? <Button onClick={() => setEditing(true)}>Chỉnh sửa lớp</Button> : undefined}/>
        <Feedback message={message}/>
        <p className="text-sm">Manager: {course.manager.name} · {course.enrolled_count}/{course.capacity} học viên · Hết hạn: {course.end_date} (Việt Nam)</p>
        {course.is_expired && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm">Lớp đã hết hạn, staff chỉ xem lịch sử.</p>}<div className="flex flex-wrap gap-2" aria-label="Chi tiết lớp">
            {(preview ? ['overview'] : role === 'student' ? ['overview', ...(schedulingEnabled ? ['lessons'] : []), ...(quizzesEnabled ? ['quizzes', 'progress'] : []), ...(communicationsEnabled ? ['materials'] : []), 'history'] : ['overview', 'students', 'requests', ...(schedulingEnabled ? ['lessons'] : []), ...(quizzesEnabled ? ['quizzes', 'progress'] : []), ...(communicationsEnabled ? ['materials'] : []), 'history']).map(id => <Button key={id} variant={tab === id ? 'default' : 'outline'} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {({
                overview: 'Tổng quan', students: 'Học viên', requests: 'Yêu cầu ghi danh', lessons: 'Buổi học', quizzes: 'Quiz', progress: 'Tiến độ', materials: 'Tài liệu', history: 'Lịch sử ghi danh'
            } as Record<string, string>)[id]}
            </Button>)}
        </div>
 {tab === 'materials' && communicationsEnabled && !preview ? <LibraryWorkspace role={role} classId={course.id} /> : tab === 'quizzes' && quizzesEnabled && !preview ? role === 'student' ? <StudentQuizzes classId={course.id} /> : <ManagerQuizzes classId={course.id} role={role} expired={course.is_expired} /> : tab === 'progress' && quizzesEnabled && !preview ? <ClassProgress role={role} classId={course.id} /> : tab === 'lessons' && schedulingEnabled && !preview ? <LessonWorkspace role={role} classId={course.id} total={course.total_sessions} expired={course.is_expired}/> : tab === 'history' ? <EnrollmentHistory role={role} course={course}/> : tab === 'students' && role !== 'student' ? <Roster role={role} course={course}/> : tab === 'requests' && role !== 'student' ? <EnrollmentQueue role={role} classId={course.id} readonly={course.is_expired}/> : <Card className="space-y-5 p-5">
            <h2 className="text-xl font-semibold">Tổng quan lớp</h2>
            <p className="text-sm leading-7">
            {course.description}
            </p>
            <p className="text-sm">Attendance ≥ {course.min_attendance_percent}% và Quiz ≥ {course.min_quiz_percent}%. Hai tiến độ độc lập.</p>
            <p className="text-sm">Số buổi bắt buộc: {course.total_sessions ?? 'Chưa thiết lập'}
            </p>
 {role === 'manager' && course.total_sessions === null && !course.is_expired && <ActionForm submitLabel="Xác nhận số buổi" onSubmit={async (form) => {
                        await write(async () => (await services).classes.setTotal(course.id, Number(form.get('total'))));
                        setMessage('Đã cố định tổng số buổi.');
                    }}>
                <Field label="Tổng số buổi *">
                <input name="total" type="number" className="form-control" min="1" max="10000" step="1" required/>
                </Field>
                </ActionForm>}
 {role === 'student' && <>
                <ResourceFeedback resource={membership}/>
                {membership.data !== undefined && <EnrollmentAction course={course} enrolled={membership.data}/>}
                </>}
 {preview && upcoming.length > 0 && <div className="space-y-2">
                <h3 className="font-semibold">Buổi học sắp tới</h3>
                    {upcoming.map(row => <p key={row.id} className="text-sm">
                    {row.title}
                    </p>)}
                </div>}
 <p className="text-xs leading-6 text-muted-foreground">Xem lịch học và Attendance trong tab Buổi học khi được mở cho lớp.</p>
            </Card>}
 <Dialog open={editing} onOpenChange={setEditing} title="Sửa thông tin lớp" description="Đổi Manager cần lý do và xác nhận.">
            {editing && <ClassForm course={course} onCancel={() => setEditing(false)} onSaved={() => {
                    setEditing(false);
                    setMessage('Đã lưu lớp và làm mới các dữ liệu liên quan.');
                }}/>}
        </Dialog>
        </>}
 {!course && !resource.loading && !resource.error && <EmptyState title="Không tìm thấy lớp" description="Kiểm tra quyền hoặc chọn lịch sử ghi danh nếu lớp đã hết hạn/bị gỡ."/>}
    </div>;
}
function Roster({ role, course }: {
    role: 'admin' | 'manager';
    course: ApiClass;
}) {
    const { services, write } = useApiData(), [page, setPage] = useState(1);
    const resource = useApiResource('roster:' + role + ':' + course.id + ':' + page, s => s.enrollments.roster(role, course.id, page));
    return <section className="space-y-4">
    <h2 className="text-xl font-semibold">Học viên và từng lần ghi danh</h2>
    <ResourceFeedback resource={resource}/>
        {resource.data && <>
            {resource.data.items.length ? <DataTable caption="Học viên trong lớp" columns={['Học viên', 'Lần ghi danh', 'Tiến độ', 'Thao tác']}>
                {resource.data.items.map(row => <tr key={row.enrollment.id}>
                <th scope="row" className="p-4">
                {row.student.name}<p className="text-xs font-normal">MSSV: {row.student.studentNumber} · User ID: {row.student.userId}
                </p>
                </th>
                <td className="p-4">Lần {row.enrollment.cycle_number}<p className="text-xs">Enrollment ID: {row.enrollment.id}
                </p>
                <p className="text-xs">
                {row.enrollment.status === 'enrolled' ? 'Hiện hành' : 'Đã gỡ'}
                </p>
                </td>
                <td className="p-4">
                <p>Attendance: {row.progress.attendance_count}/{row.progress.total_sessions}
                </p>
                <p>Quiz: {row.progress.passed_quiz_count}/{row.progress.published_quiz_count}
                </p>
                </td>
                <td className="p-4">
                <div className="flex flex-wrap gap-2">
                <AccountProfileDialog user={row.student}/>
                    {row.enrollment.status === 'enrolled' && !course.is_expired && <ConfirmAction title={'Gỡ ' + row.student.name + ' khỏi lớp?'} trigger="Gỡ khỏi lớp" description="Giữ lịch sử cycle cũ; tài khoản vẫn tồn tại. Tái ghi danh tạo enrollment_id mới." onConfirm={async (reason) => {
                            await write(async () => (await services).enrollments.remove(role, course.id, row.enrollment.id, reason));
                        }}/>}
                </div>
                </td>
                </tr>)}
            </DataTable> : <EmptyState title="Chưa có học viên" description="Các enrollment đã được duyệt xuất hiện tại đây."/>}<Pagination {...resource.data} onPage={setPage}/>
        </>}
    </section>;
}
