"use client";

import { useState } from "react";
import type { Quiz, QuizAttempt } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, Field } from "@/components/shared/management-ui";
import { formatDate } from "@/features/dashboard/dashboard-parts";

export function clockLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function AttemptHistory({ attempts, passingScore }: { attempts: QuizAttempt[]; passingScore: number }) {
  const submitted = attempts.filter(attempt => attempt.status === "submitted");
  return (
    <section className="space-y-3" aria-label="Lịch sử làm bài">
      <h3 className="font-semibold">Lịch sử làm bài</h3>
      {submitted.length ? <ol className="divide-y divide-border">{submitted.map((attempt, index) => (
        <li key={attempt.id ?? index} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <span>Lượt {index + 1}{attempt.submittedAt && <span className="block text-xs text-muted-foreground">{formatDate(attempt.submittedAt)}</span>}</span>
          <span className={attempt.valid && attempt.score >= passingScore ? "font-medium text-emerald-700" : "font-medium text-slate-700"}>
            {attempt.score}/100 · {!attempt.valid ? "Không hợp lệ" : attempt.score >= passingScore ? "Đạt" : "Chưa đạt"}
          </span>
        </li>
      ))}</ol> : <p className="text-sm text-muted-foreground">Bạn chưa nộp bài lần nào.</p>}
      <p className="text-xs leading-5 text-muted-foreground">Kết quả chỉ hiển thị điểm số. Đáp án không được công bố.</p>
    </section>
  );
}

export function RetakeRequest({ quiz }: { quiz: Quiz }) {
  const { state, account, run } = useLms();
  const actor = account("student");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const requests = state.requests.filter(request => request.kind === "test-retake" && request.quizId === quiz.id && request.senderId === actor.id);
  const latest = [...requests].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (quiz.kind !== "test") return null;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-slate-50 p-4">
      <h3 className="font-semibold">Yêu cầu làm lại Test</h3>
      {latest && <div className="space-y-1 text-sm" role="status">
        <p className="font-medium">{latest.status === "waiting" ? "Đang chờ giảng viên duyệt" : latest.status === "approved" ? "Yêu cầu đã được duyệt" : latest.status === "declined" ? "Yêu cầu bị từ chối" : "Yêu cầu đã hủy"}</p>
        <p className="whitespace-pre-wrap text-muted-foreground">Lý do gửi: {latest.description}</p>
        {latest.resolutionReason && <p className="whitespace-pre-wrap">Phản hồi: {latest.resolutionReason}</p>}
      </div>}
      <Button variant="outline" disabled={latest?.status === "waiting"} onClick={() => setOpen(true)}>Gửi yêu cầu làm lại</Button>
      <Dialog open={open} onOpenChange={setOpen} title="Yêu cầu làm lại Test" description="Giảng viên sẽ xem xét lý do và quyết định mở thêm lượt cùng thời hạn mới.">
        <ActionForm submitLabel="Gửi yêu cầu" onCancel={() => setOpen(false)} onSubmit={async () => {
          await run(actor.id, { type: "requestRetake", quizId: quiz.id, reason });
          setOpen(false);
          setReason("");
        }}>
          <Field label="Lý do làm lại *"><textarea required maxLength={1000} className="form-control min-h-28" value={reason} onChange={event => setReason(event.target.value)} /></Field>
        </ActionForm>
      </Dialog>
    </section>
  );
}
