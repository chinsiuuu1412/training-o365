"use client";
import { useEffect, useState } from 'react';
import type { ApiQuiz } from '@/lib/api/quizzes';
import type { EnrollmentId } from '@/lib/api/dto';
import { ApiError } from '@/lib/api/client';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { ActionForm, DataTable, Feedback, Field, Pagination, ResourceFeedback } from '@/components/shared/management-ui';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { localLessonTime, utcLessonTime } from '@/features/lessons/lesson-status';

export function QuizResults({ quiz, role = 'manager', expired }: { quiz: ApiQuiz; role?: 'admin' | 'manager'; expired: boolean }) {
    const [page, setPage] = useState(1), [grant, setGrant] = useState(false), [message, setMessage] = useState('');
    const resource = useApiResource('quiz-results:' + role + ':' + quiz.id + ':' + page, s => s.quizzes.results(role, quiz.class_id, quiz.id, page));
    const roster = useApiResource('quiz-roster:' + role + ':' + quiz.class_id, s => s.enrollments.allRoster(role, quiz.class_id));
    const refresh = resource.refresh;
    useEffect(() => { const timer = setInterval(() => void refresh(), 300000); return () => clearInterval(timer); }, [refresh]);
    return <section className="space-y-4">
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void resource.refresh()}>Làm mới kết quả</Button>{role === 'manager' && !expired && <Button onClick={() => setGrant(true)}>Cấp lượt và hạn mới</Button>}</div>
        <Feedback message={message} /><ResourceFeedback resource={resource} /><ResourceFeedback resource={roster} />
        <p className="text-sm text-muted-foreground">Kết quả được tải lại mỗi 5 phút. Mỗi dòng là một lượt làm thuộc một lần ghi danh.</p>
        {resource.data && <>
            <DataTable caption="Lịch sử lượt làm Quiz" columns={['Học viên / Cycle', 'Lượt / Trạng thái', 'Điểm', 'Thời gian']}>
                {resource.data.items.map(({ attempt }) => {
                    const student = roster.data?.find(row => row.enrollment.id === attempt.enrollment_id)?.student;
                    return <tr key={attempt.id}>
                        <th scope="row" className="p-4">{student?.name ?? 'User #' + attempt.student_id}<p className="text-xs">Enrollment ID {attempt.enrollment_id}</p></th>
                        <td className="p-4">Lượt {attempt.attempt_number}<p className="mt-2"><StatusBadge status={attempt.status === 'in_progress' ? 'active' : attempt.is_passed ? 'passed' : 'failed'} label={attempt.status === 'in_progress' ? 'Đang làm' : attempt.is_passed ? 'Đạt' : 'Chưa đạt'} /></p></td>
                        <td className="p-4">{attempt.score_percent === null ? 'Chưa có điểm' : attempt.score_percent + '%'}</td>
                        <td className="p-4"><p>Bắt đầu {formatApiDate(attempt.started_at)}</p><p>Cutoff {formatApiDate(attempt.effective_cutoff_at)}</p>{attempt.submitted_at && <p>Nộp {formatApiDate(attempt.submitted_at)}</p>}</td>
                    </tr>;
                })}
            </DataTable>
            {!resource.data.items.length && <p className="text-sm">Chưa có lượt làm.</p>}
            <Pagination {...resource.data} onPage={setPage} />
        </>}
        <Dialog open={grant} onOpenChange={setGrant} title="Cấp lượt và hạn mới" description="Chọn đúng lần ghi danh hiện hành. Hạn mới phải vượt hạn hiệu lực của mọi người được chọn.">
            {grant && <GrantForm quiz={quiz} onCancel={() => setGrant(false)} onSaved={receipt => { setGrant(false); setMessage(receipt); }} />}
        </Dialog>
    </section>;
}
function GrantForm({ quiz, onCancel, onSaved }: { quiz: ApiQuiz; onCancel: () => void; onSaved: (message: string) => void }) {
    const { services, write, now } = useApiData();
    const [selected, setSelected] = useState<EnrollmentId[]>([]), [reason, setReason] = useState(''), [extra, setExtra] = useState('1');
    const [deadline, setDeadline] = useState(localLessonTime(new Date(Math.max(now, Date.parse(quiz.deadline)) + 86400000).toISOString()));
    const resource = useApiResource('grant-recipients:' + quiz.class_id, async s => (await s.enrollments.allRoster('manager', quiz.class_id)).filter(row => row.enrollment.status === 'enrolled' && row.student.status === 'active'));
    return <div className="space-y-4"><ResourceFeedback resource={resource} />
        <ActionForm submitLabel="Xác nhận cấp lượt" onCancel={onCancel} onSubmit={async () => {
            try {
                const result = await write(async () => (await services).quizzes.grant(quiz.class_id, quiz.id, selected, reason, utcLessonTime(deadline), Number(extra)));
                onSaved('Đã cấp ' + result.extra_attempts + ' lượt cho enrollment IDs ' + result.granted_enrollment_ids.join(', ') + '. Hạn mới ' + formatApiDate(result.deadline) + '. Cutoff của lượt đang chạy giữ nguyên.');
            } catch (error) {
                if (error instanceof ApiError && error.status === 409) setSelected([]);
                await resource.refresh();
                throw error;
            }
        }}>
            <fieldset className="space-y-3"><legend className="font-semibold">Lần ghi danh nhận lượt</legend>
                {resource.data && <Button type="button" variant="outline" onClick={() => setSelected(resource.data!.map(row => row.enrollment.id))}>Chọn tất cả học viên hiện hành</Button>}
                {resource.data?.map(row => <label key={row.enrollment.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    <input type="checkbox" checked={selected.includes(row.enrollment.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, row.enrollment.id] : previous.filter(id => id !== row.enrollment.id))} />
                    <span>{row.student.name} · Lần học {row.enrollment.cycle_number} · Enrollment ID {row.enrollment.id}</span>
                </label>)}
                {resource.data?.length === 0 && <p className="text-sm">Chưa có học viên đang ghi danh đủ điều kiện.</p>}
            </fieldset>
            <Field label="Lượt bổ sung *"><input type="number" required min="1" max={quiz.quiz_type === 'assignment' ? 10 : undefined} step="1" className="form-control" value={extra} onChange={event => setExtra(event.target.value)} /></Field>
            <Field label="Hạn mới (Việt Nam) *"><input type="datetime-local" required className="form-control" value={deadline} onChange={event => setDeadline(event.target.value)} /></Field>
            <Field label="Lý do cấp lượt *"><textarea required maxLength={2000} className="form-control" value={reason} onChange={event => setReason(event.target.value)} /></Field>
            <p className="text-sm leading-6">Cho phép cấp trước hạn. Hệ thống kiểm tra mọi cycle trong cùng thao tác. Nếu chưa xác định kết quả ghi, kiểm tra hạn/lượt bên Student trước khi gửi lại.</p>
        </ActionForm>
    </div>;
}

