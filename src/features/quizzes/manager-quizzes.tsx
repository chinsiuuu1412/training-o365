"use client";
import { useState } from 'react';
import type { Role } from '@/types/lms';
import type { ApiQuiz, QuizQuestion } from '@/lib/api/quizzes';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Feedback, ResourceFeedback, Pagination, ConfirmAction } from '@/components/shared/management-ui';
import { EmptyState } from '@/components/shared/states';
import { StatusBadge } from '@/components/shared/status-badge';
import { QuizBuilder } from './quiz-builder';
import { QuizResults } from './quiz-results';

export function ManagerQuizzes({ classId, role = 'manager', expired }: { classId: number; role?: Exclude<Role, 'student'>; expired: boolean }) {
    const { services, now } = useApiData(), [page, setPage] = useState(1);
    const [builder, setBuilder] = useState<{ definition?: { quiz: ApiQuiz; questions: QuizQuestion[] } } | null>(null);
    const [preview, setPreview] = useState(0), [results, setResults] = useState<ApiQuiz | null>(null), [message, setMessage] = useState(''), [error, setError] = useState('');
    const resource = useApiResource('quizzes:' + role + ':' + classId + ':' + page, s => s.quizzes.list(role, classId, page));
    return <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-xl font-semibold">Test và Assignment</h2><p className="mt-2 text-sm text-muted-foreground">Single choice, mỗi câu một điểm. Nội dung khóa sau lượt làm đầu tiên.</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void resource.refresh()}>Làm mới Quiz</Button>{role === 'manager' && !expired && <Button disabled={!now} onClick={() => setBuilder({})}>Tạo Quiz</Button>}</div>
        </div>
        <Feedback message={message} /><Feedback message={error} error /><ResourceFeedback resource={resource} />
        {resource.data && <>
            {resource.data.items.map(quiz => <Card key={quiz.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-3"><h3 className="text-lg font-semibold">{quiz.title}</h3><StatusBadge status={quiz.is_published ? 'approved' : 'available'} label={quiz.is_published ? 'Đã phát hành' : 'Bản nháp'} /></div>
                <p className="text-sm">{quiz.quiz_type === 'test' ? 'Test' : 'Assignment'} · {quiz.duration_seconds} giây · Điểm đạt {quiz.pass_score}% · {quiz.attempt_limit} lượt ban đầu</p>
                <p className="text-sm">{formatApiDate(quiz.open_at)} — {formatApiDate(quiz.deadline)} (Việt Nam)</p>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setPreview(quiz.id)}>Xem trước · {quiz.title}</Button>
                    {role === 'manager' && !expired && <Button variant="outline" onClick={async () => {
                        setError('');
                        try {
                            const s = await services;
                            const [definition, attempts] = await Promise.all([s.quizzes.definition(role, classId, quiz.id), s.quizzes.results(role, classId, quiz.id)]);
                            if (attempts.total > 0) throw new Error('Nội dung đã khóa vì có lượt làm, bao gồm lịch sử cycle cũ. Dùng Cấp lượt và hạn mới.');
                            setBuilder({ definition });
                        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được nội dung.'); }
                    }}>Sửa Quiz · {quiz.title}</Button>}
                    <Button variant="outline" onClick={() => setResults(quiz)}>Kết quả · {quiz.title}</Button>
                </div>
            </Card>)}
            {!resource.data.items.length && <EmptyState title="Chưa có Quiz" description="Manager tạo bản nháp rồi xem trước và phát hành." />}
            <Pagination {...resource.data} onPage={setPage} />
        </>}
        {results && <Card className="space-y-4 p-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">{results.title}</h2><Button variant="outline" onClick={() => setResults(null)}>Đóng kết quả</Button></div><QuizResults key={results.id} quiz={results} role={role} expired={expired} /></Card>}
        <Dialog open={builder !== null} onOpenChange={open => { if (!open) setBuilder(null); }} title={builder?.definition ? 'Sửa Quiz' : 'Tạo Quiz'} description="Cấu hình bài single choice. Lưu nháp rồi xem trước để phát hành.">
            {builder && <QuizBuilder classId={classId} definition={builder.definition} onCancel={() => setBuilder(null)} onSaved={id => { setBuilder(null); setPreview(id); setMessage('Đã lưu Quiz. Kiểm tra bản xem trước.'); }} />}
        </Dialog>
        <Dialog open={preview > 0} onOpenChange={open => { if (!open) setPreview(0); }} title="Xem trước Quiz" description="Kiểm tra nội dung, đáp án và cấu hình trước khi phát hành.">
            {preview > 0 && <QuizPreview key={preview} role={role} classId={classId} quizId={preview} expired={expired} onPublished={() => { setPreview(0); setMessage('Đã phát hành Quiz.'); }} />}
        </Dialog>
    </section>;
}
function QuizPreview({ role, classId, quizId, expired, onPublished }: { role: 'admin' | 'manager'; classId: number; quizId: number; expired: boolean; onPublished: () => void }) {
    const { services, write } = useApiData();
    const resource = useApiResource('quiz-preview:' + role + ':' + quizId, s => s.quizzes.definition(role, classId, quizId, role === 'manager'));
    return <div className="space-y-4"><ResourceFeedback resource={resource} />{resource.data && <>
        <h3 className="text-lg font-semibold">{resource.data.quiz.title}</h3>
        <p className="text-sm">{resource.data.quiz.quiz_type === 'test' ? 'Test' : 'Assignment'} · {resource.data.quiz.duration_seconds} giây · {resource.data.quiz.pass_score}% để đạt</p>
        {resource.data.questions.map((question, i) => <article key={question.id} className="space-y-2 rounded-xl border p-4">
            <h4 className="font-semibold">Câu {i + 1} · {question.question_text}</h4>
            <ul className="space-y-2">{question.options.map(option => <li key={option.id} className="break-words text-sm">{option.option_text}{option.is_correct && <span className="ml-2 font-medium text-emerald-800">· Đáp án đúng</span>}</li>)}</ul>
        </article>)}
        {role === 'manager' && !expired && !resource.data.quiz.is_published && <ConfirmAction title="Phát hành Quiz?" trigger="Phát hành Quiz" needsReason={false} description="Student sẽ thấy bài đã phát hành theo giờ mở và hạn nộp." onConfirm={async () => { await write(async () => (await services).quizzes.publish(classId, quizId)); onPublished(); }} />}
    </>}</div>;
}
