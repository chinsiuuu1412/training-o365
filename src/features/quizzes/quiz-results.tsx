"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { ApprovalRequest, Quiz } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { ActionForm, DataTable, Feedback, Field } from "@/components/shared/management-ui";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { localLessonTime, utcLessonTime } from "@/features/lessons/lesson-status";
import { formatDate } from "@/features/dashboard/dashboard-parts";

export function QuizResults({ quiz }: { quiz: Quiz }) {
  const { state, now, run, account } = useLms();
  const [snapshot, setSnapshot] = useState(() => ({ state, refreshedAt: now }));
  const [historyStudent, setHistoryStudent] = useState<string | null>(null);
  const [reopen, setReopen] = useState<{ studentId?: string } | null>(null);
  const [decision, setDecision] = useState<{ request: ApprovalRequest; approved: boolean } | null>(null);
  const [message, setMessage] = useState("");
  const refresh = useEffectEvent(() => setSnapshot({ state, refreshedAt: now }));
  useEffect(() => {
    const timer = window.setInterval(() => refresh(), 300000);
    return () => window.clearInterval(timer);
  }, []);
  const members = snapshot.state.enrollments.filter(item => item.classId === quiz.classId && item.status === "approved").map(item => snapshot.state.users.find(user => user.id === item.studentId)).filter(user => !!user);
  const requests = state.requests.filter(request => request.quizId === quiz.id && request.kind === "test-retake");
  const attempts = snapshot.state.attempts.filter(attempt => attempt.quizId === quiz.id);
  const history = attempts.filter(attempt => attempt.studentId === historyStudent);
  const historyName = snapshot.state.users.find(user => user.id === historyStudent)?.name;
  const canReopen = quiz.status !== "draft" && (quiz.kind === "test" || now >= Date.parse(quiz.dueAt));

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-semibold">Kết quả học viên</h3><p className="text-xs text-muted-foreground">Cập nhật 5 phút/lần · Lần cập nhật: {formatDate(new Date(snapshot.refreshedAt).toISOString())}</p></div>
      <Button variant="outline" size="sm" onClick={() => setSnapshot({ state, refreshedAt: now })}>Làm mới kết quả</Button>
    </div>
    <Feedback message={message} />
    {canReopen && <Button variant="outline" onClick={() => setReopen({})}>Mở lại cho cả lớp</Button>}
    {quiz.kind === "assignment" && !canReopen && <p className="text-sm text-muted-foreground">Có thể mở lại Assignment sau khi hết hạn nộp.</p>}
    {members.length ? <DataTable caption={`Kết quả ${quiz.title}`} columns={["Học viên", "Lượt đã nộp", "Điểm cao nhất hợp lệ", "Kết quả", "Thao tác"]}>
      {members.map(student => {
        const submitted = attempts.filter(attempt => attempt.studentId === student.id && (!attempt.status || attempt.status === "submitted"));
        const valid = submitted.filter(attempt => attempt.valid);
        const best = valid.length ? Math.max(...valid.map(attempt => attempt.score)) : null;
        return <tr key={student.id}>
          <th scope="row" className="px-4 py-4 font-medium">{student.name}</th>
          <td className="px-4 py-4">{submitted.length}</td>
          <td className="px-4 py-4">{best === null ? "Chưa có" : `${best}/100`}</td>
          <td className="px-4 py-4">{best === null ? "Chưa có kết quả" : best >= quiz.passingScore ? "Đạt" : "Chưa đạt"}</td>
          <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setHistoryStudent(student.id)}>Lịch sử · {student.name}</Button>{canReopen && <Button variant="outline" size="sm" onClick={() => setReopen({ studentId: student.id })}>Mở lại · {student.name}</Button>}</div></td>
        </tr>;
      })}
    </DataTable> : <EmptyState title="Chưa có học viên" description="Kết quả sẽ xuất hiện khi lớp có học viên được duyệt." />}
    {quiz.kind === "test" && <Card className="space-y-4 p-4">
      <h3 className="font-semibold">Yêu cầu làm lại Test</h3>
      <p className="text-sm text-muted-foreground">Đang chờ ({requests.filter(request => request.status === "waiting").length})</p>
      {requests.filter(request => request.status === "waiting").map(request => <article key={request.id} className="space-y-3 border-t border-border pt-3">
        <p className="text-sm font-medium">{state.users.find(user => user.id === request.senderId)?.name ?? "Học viên"}</p><p className="whitespace-pre-wrap text-sm">{request.description}</p>
        <div className="flex gap-2"><Button size="sm" onClick={() => setDecision({ request, approved: true })}>Duyệt làm lại</Button><Button size="sm" variant="outline" onClick={() => setDecision({ request, approved: false })}>Từ chối làm lại</Button></div>
      </article>)}
      <details><summary className="cursor-pointer text-sm font-medium">Lịch sử yêu cầu đã xử lý</summary><div className="mt-3 space-y-3">{requests.filter(request => request.status !== "waiting").map(request => <article key={request.id} className="border-t border-border pt-3 text-sm"><p>{state.users.find(user => user.id === request.senderId)?.name} · {request.status === "approved" ? "Đã duyệt" : request.status === "declined" ? "Từ chối" : "Đã hủy"}</p><p className="mt-1 text-muted-foreground">{request.description}</p>{request.resolutionReason && <p className="mt-1">Phản hồi: {request.resolutionReason}</p>}</article>)}{!requests.some(request => request.status !== "waiting") && <p className="text-sm text-muted-foreground">Chưa có yêu cầu đã xử lý.</p>}</div></details>
    </Card>}
    <Dialog open={historyStudent !== null} onOpenChange={open => { if (!open) setHistoryStudent(null); }} title={`Lịch sử lượt làm · ${historyName ?? "Học viên"}`} description="Mỗi lượt được lưu riêng; điểm cuối cùng lấy cao nhất trong các lượt nộp hợp lệ.">
      {history.length ? <div className="space-y-3">{history.map((attempt, index) => <article key={attempt.id ?? index} className="rounded-lg border border-border p-3 text-sm"><h4 className="font-medium">Lượt {index + 1}</h4><p className="mt-1">{attempt.status === "active" ? "Đang làm" : attempt.status === "paused" ? "Tạm dừng" : `${attempt.score}/100 · ${attempt.valid ? "Hợp lệ" : "Không hợp lệ"}`}</p>{attempt.submittedAt && <p className="mt-1 text-muted-foreground">Nộp: {formatDate(attempt.submittedAt)}</p>}{attempt.submissionReason && <p className="mt-1">{attempt.submissionReason === "exit" ? "Gián đoạn Test" : attempt.submissionReason === "deadline" ? "Đến hạn nộp" : attempt.submissionReason === "duration" ? "Hết thời gian" : "Đã nộp bài"}</p>}</article>)}</div> : <p className="text-sm text-muted-foreground">Chưa có lượt làm trong lần cập nhật này.</p>}
    </Dialog>
    <Dialog open={reopen !== null} onOpenChange={open => { if (!open) setReopen(null); }} title={reopen?.studentId ? "Mở lại cho học viên" : "Mở lại cho cả lớp"} description="Bắt buộc ghi lý do và hạn mới. Admin sẽ nhận thông báo kèm lý do; các lượt cũ được giữ nguyên.">
      {reopen && <GrantForm quiz={quiz} onCancel={() => setReopen(null)} onSubmit={async (reason, extraAttempts, newDueAt) => {
        await run(account("teacher").id, { type: "reopenQuiz", quizId: quiz.id, studentId: reopen.studentId, reason, extraAttempts, newDueAt });
        setReopen(null); setMessage("Đã mở lại bài và gửi thông báo kèm lý do cho Admin.");
      }} />}
    </Dialog>
    <Dialog open={decision !== null} onOpenChange={open => { if (!open) setDecision(null); }} title={decision?.approved ? "Duyệt yêu cầu làm lại" : "Từ chối yêu cầu làm lại"} description={decision?.approved ? "Cấp lượt bổ sung và hạn nộp mới cho học viên. Admin nhận thông báo kèm lý do." : "Bắt buộc nêu lý do từ chối để học viên nhận phản hồi."}>
      {decision && (decision.approved ? <GrantForm quiz={quiz} onCancel={() => setDecision(null)} onSubmit={async (reason, extraAttempts, newDueAt) => {
        await run(account("teacher").id, { type: "decideRetake", requestId: decision.request.id, approved: true, reason, extraAttempts, newDueAt });
        setDecision(null); setMessage("Đã duyệt yêu cầu làm lại.");
      }} /> : <ActionForm submitLabel="Xác nhận từ chối" onCancel={() => setDecision(null)} onSubmit={async data => {
        await run(account("teacher").id, { type: "decideRetake", requestId: decision.request.id, approved: false, reason: String(data.get("reason") ?? "") });
        setDecision(null); setMessage("Đã từ chối và gửi phản hồi cho học viên.");
      }}><Field label="Lý do từ chối *"><textarea required name="reason" className="form-control min-h-24" /></Field></ActionForm>)}
    </Dialog>
  </div>;
}

function GrantForm({ quiz, onSubmit, onCancel }: { quiz: Quiz; onSubmit: (reason: string, extraAttempts: number, newDueAt: string) => Promise<void>; onCancel: () => void }) {
  return <ActionForm submitLabel="Xác nhận cấp lượt và hạn mới" onCancel={onCancel} onSubmit={async data => {
    await onSubmit(String(data.get("reason") ?? ""), Number(data.get("extraAttempts")), utcLessonTime(String(data.get("newDueAt") ?? "")));
  }}>
    <Field label="Số lượt bổ sung *" hint={quiz.kind === "assignment" ? "Từ 1 đến 10 lượt; mặc định 1 lượt." : "Mặc định 1 lượt bổ sung."}><input required className="form-control" name="extraAttempts" type="number" min={1} max={quiz.kind === "assignment" ? 10 : undefined} step={1} defaultValue={1} /></Field>
    <Field label="Hạn nộp mới (UTC+7) *"><input required className="form-control" name="newDueAt" type="datetime-local" defaultValue={localLessonTime(quiz.dueAt)} /></Field>
    <Field label="Lý do thông báo Admin *"><textarea required className="form-control min-h-24" name="reason" maxLength={1000} /></Field>
  </ActionForm>;
}

