"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLms } from "@/state/lms-provider";
import { getQuizAvailability } from "@/mocks/services/quizzes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, Feedback } from "@/components/shared/management-ui";
import { EmptyState } from "@/components/shared/states";
import { formatDate } from "@/features/dashboard/dashboard-parts";
import { AttemptHistory, RetakeRequest } from "./student-quiz-parts";
import type { Quiz } from "@/types/lms";

const availabilityLabels: Record<string, string> = {
  draft: "Chưa phát hành", "not-open": "Chưa đến giờ mở", closed: "Đã hết hạn",
  exhausted: "Đã hết lượt làm", available: "Có thể bắt đầu", active: "Đang làm bài",
  paused: "Đã tạm dừng", unavailable: "Không thể truy cập",
};

export function StudentQuizzes({ classId }: { classId: string }) {
  const { state } = useLms();
  const quizzes = state.quizzes.filter(quiz => quiz.classId === classId && quiz.status !== "draft");
  return (
    <section className="space-y-5">
      <div><h2 className="text-xl font-semibold">Test & Assignment</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Xem thời hạn, số lượt còn lại và kết quả cao nhất trước khi bắt đầu.</p></div>
      {quizzes.length ? <div className="grid items-start gap-5 xl:grid-cols-2">{quizzes.map(quiz => <StudentQuizCard key={quiz.id} quiz={quiz} />)}</div> : <EmptyState title="Chưa có Quiz được phát hành" description="Bài Test và Assignment của lớp sẽ xuất hiện tại đây." />}
    </section>
  );
}

function StudentQuizCard({ quiz }: { quiz: Quiz }) {
  const { state, now, account, run } = useLms();
  const actor = account("student");
  const router = useRouter();
  const [detail, setDetail] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const availability = getQuizAvailability(state, quiz.id, actor.id, now);
  const attempts = state.attempts.filter(attempt => attempt.quizId === quiz.id && attempt.studentId === actor.id);
  const playerHref = `/student/classes/${quiz.classId}/quizzes/${quiz.id}`;
  const summary = (
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <div><dt className="text-muted-foreground">Mở bài (UTC+7)</dt><dd className="mt-1 font-medium">{formatDate(quiz.opensAt)}</dd></div>
      <div><dt className="text-muted-foreground">Hạn nộp (UTC+7)</dt><dd className="mt-1 font-medium">{formatDate(availability.effectiveDueAt)}</dd></div>
      <div><dt className="text-muted-foreground">Thời gian làm bài</dt><dd className="mt-1 font-medium">{quiz.timeLimitMinutes} phút</dd></div>
      <div><dt className="text-muted-foreground">Lượt còn lại</dt><dd className="mt-1 font-medium">{availability.remainingAttempts}/{availability.attemptLimit}</dd></div>
      <div><dt className="text-muted-foreground">Điểm đạt</dt><dd className="mt-1 font-medium">{quiz.passingScore}/100</dd></div>
      <div><dt className="text-muted-foreground">Điểm cao nhất hợp lệ</dt><dd className="mt-1 font-medium">{availability.bestScore === null ? "Chưa có" : `${availability.bestScore}/100 · ${availability.bestScore >= quiz.passingScore ? "Đạt" : "Chưa đạt"}`}</dd></div>
    </dl>
  );
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{quiz.kind === "test" ? "Test" : "Assignment"}</p><h3 className="mt-2 text-lg font-semibold">{quiz.title}</h3></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">{availabilityLabels[availability.status]}</span></div>
      {summary}
      <Feedback message={error} error />
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => setDetail(true)}>Chi tiết & lịch sử</Button>
        {availability.status === "available" && <Button onClick={() => setConfirm(true)}>Bắt đầu làm bài</Button>}
        {(availability.status === "active" || availability.status === "paused") && <Button asChild><Link href={playerHref}>Tiếp tục bài làm</Link></Button>}
      </div>
      <Dialog open={detail} onOpenChange={setDetail} title={quiz.title} description={`${quiz.kind === "test" ? "Test" : "Assignment"} · Thông tin và kết quả của riêng bạn.`}>
        <div className="space-y-6">{summary}<AttemptHistory attempts={attempts} passingScore={quiz.passingScore} />{attempts.some(attempt => attempt.status === "submitted") && <RetakeRequest quiz={quiz} />}</div>
      </Dialog>
      <Dialog open={confirm} onOpenChange={setConfirm} title="Xác nhận bắt đầu làm bài" description={quiz.kind === "test" ? "Test không được nộp sớm. Hệ thống tự nộp khi hết thời gian hoặc đến hạn. Mô phỏng thoát Test sau khi xác nhận sẽ chấm lượt này 0 điểm." : "Assignment cho phép nộp sớm và tạm dừng bằng nút mô phỏng gián đoạn. Đến hạn nộp, bài vẫn được tự động nộp."}>
        <ActionForm submitLabel="Xác nhận bắt đầu" onCancel={() => setConfirm(false)} onSubmit={async () => {
          setError("");
          await run(actor.id, { type: "startQuiz", quizId: quiz.id });
          setConfirm(false);
          router.push(playerHref);
        }}><p className="text-sm leading-6">Mỗi lượt bắt đầu sẽ sử dụng một lượt làm bài. Câu trả lời được lưu khi bạn chọn.</p></ActionForm>
      </Dialog>
    </Card>
  );
}
