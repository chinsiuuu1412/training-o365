"use client";
import { useState } from 'react';
import type { Role } from '@/types/lms';
import type { Session } from '@/lib/api/sessions';
import { attendanceWindow, remainingAttendanceAttempts } from '@/lib/api/sessions';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { ActionForm, ConfirmAction, DataTable, Feedback, Field, Pagination, ResourceFeedback } from '@/components/shared/management-ui';
import { Card } from '@/components/ui/card';

export function LessonAttendance({ role, session, expired }: { role: Role; session: Session; expired: boolean }) {
    return role === 'student' ? <StudentAttendance session={session} expired={expired} /> : <StaffAttendance role={role} session={session} expired={expired} />;
}
function StudentAttendance({ session, expired }: { session: Session; expired: boolean }) {
    const { services, write, now } = useApiData();
    const [code, setCode] = useState(''), [message, setMessage] = useState(''), [error, setError] = useState('');
    const [remaining, setRemaining] = useState<{ enrollmentId: number; count: number } | null>(null);
    const [absenceSent, setAbsenceSent] = useState(false);
    const resource = useApiResource('my-attendance:' + session.class_id + ':' + session.id, async s => {
        const [dashboard, rows] = await Promise.all([s.dashboard.get('student'), s.sessions.allAttendance('student', session.class_id)]);
        const enrollment = dashboard.classes.find(row => row.class.id === session.class_id)?.enrollments.find(row => row.enrollment.status === 'enrolled')?.enrollment;
        return { enrollment, record: rows.find(row => row.session_id === session.id && row.enrollment_id === enrollment?.id) };
    });
    const enrollment = resource.data?.enrollment, record = resource.data?.record;
    const attempts = remaining && remaining.enrollmentId === enrollment?.id ? remaining.count : Math.max(0, 3 - (record?.wrong_count ?? 0));
    const open = attendanceWindow(session, now) && !expired && !!enrollment;
    const canEnter = open && !record?.attended && !record?.overridden && attempts > 0 && !resource.error && !resource.loading;
    return <Card className="space-y-4 p-5">
        <h3 className="text-lg font-semibold">Điểm danh của bạn</h3>
        <ResourceFeedback resource={resource} /><Feedback message={message} /><Feedback message={error} error />
        {enrollment && <p className="text-sm">Lần học {enrollment.cycle_number} · Enrollment ID {enrollment.id}</p>}
        <p className="text-sm">{record?.attended ? 'Đã điểm danh thành công' : record?.overridden ? 'Manager đã quyết định không ghi nhận Attendance. Mã không thể ghi đè quyết định này.' : attempts === 0 ? 'Đã sai mã 3 lần. Liên hệ Manager để xác minh.' : 'Chưa ghi nhận Attendance.'}</p>
        <p className="text-sm" role="status">Còn {attempts} lần nhập sai.</p>
        {canEnter ? <ActionForm submitLabel="Xác nhận điểm danh" onSubmit={async () => {
            setError('');
            setMessage('');
            try {
                const result = await write(async () => (await services).sessions.attend(session.class_id, session.id, enrollment!.id, code));
                setRemaining(null);
                setCode('');
                setMessage(result.authoritative && !result.attendance.attended ? 'Attendance đang theo quyết định của Manager.' : 'Đã điểm danh thành công.');
            } catch (error) {
                const count = remainingAttendanceAttempts(error);
                if (count !== null) setRemaining({ enrollmentId: enrollment!.id, count });
                setError((error instanceof Error ? error.message : 'Không thể điểm danh.') + (count !== null ? ' Còn ' + count + ' lần nhập sai.' : ''));
                await resource.refresh();
            }
        }}>
            <Field label="Mã điểm danh *" hint="Mã hiển thị rõ để bạn kiểm tra. Số lần sai được giữ khi tải lại.">
                <input type="text" required autoComplete="off" className="form-control" value={code} onChange={event => setCode(event.target.value)} />
            </Field>
        </ActionForm> : !record?.attended && !record?.overridden && attempts > 0 && <p className="text-sm">Điểm danh mở từ giờ bắt đầu đến trước giờ kết thúc của buổi được duyệt.</p>}
        {!record?.attended && !expired && enrollment && session.approved_proposal_id && now > 0 && now < Date.parse(session.ends_at!) && !absenceSent && <ConfirmAction title="Xin nghỉ buổi học?" trigger="Xin nghỉ học" description="Đơn được tự duyệt, báo Manager và không cấp Attendance." onConfirm={async reason => {
            await write(async () => (await services).sessions.absence(session.class_id, session.id, enrollment.id, reason));
            setAbsenceSent(true);
            setMessage('Đã tự duyệt xin nghỉ và thông báo Manager. Đơn nghỉ không cấp Attendance.');
        }} />}
        {absenceSent && <p className="text-sm">Đơn nghỉ đã gửi trong lần mở trang này. Lịch sử xin nghỉ được giữ riêng với Attendance.</p>}
    </Card>;
}
function StaffAttendance({ role, session, expired }: { role: 'admin' | 'manager'; session: Session; expired: boolean }) {
    const { services, write, now } = useApiData(), [page, setPage] = useState(1), [message, setMessage] = useState('');
    const resource = useApiResource('staff-attendance:' + role + ':' + session.class_id + ':' + page, async s => {
        const [roster, attendance] = await Promise.all([s.enrollments.roster(role, session.class_id, page), s.sessions.allAttendance(role, session.class_id)]);
        return { ...roster, attendance };
    });
    const canOverride = role === 'manager' && !expired && session.approved_proposal_id && now > 0 && now >= Date.parse(session.starts_at!);
    return <div className="space-y-5">
        <Card className="space-y-4 p-5">
            <h3 className="text-lg font-semibold">Quản lý Attendance</h3>
            <p className="text-sm leading-6">{role === 'admin' ? 'Admin chỉ xem Attendance và lịch sử.' : 'Override từ giờ bắt đầu trở đi, kể cả sau khi kết thúc, khi lớp còn hạn. Mọi thay đổi cần lý do và lưu lịch sử.'}</p>
            <ResourceFeedback resource={resource} /><Feedback message={message} />
            {resource.data && <>
                <DataTable caption="Attendance theo lần ghi danh" columns={['Học viên / Lần học', 'Attendance', 'Lần nhập sai', 'Thao tác']}>
                    {resource.data.items.map(row => {
                        const attendance = resource.data!.attendance.find(record => record.session_id === session.id && record.enrollment_id === row.enrollment.id);
                        return <tr key={row.enrollment.id}>
                            <th scope="row" className="p-4 font-medium">{row.student.name}<p className="text-xs">Lần {row.enrollment.cycle_number} · Enrollment ID {row.enrollment.id}</p><p className="text-xs">{row.enrollment.status === 'enrolled' ? 'Đang ghi danh' : 'Lịch sử đã rời lớp'}</p></th>
                            <td className="p-4">{attendance?.attended ? 'Đã ghi nhận' : 'Chưa ghi nhận'}{attendance?.overridden && <p className="mt-1 text-xs">Theo quyết định Manager</p>}</td>
                            <td className="p-4">{attendance?.wrong_count ?? 0}/3</td>
                            <td className="p-4">{canOverride && row.enrollment.status === 'enrolled' && !resource.error && <ConfirmAction title={attendance?.attended ? 'Bỏ credit Attendance?' : 'Ghi nhận Attendance?'} trigger={attendance?.attended ? 'Bỏ credit' : 'Ghi nhận Attendance'} description="Chỉ thay đổi sau khi xác minh. Lưu người, thời điểm, trước–sau và lý do." onConfirm={async reason => {
                                await write(async () => (await services).sessions.override(session.class_id, session.id, row.enrollment.id, !attendance?.attended, reason));
                                setMessage('Đã lưu override và lịch sử Attendance.');
                            }} />}</td>
                        </tr>;
                    })}
                </DataTable>
                {!resource.data.items.length && <p className="text-sm">Chưa có học viên trong lớp.</p>}
                <Pagination {...resource.data} onPage={setPage} />
            </>}
        </Card>
        <AttendanceHistory role={role} session={session} />
    </div>;
}
function AttendanceHistory({ role, session }: { role: 'admin' | 'manager'; session: Session }) {
    const [auditPage, setAuditPage] = useState(1), [absencePage, setAbsencePage] = useState(1);
    const audit = useApiResource('audit:' + role + ':' + session.class_id + ':' + auditPage, s => s.sessions.audit(role, session.class_id, auditPage));
    const absences = useApiResource('absences:' + role + ':' + session.class_id + ':' + absencePage, s => s.sessions.absences(role, session.class_id, absencePage));
    return <>
        <Card className="space-y-4 p-5">
            <h3 className="text-lg font-semibold">Đơn xin nghỉ của lớp</h3><ResourceFeedback resource={absences} />
            {absences.data && <>
                {absences.data.items.map(row => <article key={row.id} className="space-y-1 rounded-lg border p-3 text-sm">
                    <p>Buổi ID {row.session_id} · User ID {row.student_id} · Enrollment ID {row.enrollment_id}</p>
                    <p className="whitespace-pre-wrap">{row.reason}</p><p>{formatApiDate(row.created_at)} · Tự duyệt, không cấp Attendance</p>
                </article>)}
                {!absences.data.items.length && <p className="text-sm">Chưa có đơn xin nghỉ.</p>}<Pagination {...absences.data} onPage={setAbsencePage} />
            </>}
        </Card>
        <Card className="space-y-4 p-5">
            <h3 className="text-lg font-semibold">Lịch sử điều chỉnh của lớp</h3><ResourceFeedback resource={audit} />
            {audit.data && <>
                {audit.data.items.map(row => <article key={row.id} className="space-y-2 rounded-lg border p-3 text-sm">
                    <p>{formatApiDate(row.created_at)} · Người thực hiện #{row.actor_id} · {row.action} · Bản ghi #{row.target_id}</p>
                    <p className="whitespace-pre-wrap">{row.reason}</p>
                    <p className="break-all">Trước · {row.before_json}</p><p className="break-all">Sau · {row.after_json}</p>
                </article>)}
                {!audit.data.items.length && <p className="text-sm">Chưa có điều chỉnh.</p>}<Pagination {...audit.data} onPage={setAuditPage} />
            </>}
        </Card>
    </>;
}
