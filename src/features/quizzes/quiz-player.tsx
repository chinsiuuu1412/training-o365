"use client";
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ApiError } from '@/lib/api/client';
import { isRunner, canSubmitManually, quizAvailability, type AttemptPayload, type QuizRunner, type QuizzesService } from '@/lib/api/quizzes';
import { QuizAttemptController } from '@/lib/api/quiz-attempt-controller';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { detailHref } from '@/config/routes';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ActionForm, Feedback, ResourceFeedback } from '@/components/shared/management-ui';
import { EmptyState } from '@/components/shared/states';
import { AttemptHistory, QuizResultSummary, clockLabel } from './student-quiz-parts';

export function QuizPlayer({ classId, quizId }: { classId: string; quizId: string }) {
    const classNumber = Number(classId), quizNumber = Number(quizId);
    const { services, refresh, now } = useApiData();
    const [started, setStarted] = useState<AttemptPayload | null>(null), [confirm, setConfirm] = useState(false), [message, setMessage] = useState('');
    const startIntent = useRef<{ cycle: number; key: string } | null>(null);
    const resource = useApiResource('quiz-player:' + classId + ':' + quizId, async s => {
        const [quiz, dashboard, active, history] = await Promise.all([s.quizzes.studentInfo(classNumber, quizNumber), s.dashboard.get('student'), s.quizzes.active(classNumber, quizNumber), s.quizzes.history(classNumber, quizNumber)]);
        const cycle = dashboard.classes.find(row => row.class.id === classNumber)?.enrollments.find(row => row.enrollment.status === 'enrolled')?.enrollment;
        return { quiz, cycle, active, latest: history.items[0] ?? null, service: s.quizzes };
    });
    const data = resource.data;
    const payload = [started, data?.active, data?.latest].find(payload => payload && payload.attempt.enrollment_id === data?.cycle?.id) ?? null;
    const back = <Button asChild variant="outline"><Link href={detailHref('student', classId, undefined, 'quizzes')}>Về Quiz của lớp</Link></Button>;
    if (!data) return <div className="space-y-5">{back}<ResourceFeedback resource={resource} />{!resource.loading && !resource.error && <EmptyState title="Không có Quiz trong phạm vi" description="Kiểm tra lớp và lần ghi danh hiện hành." />}</div>;
    if (payload && isRunner(payload)) return <div className="space-y-5"><ResourceFeedback resource={resource} /><RunnerView key={payload.attempt.id} classId={classNumber} service={data.service} initial={payload} onFinished={result => {
        startIntent.current = null;
        setStarted(result);
        setMessage('Kết quả theo đáp án server đã lưu. Thay đổi chưa được xác nhận lưu trước cutoff không được tính.');
        void refresh();
    }} /></div>;
    const available = !!data.cycle && now > 0 && quizAvailability(data.quiz, now) === 'available';
    return <div className="mx-auto max-w-4xl space-y-5">
        {back}<ResourceFeedback resource={resource} /><Feedback message={message} />
        <Card className="space-y-4 p-5 sm:p-7">
            <p className="text-sm font-semibold text-primary">{data.quiz.quiz_type === 'test' ? 'Test' : 'Assignment'}</p>
            <h1 className="text-2xl font-semibold">{data.quiz.title}</h1><p className="whitespace-pre-wrap text-sm leading-7">{data.quiz.description}</p>
            <p className="text-sm">{data.quiz.duration_seconds} giây · Điểm đạt {data.quiz.pass_score}% · Đã dùng {data.quiz.used_attempts}/{data.quiz.allowed_attempts} lượt</p>
            <p className="text-sm">Mở {formatApiDate(data.quiz.open_at)} · Hạn hiệu lực {formatApiDate(data.quiz.effective_deadline)}</p>
            <p className="text-sm">Điểm cao nhất {data.quiz.best_score_percent === null ? 'Chưa có' : data.quiz.best_score_percent + '%'} · {data.quiz.is_passed ? 'Đạt' : 'Chưa đạt'}</p>
            <p className="text-sm leading-7">{data.quiz.quiz_type === 'test' ? 'Test nộp tay từ đúng 2/3 thời lượng.' : 'Assignment cho phép nộp sớm.'} Đồng hồ tiếp tục khi reload hoặc mất mạng. Cutoff có thể sớm hơn thời lượng khi gần hạn.</p>
            {available ? <Button onClick={() => setConfirm(true)}>{payload ? 'Bắt đầu lượt tiếp theo' : 'Bắt đầu làm bài'}</Button> : <p role="status" className="text-sm">{!now ? 'Đang đồng bộ thời gian' : quizAvailability(data.quiz, now) === 'not-open' ? 'Chưa đến giờ mở bài.' : quizAvailability(data.quiz, now) === 'expired' ? 'Đã hết hạn hiệu lực.' : 'Đã dùng hết lượt. Liên hệ Manager nếu cần cấp thêm.'}</p>}
        </Card>
        {payload?.attempt.status === 'submitted' && <QuizResultSummary result={payload} />}
        <AttemptHistory classId={classNumber} quizId={quizNumber} />
        <Dialog open={confirm} onOpenChange={setConfirm} title="Xác nhận bắt đầu Quiz" description="Bắt đầu dùng một lượt. Mỗi Quiz có một lượt đang làm trong cycle hiện tại.">
            <ActionForm submitLabel="Xác nhận bắt đầu" onCancel={() => setConfirm(false)} onSubmit={async () => {
                if (!data.cycle) throw new Error('Không còn lần ghi danh hiện hành.');
                const cycle = data.cycle.id;
                if (!startIntent.current || startIntent.current.cycle !== cycle) startIntent.current = { cycle, key: crypto.randomUUID() };
                try {
                    const result = await (await services).quizzes.start(classNumber, quizNumber, cycle, startIntent.current.key);
                    setStarted(result);
                    if (!isRunner(result)) startIntent.current = null;
                    setConfirm(false);
                    void refresh();
                } catch (error) {
                    try {
                        const s = await services, active = await s.quizzes.active(classNumber, quizNumber);
                        const latest = active ?? (await s.quizzes.history(classNumber, quizNumber)).items[0];
                        if (latest && (isRunner(latest) || latest.attempt.id !== data.latest?.attempt.id)) {
                            setStarted(latest); setConfirm(false); void refresh(); return;
                        }
                    } catch { /* Giữ cùng UUID cho lần thử lại khi chưa đọc được trạng thái. */ }
                    if (error instanceof ApiError && error.status === 409) await resource.refresh();
                    setMessage('Chưa bắt đầu lượt mới. Đã thử đọc lại trạng thái.');
                    throw error;
                }
            }}><p className="text-sm leading-6">Khi quay lại, ứng dụng khôi phục lượt đang làm và đáp án đã được server xác nhận lưu.</p></ActionForm>
        </Dialog>
    </div>;
}
function RunnerView({ classId, service, initial, onFinished }: { classId: number; service: QuizzesService; initial: QuizRunner; onFinished: (result: AttemptPayload) => void }) {
    const { now } = useApiData(), [controller] = useState(() => new QuizAttemptController(service, classId, initial));
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    const [index, setIndex] = useState(0), [confirm, setConfirm] = useState(false), [warning, setWarning] = useState('');
    const notified = useRef(false);
    const cutoff = Date.parse(state.payload.attempt.effective_cutoff_at), expired = now >= cutoff;
    const done = state.payload.attempt.status === 'submitted';
    useEffect(() => {
        if (!state.dirty || state.conflict || state.error || done || expired) return;
        const timer = setTimeout(() => void controller.save(), 500);
        return () => clearTimeout(timer);
    }, [controller, state.answers, state.dirty, state.conflict, state.error, done, expired]);
    useEffect(() => { if (expired && !done) void controller.recover(); }, [controller, expired, done]);
    useEffect(() => {
        const timer = setInterval(() => {
            const current = controller.getSnapshot();
            if (!current.saving && !current.submitting && !current.conflict && !current.dirty && !current.accessDenied) void controller.recover();
        }, 5000);
        function offline() { setWarning('Kết nối gián đoạn. Đồng hồ tiếp tục chạy. Thay đổi chưa được xác nhận lưu có thể mất khi reload hoặc tới cutoff.'); }
        function online() { setWarning('Đang đọc lại bài làm sau khi kết nối trở lại.'); void controller.recover(true); }
        function focus() { const current = controller.getSnapshot(); if (!current.saving && !current.submitting) void controller.recover(); }
        window.addEventListener('offline', offline); window.addEventListener('online', online); window.addEventListener('focus', focus);
        return () => { clearInterval(timer); window.removeEventListener('offline', offline); window.removeEventListener('online', online); window.removeEventListener('focus', focus); };
    }, [controller]);
    useEffect(() => {
        if (done && !notified.current) { notified.current = true; onFinished(state.payload); }
    }, [done, state.payload, onFinished]);
    if (state.accessDenied) return <EmptyState title="Không còn quyền mở bài làm" description={state.error + ' Xem lịch sử tổng quát trong phần Lớp học.'} />;
    if (!isRunner(state.payload)) return <div className="space-y-4"><Feedback message={state.error} error /><QuizResultSummary result={state.payload} /></div>;
    const runner = state.payload, question = runner.questions[Math.min(index, Math.max(0, runner.questions.length - 1))];
    const canEdit = now > 0 && !expired && !state.submitting && !state.conflict && !state.recovering;
    const canSubmit = canSubmitManually(runner, now) && !state.conflict && !state.recovering && !state.submitting;
    const answer = state.answers.find(answer => answer.question_id === question?.id)?.option_ids[0];
    return <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-sm font-semibold text-primary">{runner.quiz.quiz_type === 'test' ? 'Test' : 'Assignment'} · Đang làm bài</p><h1 className="mt-2 text-2xl font-semibold">{runner.quiz.title}</h1><p className="mt-2 text-sm">Lượt {runner.attempt.attempt_number} · Cutoff {formatApiDate(runner.attempt.effective_cutoff_at)}</p></div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-sm">Thời gian còn lại</p><p role="timer" aria-label="Thời gian còn lại" className="font-mono text-3xl font-semibold">{now ? clockLabel(cutoff - now) : 'Đang đồng bộ'}</p></div>
        </header>
        <Feedback message={state.error} error /><Feedback message={warning} />
        <p role="status" className="text-sm">{state.saving ? 'Đang lưu đáp án…' : state.recovering ? 'Đang đọc lại bản server…' : state.conflict ? 'Cần đối chiếu bản lưu' : state.dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu đáp án'} · Bản lưu #{runner.attempt.draft_revision}</p>
        {expired && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm">Đã tới cutoff. Đang chờ kết quả từ server với đáp án đã lưu.</p>}
        {state.conflict && <Card className="space-y-4 border-amber-300 p-5">
            <h2 className="text-lg font-semibold">Đối chiếu đáp án</h2><p className="text-sm">Bản server #{state.conflict.attempt.draft_revision}. Chọn cách tiếp tục trước khi lưu hoặc nộp.</p>
            {runner.questions.map((q, i) => {
                const local = state.answers.find(answer => answer.question_id === q.id)?.option_ids[0], remote = state.conflict!.answers.find(answer => answer.question_id === q.id)?.option_ids[0];
                const label = (id?: number) => q.options.find(option => option.id === id)?.option_text ?? 'Chưa chọn';
                return <p key={q.id} className="text-sm">Câu {i + 1} · Đang chọn {label(local)} · Server {label(remote)}</p>;
            })}
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => controller.reconcile('server')}>Dùng bản server</Button><Button onClick={() => controller.reconcile('local')}>Giữ đáp án đang chọn và lưu lại</Button></div>
        </Card>}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
            <Card className="space-y-5 p-5 sm:p-7">
                {question && <fieldset disabled={!canEdit} className="space-y-4">
                    <legend className="mb-4 text-lg font-semibold">Câu {index + 1} · {question.question_text}</legend>
                    {question.options.map(option => <label key={option.id} className={'flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-7 ' + (answer === option.id ? 'border-blue-600 bg-blue-50' : '')}>
                        <input type="radio" name={'answer-' + question.id} className="mt-1.5" checked={answer === option.id} onChange={() => controller.select(question.id, option.id)} /><span className="break-words">{option.option_text}</span>
                    </label>)}
                    <Button type="button" variant="outline" disabled={!canEdit || answer === undefined} onClick={() => controller.select(question.id, null)}>Bỏ chọn câu này</Button>
                </fieldset>}
                <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={index <= 0} onClick={() => setIndex(index - 1)}>Câu trước</Button><Button variant="outline" disabled={index >= runner.questions.length - 1} onClick={() => setIndex(index + 1)}>Câu tiếp</Button></div>
            </Card>
            <Card className="space-y-4 p-5">
                <h2 className="text-lg font-semibold">Danh sách câu hỏi</h2><p className="text-sm">Đã chọn {state.answers.filter(answer => answer.option_ids.length).length}/{runner.questions.length} câu</p>
                <div className="grid grid-cols-5 gap-2">{runner.questions.map((q, i) => <Button key={q.id} variant={index === i ? 'default' : 'outline'} aria-label={'Câu ' + (i + 1) + (state.answers.some(answer => answer.question_id === q.id) ? ', đã chọn' : ', chưa chọn')} aria-current={index === i ? 'step' : undefined} onClick={() => setIndex(i)}>{i + 1}</Button>)}</div>
                <Button className="w-full" disabled={!canSubmit} onClick={() => setConfirm(true)}>Nộp bài</Button>
                {runner.quiz.quiz_type === 'test' && !canSubmitManually(runner, now) && !expired && <p className="text-sm">Có thể nộp tay sau {clockLabel(Date.parse(runner.attempt.started_at) + runner.quiz.duration_seconds * 1000 * 2 / 3 - now)} khi đủ 2/3 thời lượng.</p>}
                <Button variant="outline" disabled={state.saving || state.submitting || state.recovering} onClick={() => void controller.recover(true)}>Đọc lại bài</Button>
                {state.dirty && !state.conflict && !expired && <Button variant="outline" disabled={state.saving || state.recovering || state.submitting} onClick={() => void controller.save()}>Lưu đáp án</Button>}
                <p className="text-xs leading-6 text-muted-foreground">Đáp án tự lưu sau khi chọn. Chỉ đáp án được xác nhận lưu trước cutoff được chấm. Đồng hồ tiếp tục khi rời trang.</p>
            </Card>
        </div>
        <Dialog open={confirm} onOpenChange={setConfirm} title="Xác nhận nộp bài" description="Lưu đầy đủ đáp án trước, sau đó nộp đúng bản lưu đã được xác nhận.">
            <ActionForm submitLabel="Xác nhận nộp bài" onCancel={() => setConfirm(false)} onSubmit={async () => {
                await controller.submit();
                const next = controller.getSnapshot();
                if (next.payload.attempt.status === 'submitted' || next.conflict) setConfirm(false);
                else if (next.error) throw new Error(next.error);
            }}><p className="text-sm">Đã chọn {state.answers.filter(answer => answer.option_ids.length).length}/{runner.questions.length} câu. Sau khi nộp, lượt này kết thúc.</p></ActionForm>
        </Dialog>
    </div>;
}
