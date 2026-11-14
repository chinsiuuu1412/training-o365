"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLms } from "@/state/lms-provider";
import { getAttemptRemaining, getQuizAvailability } from "@/mocks/services/quizzes";
import type { Command } from "@/mocks/services/management";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, Feedback } from "@/components/shared/management-ui";
import { EmptyState } from "@/components/shared/states";
import { formatDate } from "@/features/dashboard/dashboard-parts";
import { AttemptHistory, clockLabel, RetakeRequest } from "./student-quiz-parts";

export function QuizPlayer({ classId, quizId }: { classId: string; quizId: string }) {
  const { account } = useLms();
  return <PlayerView key={`${account("student").id}-${quizId}`} classId={classId} quizId={quizId} />;
}

function PlayerView({ classId, quizId }: { classId: string; quizId: string }) {
  const { state, now, account, run, pauseAssignmentOnExit } = useLms();
  const actor = account("student");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState("");
  const [dialog, setDialog] = useState<"submit" | "exit" | "pause" | "expiry" | null>(null);
  const syncing = useRef(false);
  const pauseOnExit = useRef(pauseAssignmentOnExit);
  const pauseExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    pauseOnExit.current = pauseAssignmentOnExit;
  }, [pauseAssignmentOnExit]);
  const quiz = state.quizzes.find(item => item.id === quizId && item.classId === classId);
  const availability = getQuizAvailability(state, quizId, actor.id, now);
  const attempt = availability.currentAttempt;
  const remaining = attempt ? getAttemptRemaining(attempt, now) : 0;
  const attempts = state.attempts.filter(item => item.quizId === quizId && item.studentId === actor.id);
  const latest = [...attempts].reverse().find(item => item.status === "submitted");
  const back = <Button variant="outline" asChild><Link href={`/student/classes/${classId}?tab=quizzes`}>Về Quiz của lớp</Link></Button>;

  useEffect(() => {
    if (!attempt?.id || remaining > 0 || syncing.current || availability.status === "unavailable") return;
    syncing.current = true;
    run(actor.id, { type: "syncQuiz", attemptId: attempt.id })
      .catch(cause => setError(cause instanceof Error ? cause.message : "Không thể tự nộp bài. Vui lòng thử lại."))
      .finally(() => { syncing.current = false; });
  }, [actor.id, attempt?.id, remaining, run, availability.status]);

  useEffect(() => {
    function offline() {
      if (quiz?.kind === "assignment" && attempt?.id) pauseOnExit.current(actor.id, attempt.id);
      setWarning("Kết nối mạng đã gián đoạn. Dữ liệu demo vẫn lưu trên trình duyệt. Bạn có thể dùng nút mô phỏng gián đoạn để kiểm tra quy tắc bài làm.");
    }
    function hidden() {
      if (document.hidden) setWarning("Bạn vừa rời màn hình làm bài. Sự kiện trình duyệt chỉ hiển thị cảnh báo trong demo. Nút mô phỏng thoát Test sẽ yêu cầu xác nhận trước khi chấm 0 điểm.");
    }
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [actor.id, attempt?.id, quiz?.kind]);

  useEffect(() => {
    if (pauseExitTimer.current) clearTimeout(pauseExitTimer.current);
    if (quiz?.kind !== "assignment" || !attempt?.id) return;
    const attemptId = attempt.id;
    function pause() {
      pauseOnExit.current(actor.id, attemptId);
    }
    window.addEventListener("pagehide", pause);
    window.addEventListener("beforeunload", pause);
    return () => {
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("beforeunload", pause);
      // Defer route-exit persistence so Strict Mode's effect replay can cancel it.
      pauseExitTimer.current = setTimeout(pause, 0);
    };
  }, [actor.id, attempt?.id, quiz?.kind]);

  async function execute(command: Command) {
    setError("");
    setBusy(true);
    try {
      await run(actor.id, command);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu thay đổi.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!quiz || availability.status === "unavailable" || quiz.status === "draft") return <div className="space-y-4">{back}<EmptyState title="Không thể truy cập bài Quiz" description="Kiểm tra quyền học viên, thời hạn lớp và bài Quiz đã được phát hành." /></div>;
  if (!attempt) return (
    <div className="mx-auto max-w-3xl space-y-6">
      {back}
      <Card className="space-y-5 p-5 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{quiz.kind === "test" ? "Test" : "Assignment"}</p>
        <h1 className="text-2xl font-semibold">{quiz.title}</h1>
        {latest ? <div role="status" className="rounded-xl bg-blue-50 p-5"><h2 className="text-lg font-semibold">Đã nộp bài · {latest.score}/100</h2><p className="mt-2 text-sm">{latest.valid && latest.score >= (latest.passingScore ?? quiz.passingScore) ? "Đạt" : "Chưa đạt"}{latest.submissionReason === "exit" ? " · Lượt Test kết thúc do mô phỏng thoát bài." : ""}</p><p className="mt-2 text-sm">Điểm cao nhất hợp lệ: {availability.bestScore === null ? "Chưa có" : `${availability.bestScore}/100`}. Điểm đạt: {quiz.passingScore}/100.</p></div> : <p className="text-sm text-muted-foreground">Chưa có lượt làm bài đang diễn ra. Về danh sách Quiz để xem điều kiện và xác nhận bắt đầu.</p>}
        <AttemptHistory attempts={attempts} passingScore={quiz.passingScore} />
        {latest && <RetakeRequest quiz={quiz} />}
      </Card>
    </div>
  );

  const questions = attempt.questions ?? quiz.questions ?? [];
  const question = questions[Math.min(questionIndex, Math.max(0, questions.length - 1))];
  const answered = questions.filter(item => !!attempt.answers?.[item.id]).length;
  const paused = attempt.status === "paused";
  const attemptId = attempt.id;
  const canAnswer = !paused && remaining > 0 && !busy && !!attemptId;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{quiz.kind === "test" ? "Test" : "Assignment"} · Không gian làm bài</p><h1 className="mt-2 text-2xl font-semibold">{quiz.title}</h1><p className="mt-2 text-sm text-muted-foreground">Hạn nộp: {formatDate(attempt.dueAt ?? availability.effectiveDueAt)} (UTC+7)</p></div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3"><p className="text-xs text-blue-700">{paused ? "Thời gian đã tạm dừng" : "Thời gian còn lại"}</p><p role="timer" aria-label={`Thời gian còn lại ${clockLabel(remaining)}`} className="mt-1 font-mono text-2xl font-semibold text-blue-900">{clockLabel(remaining)}</p></div>
      </header>
      <Feedback message={error} error />
      <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-muted-foreground">Mô phỏng frontend: đồng hồ, hạn nộp và lưu bài dùng dữ liệu trình duyệt. Việc xác minh thời gian và bảo vệ bài thi thực tế cần backend. Chuyển tab không tự động chấm phạt.</p>
      {warning && <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><p>{warning}</p><Button size="sm" variant="ghost" onClick={() => setWarning("")}>Đóng</Button></div>}
      {paused && <Card className="space-y-3 border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">Assignment đã tạm dừng</h2><p className="text-sm leading-6">Câu trả lời và thời gian còn lại đã được lưu. Hạn nộp vẫn áp dụng trong lúc tạm dừng.</p><Button disabled={busy || !attemptId || remaining <= 0} onClick={() => attemptId && execute({ type: "resumeQuiz", attemptId })}>Tiếp tục làm Assignment</Button>{back}</Card>}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="min-w-0 space-y-6 p-5 sm:p-8">
          {question ? <fieldset disabled={!canAnswer} className="min-w-0 space-y-4"><legend className="mb-6 w-full whitespace-pre-wrap text-lg font-semibold leading-8">Câu {questionIndex + 1}/{questions.length}. {question.prompt}</legend>{question.options.map((option, index) => <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-6 transition-colors ${attempt.answers?.[question.id] === option.id ? "border-primary bg-blue-50" : "border-border hover:bg-slate-50"}`}><input type="radio" name={`question-${question.id}`} value={option.id} checked={attempt.answers?.[question.id] === option.id} className="mt-1 size-4 shrink-0 accent-blue-600" onChange={() => attemptId && execute({ type: "answerQuiz", attemptId, questionId: question.id, optionId: option.id })} /><span className="whitespace-pre-wrap"><span className="mr-2 font-semibold">{String.fromCharCode(65 + index)}.</span>{option.text}</span></label>)}</fieldset> : <EmptyState title="Bài chưa có câu hỏi" description="Liên hệ giảng viên để kiểm tra nội dung bài." />}
          <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" disabled={questionIndex === 0} onClick={() => setQuestionIndex(index => index - 1)}>Câu trước</Button><span role="status" className="text-xs text-muted-foreground">{busy ? "Đang lưu câu trả lời…" : "Câu trả lời được lưu khi chọn"}</span><Button variant="outline" disabled={questionIndex >= questions.length - 1} onClick={() => setQuestionIndex(index => index + 1)}>Câu tiếp</Button></div>
        </Card>
        <Card className="space-y-5 p-5">
          <div><h2 className="font-semibold">Tiến độ bài làm</h2><p className="mt-2 text-sm text-muted-foreground">Đã trả lời {answered}/{questions.length} câu</p><progress className="mt-3 h-2 w-full accent-blue-600" value={answered} max={questions.length || 1} aria-label="Số câu đã trả lời" /></div>
          <nav aria-label="Chọn câu hỏi" className="grid grid-cols-5 gap-2">{questions.map((item, index) => <Button key={item.id} size="icon" variant={attempt.answers?.[item.id] ? "default" : "outline"} aria-current={index === questionIndex ? "step" : undefined} aria-label={`Câu ${index + 1}, ${attempt.answers?.[item.id] ? "đã trả lời" : "chưa trả lời"}`} className={`w-full ${index === questionIndex ? "ring-2 ring-primary ring-offset-2" : ""}`} onClick={() => setQuestionIndex(index)}>{index + 1}</Button>)}</nav>
          <p className="text-xs leading-5 text-muted-foreground">Ô xanh: đã trả lời · Ô trắng: chưa trả lời.</p>
          {quiz.kind === "assignment" ? <Button className="w-full" disabled={!canAnswer} onClick={() => setDialog("submit")}>Nộp bài sớm</Button> : <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6">Test không được nộp sớm. Bài sẽ tự nộp khi hết thời gian hoặc đến hạn.</p>}
          <div className="space-y-3 border-t border-border pt-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Công cụ mô phỏng</h3>{quiz.kind === "test" ? <Button className="w-full" variant="outline" disabled={!canAnswer} onClick={() => setDialog("exit")}>Mô phỏng thoát Test</Button> : <Button className="w-full" variant="outline" disabled={!canAnswer} onClick={() => setDialog("pause")}>Mô phỏng gián đoạn</Button>}<Button className="w-full" variant="outline" disabled={busy || remaining <= 0} onClick={() => setDialog("expiry")}>Tua hết giờ lượt này</Button></div>
        </Card>
      </div>
      <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }} title={dialog === "exit" ? "Xác nhận mô phỏng thoát Test" : dialog === "pause" ? "Tạm dừng Assignment?" : dialog === "expiry" ? "Tua hết giờ lượt hiện tại?" : "Xác nhận nộp Assignment"} description={dialog === "exit" ? "Lượt Test hiện tại sẽ kết thúc ngay và nhận 0 điểm. Bạn cần được giảng viên mở thêm lượt để làm lại. Chỉ thao tác xác nhận này mới áp dụng hình phạt trong demo." : dialog === "pause" ? "Lưu câu trả lời và tạm dừng thời gian còn lại. Hạn nộp bài vẫn áp dụng." : dialog === "expiry" ? "Bài đang làm sẽ tự nộp theo các câu đã trả lời. Thao tác này chỉ tác động lượt hiện tại." : `Bạn đã trả lời ${answered}/${questions.length} câu. Sau khi nộp, bạn không thể chỉnh sửa lượt này.`}>
        <ActionForm submitLabel={dialog === "exit" ? "Xác nhận thoát và nhận 0 điểm" : "Xác nhận"} onCancel={() => setDialog(null)} onSubmit={async () => {
          if (!attemptId) return;
          const type = dialog === "exit" ? "simulateTestExit" : dialog === "pause" ? "pauseQuiz" : dialog === "expiry" ? "simulateQuizExpiry" : "submitQuiz";
          await run(actor.id, { type, attemptId });
          setDialog(null);
        }}><p className="text-sm text-muted-foreground">Kiểm tra lựa chọn trước khi xác nhận.</p></ActionForm>
      </Dialog>
    </div>
  );
}


