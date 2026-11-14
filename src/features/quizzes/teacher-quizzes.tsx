"use client";

import { useState } from "react";
import type { Quiz } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { ActionForm, Feedback } from "@/components/shared/management-ui";
import { EmptyState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/features/dashboard/dashboard-parts";
import { QuizBuilder } from "./quiz-builder";
import { QuizResults } from "./quiz-results";

export function TeacherQuizzes({ classId }: { classId: string }) {
  const { state, ready, account, run, now } = useLms();
  const [builder, setBuilder] = useState<{ quiz?: Quiz } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [resultsId, setResultsId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const course = state.classes.find(item => item.id === classId);
  const actor = account("teacher");
  const quizzes = state.quizzes.filter(quiz => quiz.classId === classId);
  const preview = quizzes.find(quiz => quiz.id === previewId);
  const selected = quizzes.find(quiz => quiz.id === resultsId);
  if (!ready) return <p role="status" className="text-sm text-muted-foreground">Đang tải Quiz…</p>;
  if (!course || course.teacherId !== actor.id || actor.status === "suspended") return <EmptyState title="Không có quyền quản lý Quiz" description="Chỉ giảng viên hiện được phân công cho lớp mới có quyền quản lý." />;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Test & Assignment</h2><p className="mt-1 text-sm text-muted-foreground">Tạo bài trắc nghiệm, xem trước, xuất bản và theo dõi kết quả.</p></div><Button onClick={() => setBuilder({})}>Tạo Quiz</Button></div>
    <Feedback message={message} />
    {(["test", "assignment"] as const).map(kind => <Card key={kind} className="space-y-4 p-5">
      <h3 className="text-lg font-semibold">{kind === "test" ? "Test" : "Assignment"}</h3>
      {quizzes.filter(quiz => quiz.kind === kind).map(quiz => {
        const locked = quiz.contentLocked || state.attempts.some(attempt => attempt.quizId === quiz.id);
        const status = quiz.status === "draft" ? "Bản nháp" : now < Date.parse(quiz.opensAt) ? "Đã xuất bản · Chờ mở" : now >= Date.parse(quiz.dueAt) ? "Đã hết hạn" : "Đang mở";
        return <article key={quiz.id} className="space-y-3 border-t border-border pt-4">
          <h4 className="font-medium">{quiz.title}</h4>
          <p className="text-sm text-muted-foreground">{status} · {quiz.passingScore}/100 để đạt · {quiz.timeLimitMinutes} phút · {quiz.attemptLimit ?? (kind === "test" ? 1 : 10)} lượt</p>
          <p className="text-sm text-muted-foreground">Mở: {formatDate(quiz.opensAt)} · Hạn: {formatDate(quiz.dueAt)}</p>
          {locked && <p className="text-xs text-amber-800">Đã khóa nội dung và cách tính điểm vì đã có lượt làm.</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewId(quiz.id)}>{quiz.status === "draft" ? "Xem trước và xuất bản" : "Xem nội dung bài"}</Button>
            {!locked && <Button variant="outline" size="sm" onClick={() => setBuilder({ quiz })}>Chỉnh sửa · {quiz.title}</Button>}
            <Button variant="outline" size="sm" onClick={() => setResultsId(resultsId === quiz.id ? null : quiz.id)}>Kết quả và yêu cầu · {quiz.title}</Button>
          </div>
        </article>;
      })}
      {!quizzes.some(quiz => quiz.kind === kind) && <p className="text-sm text-muted-foreground">Chưa có {kind === "test" ? "Test" : "Assignment"}. Chọn Tạo Quiz để bắt đầu.</p>}
    </Card>)}
    {selected && <Card className="space-y-5 p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{selected.title}</h2><Button variant="outline" size="sm" onClick={() => setResultsId(null)}>Đóng kết quả</Button></div><QuizResults key={selected.id} quiz={selected} /></Card>}
    <Dialog open={builder !== null} onOpenChange={open => { if (!open) setBuilder(null); }} title={builder?.quiz ? "Chỉnh sửa Quiz" : "Tạo Quiz"} description="100% trắc nghiệm. Mỗi câu chỉ có một đáp án đúng. Lưu nháp rồi xem trước trước khi xuất bản.">
      {builder && <QuizBuilder key={builder.quiz?.id ?? "new"} classId={classId} quiz={builder.quiz} onCancel={() => setBuilder(null)} onSaved={() => { setBuilder(null); setMessage("Đã lưu bản nháp. Hãy xem trước bài và xác nhận xuất bản."); }} />}
    </Dialog>
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreviewId(null); }} title={`Xem trước · ${preview?.title ?? "Quiz"}`} description="Kiểm tra cấu hình, câu hỏi và đáp án trước khi xác nhận xuất bản.">
      {preview && <div className="space-y-4">
        <p className="text-sm">{preview.kind === "test" ? "Test" : "Assignment"} · {preview.timeLimitMinutes} phút · Điểm đạt {preview.passingScore}/100 · {preview.attemptLimit ?? (preview.kind === "test" ? 1 : 10)} lượt</p>
        <p className="text-sm">Mở: {formatDate(preview.opensAt)} · Hạn: {formatDate(preview.dueAt)}</p>
        {(preview.questions ?? []).map((question, index) => <article key={question.id} className="space-y-2 rounded-lg border border-border p-3 text-sm"><h3 className="font-medium">Câu {index + 1}. {question.prompt}</h3><ol className="list-inside list-decimal space-y-2">{question.options.map(option => <li key={option.id}>{option.text}{option.id === question.correctOptionId && <span className="font-medium text-emerald-700"> · Đáp án đúng</span>}</li>)}</ol></article>)}
        {!preview.questions?.length && <p className="text-sm text-muted-foreground">Bài lịch sử chưa có nội dung câu hỏi. Cần bổ sung nội dung trước khi xuất bản.</p>}
        {preview.status === "draft" && <ActionForm submitLabel="Đã kiểm tra · Xác nhận xuất bản" onSubmit={async () => {
          await run(actor.id, { type: "publishQuiz", quizId: preview.id });
          setPreviewId(null); setMessage("Đã xuất bản Quiz theo thời gian mở bài đã đặt.");
        }}><p className="text-sm text-muted-foreground">Sau khi có lượt làm đầu tiên, nội dung và cách tính điểm sẽ được khóa.</p></ActionForm>}
      </div>}
    </Dialog>
  </div>;
}
