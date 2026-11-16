"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { QuizAttemptDto, QuizDto, StudentQuizDto } from "@/types/api";
import { ApiError, formatApiError, getServerNowMs } from "@/lib/api-client";
import { quizzesApi } from "@/lib/lms-api";
import { cycleKeyRegistry, quizStartKeyScope } from "@/lib/quiz-client";
import { formatVietnamDateTime } from "@/lib/date";
import { ActionForm, Feedback } from "@/components/shared/management-ui";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { AttemptHistory } from "./student-quiz-parts";

export function StudentQuizzes({
  classId,
  enrollmentId,
}: {
  classId: number;
  enrollmentId: number | null;
}) {
  const [quizzes, setQuizzes] = useState<StudentQuizDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuizzes = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const list = (await quizzesApi.listAll("student", classId, signal)) as StudentQuizDto[];
        setQuizzes(list);
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải danh sách bài kiểm tra."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [classId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadQuizzes(controller.signal);
    });
    return () => controller.abort();
  }, [loadQuizzes]);

  if (loading && quizzes.length === 0) return <LoadingState label="Đang tải danh sách Quiz" />;
  if (error && quizzes.length === 0) {
    return <ErrorState message={error} onRetry={() => void loadQuizzes()} />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Test & Assignment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kiểm tra thời hạn hiệu lực, số lượt còn lại và điểm cao nhất trước khi bắt đầu.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadQuizzes()}>
          <RefreshCw size={14} />
          Làm mới
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <Card>
          <EmptyState
            title="Chưa có bài kiểm tra nào được phát hành"
            description="Test và Assignment sau khi Quản lý lớp xuất bản sẽ hiển thị tại đây."
          />
        </Card>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {quizzes.map((quiz) => (
            <StudentQuizCard
              key={quiz.id}
              classId={classId}
              quiz={quiz}
              enrollmentId={enrollmentId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function StudentQuizCard({
  classId,
  quiz,
  enrollmentId,
}: {
  classId: number;
  quiz: StudentQuizDto;
  enrollmentId: number | null;
}) {
  const router = useRouter();
  const [detailQuiz, setDetailQuiz] = useState<QuizDto | null>(null);
  const [attempts, setAttempts] = useState<QuizAttemptDto[]>([]);
  const [hasActiveAttempt, setHasActiveAttempt] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nowMs = getServerNowMs();
  const effectiveDeadline = quiz.effective_deadline ?? quiz.deadline;
  const openMs = Date.parse(quiz.open_at);
  const deadlineMs = Date.parse(effectiveDeadline);
  const allowed = quiz.allowed_attempts ?? quiz.attempt_limit;
  const used = quiz.used_attempts ?? 0;
  const remaining = Math.max(0, allowed - used);

  let statusLabel = "Có thể bắt đầu";
  let canStart = true;
  if (nowMs < openMs) {
    statusLabel = "Chưa đến giờ mở";
    canStart = false;
  } else if (nowMs >= deadlineMs) {
    statusLabel = "Đã hết hạn";
    canStart = false;
  } else if (remaining <= 0) {
    statusLabel = "Đã hết lượt";
    canStart = false;
  }

  const playerHref = `/student/classes/${classId}/quizzes/${quiz.id}`;

  async function openDetail() {
    setError(null);
    setDetailOpen(true);
    try {
      const [detailRes, attemptsPage] = await Promise.all([
        quizzesApi.get("student", classId, quiz.id),
        quizzesApi.studentAttempts(classId, quiz.id, { page: 1, page_size: 50 }),
      ]);
      setDetailQuiz(detailRes.quiz);
      setAttempts(attemptsPage.items.map((item) => item.attempt));
      try {
        await quizzesApi.studentActiveAttempt(classId, quiz.id);
        setHasActiveAttempt(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setHasActiveAttempt(false);
        }
      }
    } catch (err) {
      setError(formatApiError(err, "Không thể tải chi tiết bài kiểm tra."));
    }
  }

  async function checkActiveState() {
    setError(null);
    try {
      await quizzesApi.studentActiveAttempt(classId, quiz.id);
      setConfirmOpen(false);
      router.push(playerHref);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setUncertain(false);
        setError("Chưa ghi nhận lượt làm đang mở trên máy chủ. Bạn có thể thử bắt đầu lại.");
      } else {
        setError(formatApiError(err, "Không thể kiểm tra trạng thái trên máy chủ."));
      }
    }
  }

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {quiz.quiz_type === "test" ? "Test" : "Assignment"}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{quiz.title}</h3>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
          {statusLabel}
        </span>
      </div>

      <dl className="tabular-nums grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Mở bài (UTC+7)</dt>
          <dd className="mt-1 font-medium">{formatVietnamDateTime(quiz.open_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Hạn hiệu lực (UTC+7)</dt>
          <dd className="mt-1 font-medium">{formatVietnamDateTime(effectiveDeadline)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Thời lượng</dt>
          <dd className="mt-1 font-medium">{Math.round(quiz.duration_seconds / 60)} phút</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Lượt còn lại</dt>
          <dd className="mt-1 font-medium">
            {remaining}/{allowed}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Điểm đạt</dt>
          <dd className="mt-1 font-medium">{quiz.pass_score}/100</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Điểm cao nhất</dt>
          <dd className="mt-1 font-medium">
            {quiz.best_score_percent !== null && quiz.best_score_percent !== undefined
              ? `${Math.round(quiz.best_score_percent * 10) / 10}% · ${quiz.is_passed ? "Đạt" : "Chưa đạt"}`
              : "Chưa có"}
          </dd>
        </div>
      </dl>

      {error && <Feedback message={error} error />}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void openDetail()}>
          Chi tiết & lịch sử
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={playerHref}>Mở không gian làm bài</Link>
        </Button>
        {canStart && enrollmentId && (
          <Button size="sm" onClick={() => setConfirmOpen(true)}>
            Bắt đầu làm bài
          </Button>
        )}
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={detailQuiz?.title ?? quiz.title}
        description="Thông tin chi tiết và lịch sử lượt làm (không bao gồm câu hỏi trước khi bắt đầu)."
      >
        <div className="space-y-5">
          {detailQuiz?.description && (
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {detailQuiz.description}
            </p>
          )}
          <AttemptHistory attempts={attempts} />
          {hasActiveAttempt && (
            <Button asChild className="w-full">
              <Link href={playerHref}>Tiếp tục lượt đang mở</Link>
            </Button>
          )}
        </div>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setUncertain(false);
        }}
        title="Xác nhận bắt đầu làm bài"
        description={
          quiz.quiz_type === "test"
            ? "Đồng hồ chạy liên tục không tạm dừng. Bài Test chỉ cho phép nộp thủ công sau khi đã trôi qua ít nhất 2/3 thời lượng."
            : "Đồng hồ chạy liên tục cho tới hạn cắt hoặc khi bạn bấm Nộp bài."
        }
      >
        <ActionForm
          submitLabel="Xác nhận bắt đầu"
          onCancel={() => setConfirmOpen(false)}
          onSubmit={async () => {
            if (!enrollmentId) {
              throw new Error("Không xác định được mã ghi danh hiện hành.");
            }
            setError(null);
            setUncertain(false);
            const body = { enrollment_id: enrollmentId };
            const scope = quizStartKeyScope(quiz.id, used);
            const idemKey = cycleKeyRegistry.getOrCreate(
              scope,
              enrollmentId,
              body,
            );
            try {
              const started = await quizzesApi.start(classId, quiz.id, body, idemKey);
              if (started.attempt.status === "submitted") {
                cycleKeyRegistry.retire(scope, enrollmentId, body);
              }
              setConfirmOpen(false);
              router.push(playerHref);
            } catch (err) {
              if (err instanceof ApiError && err.isUncertainOutcome) {
                setUncertain(true);
              }
              throw err;
            }
          }}
        >
          <p className="text-sm leading-6 text-slate-700">
            Nhấn xác nhận để máy chủ khởi tạo (hoặc khôi phục) lượt làm bài của bạn.
          </p>
          {uncertain && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                Kết quả khởi tạo chưa rõ ràng do sự cố mạng/máy chủ. Vui lòng kiểm tra trạng thái thực tế trước khi thử lại.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => void checkActiveState()}>
                Kiểm tra trạng thái trên máy chủ
              </Button>
            </div>
          )}
        </ActionForm>
      </Dialog>
    </Card>
  );
}
