"use client";

import { useState } from "react";
import type { Quiz, QuizQuestion } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { ActionForm, Field } from "@/components/shared/management-ui";
import { Button } from "@/components/ui/button";
import { localLessonTime, utcLessonTime } from "@/features/lessons/lesson-status";

function newQuestion(): QuizQuestion {
  return { id: crypto.randomUUID(), prompt: "", correctOptionId: "", options: [{ id: crypto.randomUUID(), text: "" }, { id: crypto.randomUUID(), text: "" }] };
}

export function QuizBuilder({ classId, quiz, onSaved, onCancel }: { classId: string; quiz?: Quiz; onSaved: () => void; onCancel: () => void }) {
  const { state, account, run } = useLms();
  const [kind, setKind] = useState<Quiz["kind"]>(quiz?.kind ?? "test");
  const [title, setTitle] = useState(quiz?.title ?? "");
  const [passingScore, setPassingScore] = useState(String(quiz?.passingScore ?? 70));
  const [duration, setDuration] = useState(String(quiz?.timeLimitMinutes ?? 15));
  const [opensAt, setOpensAt] = useState(localLessonTime(quiz?.opensAt));
  const [dueAt, setDueAt] = useState(localLessonTime(quiz?.dueAt));
  const [limit, setLimit] = useState(quiz?.attemptLimit ? String(quiz.attemptLimit) : "");
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => quiz?.questions?.length ? structuredClone(quiz.questions) : [newQuestion()]);
  const locked = !!quiz && (quiz.contentLocked || state.attempts.some(attempt => attempt.quizId === quiz.id));

  function updateQuestion(id: string, changes: Partial<QuizQuestion>) {
    setQuestions(previous => previous.map(question => question.id === id ? { ...question, ...changes } : question));
  }

  return <ActionForm submitLabel="Lưu bản nháp" onCancel={onCancel} onSubmit={async () => {
    if (locked) throw new Error("Bài đã có lượt làm. Hãy sử dụng Mở lại để cấp lượt và hạn mới.");
    if (!title.trim()) throw new Error("Vui lòng nhập tên bài.");
    if (questions.some(question => !question.prompt.trim() || question.options.length < 2 || question.options.some(option => !option.text.trim()) || !question.options.some(option => option.id === question.correctOptionId))) {
      throw new Error("Mỗi câu cần nội dung, ít nhất hai lựa chọn và đúng một đáp án đúng.");
    }
    if (Date.parse(utcLessonTime(opensAt)) >= Date.parse(utcLessonTime(dueAt))) throw new Error("Hạn nộp phải sau thời điểm mở bài.");
    await run(account("teacher").id, {
      type: "saveQuiz", quizId: quiz?.id, classId, kind, title,
      passingScore: Number(passingScore), timeLimitMinutes: Number(duration),
      opensAt: utcLessonTime(opensAt), dueAt: utcLessonTime(dueAt),
      attemptLimit: kind === "test" ? 1 : limit ? Number(limit) : undefined, questions,
    });
    onSaved();
  }}>
    {locked && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Nội dung và cách tính điểm đã khóa vì đã có lượt làm, bao gồm lượt lịch sử. Dùng Mở lại để cấp lượt và hạn mới.</p>}
    <fieldset disabled={locked} className="space-y-4">
      <Field label="Loại bài *"><select className="form-control" value={kind} onChange={event => setKind(event.target.value as Quiz["kind"])}><option value="test">Test</option><option value="assignment">Assignment</option></select></Field>
      <Field label="Tên bài *"><input required className="form-control" maxLength={150} value={title} onChange={event => setTitle(event.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Điểm đạt / 100 *"><input required className="form-control" type="number" min={0} max={100} value={passingScore} onChange={event => setPassingScore(event.target.value)} /></Field>
        <Field label="Thời gian làm bài (phút) *"><input required className="form-control" type="number" min={1} step={1} value={duration} onChange={event => setDuration(event.target.value)} /></Field>
        <Field label="Mở bài (UTC+7) *"><input required className="form-control" type="datetime-local" value={opensAt} onChange={event => setOpensAt(event.target.value)} /></Field>
        <Field label="Hạn nộp (UTC+7) *"><input required className="form-control" type="datetime-local" min={opensAt} value={dueAt} onChange={event => setDueAt(event.target.value)} /></Field>
      </div>
      {kind === "test" ? <p className="text-sm text-muted-foreground">Test mặc định 1 lượt; cấp lượt bổ sung qua Mở lại hoặc duyệt yêu cầu.</p> : <Field label="Giới hạn lượt nộp" hint="Để trống: mặc định 10 lượt nộp."><input className="form-control" type="number" min={1} step={1} value={limit} onChange={event => setLimit(event.target.value)} placeholder="10" /></Field>}
      {questions.map((question, index) => <fieldset key={question.id} className="space-y-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Câu {index + 1}</legend>
        <Field label={`Nội dung câu ${index + 1} *`}><textarea required className="form-control min-h-20" value={question.prompt} onChange={event => updateQuestion(question.id, { prompt: event.target.value })} /></Field>
        <p className="text-xs text-muted-foreground">Chọn một đáp án đúng bằng nút tròn.</p>
        {question.options.map((option, optionIndex) => <div key={option.id} className="flex items-center gap-2">
          <input type="radio" name={`correct-${question.id}`} required aria-label={`Đáp án đúng câu ${index + 1}: lựa chọn ${optionIndex + 1}`} checked={question.correctOptionId === option.id} onChange={() => updateQuestion(question.id, { correctOptionId: option.id })} />
          <input required className="form-control min-w-0 flex-1" aria-label={`Câu ${index + 1}, lựa chọn ${optionIndex + 1}`} value={option.text} onChange={event => updateQuestion(question.id, { options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} />
          <Button type="button" variant="outline" size="sm" disabled={question.options.length <= 2} aria-label={`Xóa lựa chọn ${optionIndex + 1} câu ${index + 1}`} onClick={() => updateQuestion(question.id, { options: question.options.filter(item => item.id !== option.id), correctOptionId: question.correctOptionId === option.id ? "" : question.correctOptionId })}>Xóa</Button>
        </div>)}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => updateQuestion(question.id, { options: [...question.options, { id: crypto.randomUUID(), text: "" }] })}>Thêm lựa chọn câu {index + 1}</Button>
          <Button type="button" variant="outline" size="sm" disabled={questions.length <= 1} onClick={() => setQuestions(previous => previous.filter(item => item.id !== question.id))}>Xóa câu {index + 1}</Button>
        </div>
      </fieldset>)}
      <Button type="button" variant="outline" onClick={() => setQuestions(previous => [...previous, newQuestion()])}>Thêm câu hỏi</Button>
    </fieldset>
    <p className="text-sm text-muted-foreground">Sau khi lưu, chọn Xem trước và xuất bản để kiểm tra toàn bộ bài.</p>
  </ActionForm>;
}
