"use client";
import { useState } from 'react';
import type { ApiQuiz, QuizQuestion, QuestionInput } from '@/lib/api/quizzes';
import { useApiData } from '@/state/api-data-provider';
import { ActionForm, Field } from '@/components/shared/management-ui';
import { Button } from '@/components/ui/button';
import { localLessonTime, utcLessonTime } from '@/features/lessons/lesson-status';

const emptyQuestion = (): QuestionInput => ({ question_text: '', options: [{ option_text: '', is_correct: false }, { option_text: '', is_correct: false }] });
export function QuizBuilder({ classId, definition, onSaved, onCancel }: {
    classId: number; definition?: { quiz: ApiQuiz; questions: QuizQuestion[] }; onSaved: (id: number) => void; onCancel: () => void;
}) {
    const { services, write, now } = useApiData(), quiz = definition?.quiz;
    const [title, setTitle] = useState(quiz?.title ?? ''), [description, setDescription] = useState(quiz?.description ?? '');
    const [kind, setKind] = useState<'test' | 'assignment'>(quiz?.quiz_type ?? 'assignment');
    const [duration, setDuration] = useState(String(quiz?.duration_seconds ?? 600)), [pass, setPass] = useState(String(quiz?.pass_score ?? 70));
    const [limit, setLimit] = useState(quiz ? String(quiz.attempt_limit) : '');
    const [open, setOpen] = useState(localLessonTime(quiz?.open_at ?? new Date(now - 60000).toISOString()));
    const [deadline, setDeadline] = useState(localLessonTime(quiz?.deadline ?? new Date(now + 7 * 86400000).toISOString()));
    const [questions, setQuestions] = useState<QuestionInput[]>(definition?.questions.map(question => ({
        question_text: question.question_text, options: question.options.map(option => ({ option_text: option.option_text, is_correct: option.is_correct === true }))
    })) ?? [emptyQuestion()]);
    const changeQuestion = (index: number, patch: Partial<QuestionInput>) => setQuestions(previous => previous.map((question, i) => i === index ? { ...question, ...patch } : question));
    return <ActionForm submitLabel="Lưu bản nháp Quiz" onCancel={onCancel} onSubmit={async () => {
        const saved = await write(async () => (await services).quizzes.save(classId, {
            title, description, quiz_type: kind, duration_seconds: Number(duration), pass_score: Number(pass),
            open_at: utcLessonTime(open), deadline: utcLessonTime(deadline), attempt_limit: kind === 'test' ? 1 : limit ? Number(limit) : null, questions
        }, quiz?.id));
        onSaved(saved.quiz.id);
    }}>
        {quiz?.is_published && <p className="rounded-lg bg-amber-50 p-3 text-sm">Bài đã phát hành. Các thay đổi chỉ được lưu khi chưa có bất kỳ lượt làm nào.</p>}
        <Field label="Loại Quiz *"><select className="form-control" value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="assignment">Assignment</option><option value="test">Test</option></select></Field>
        <Field label="Tên Quiz *"><input required maxLength={200} className="form-control" value={title} onChange={event => setTitle(event.target.value)} /></Field>
        <Field label="Mô tả"><textarea maxLength={10000} className="form-control" value={description} onChange={event => setDescription(event.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Thời lượng (giây) *"><input type="number" required min="1" max="31536000" step="1" className="form-control" value={duration} onChange={event => setDuration(event.target.value)} /></Field>
            <Field label="Điểm đạt (%) *"><input type="number" required min="0" max="100" step="any" className="form-control" value={pass} onChange={event => setPass(event.target.value)} /></Field>
            <Field label="Mở bài (Việt Nam) *"><input type="datetime-local" required className="form-control" value={open} onChange={event => setOpen(event.target.value)} /></Field>
            <Field label="Hạn nộp (Việt Nam) *"><input type="datetime-local" required className="form-control" value={deadline} onChange={event => setDeadline(event.target.value)} /></Field>
        </div>
        {kind === 'assignment' ? <Field label="Giới hạn lượt" hint="Để trống dùng mặc định 10 lượt. Mỗi lần bắt đầu dùng một lượt."><input type="number" min="1" step="1" className="form-control" placeholder="10" value={limit} onChange={event => setLimit(event.target.value)} /></Field> : <p className="text-sm">Test mặc định một lượt, nộp tay từ đúng 2/3 thời lượng.</p>}
        {questions.map((question, index) => <fieldset key={index} className="space-y-3 rounded-xl border p-4">
            <legend className="px-2 font-semibold">Câu {index + 1}</legend>
            <Field label={'Nội dung câu ' + (index + 1) + ' *'}><textarea required maxLength={10000} className="form-control" value={question.question_text} onChange={event => changeQuestion(index, { question_text: event.target.value })} /></Field>
            <p className="text-sm">Chọn đúng một đáp án đúng.</p>
            {question.options.map((option, order) => <div key={order} className="flex items-center gap-2">
                <input type="radio" required name={'correct-' + index} aria-label={'Đáp án đúng câu ' + (index + 1) + ', lựa chọn ' + (order + 1)} checked={option.is_correct} onChange={() => changeQuestion(index, { options: question.options.map((item, i) => ({ ...item, is_correct: i === order })) })} />
                <input required maxLength={10000} className="form-control min-w-0 flex-1" aria-label={'Câu ' + (index + 1) + ', lựa chọn ' + (order + 1)} value={option.option_text} onChange={event => changeQuestion(index, { options: question.options.map((item, i) => i === order ? { ...item, option_text: event.target.value } : item) })} />
                <Button type="button" variant="outline" size="sm" disabled={question.options.length <= 2} aria-label={'Xóa lựa chọn ' + (order + 1) + ' câu ' + (index + 1)} onClick={() => changeQuestion(index, { options: question.options.filter((_, i) => i !== order) })}>Xóa</Button>
            </div>)}
            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={question.options.length >= 100} onClick={() => changeQuestion(index, { options: [...question.options, { option_text: '', is_correct: false }] })}>Thêm lựa chọn câu {index + 1}</Button>
                <Button type="button" variant="outline" size="sm" disabled={questions.length <= 1} onClick={() => setQuestions(previous => previous.filter((_, i) => i !== index))}>Xóa câu {index + 1}</Button>
            </div>
        </fieldset>)}
        <Button type="button" variant="outline" disabled={questions.length >= 500} onClick={() => setQuestions(previous => [...previous, emptyQuestion()])}>Thêm câu hỏi</Button>
        <p className="text-sm text-muted-foreground">Sau khi lưu, mở Xem trước để kiểm tra nội dung trước khi phát hành.</p>
    </ActionForm>;
}
