"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type {
  QuizAttemptDto,
  QuizDto,
  QuizQuestionDto,
  QuizRunnerDto,
} from "@/types/api";
import { ApiError, formatApiError, getServerNowMs } from "@/lib/api-client";
import { dashboardsApi, quizzesApi } from "@/lib/lms-api";
import {
  canManualSubmitTest,
  cycleKeyRegistry,
  SerializedDraftController,
  startBoundedPoll,
} from "@/lib/quiz-client";
import { formatVietnamDateTime } from "@/lib/date";
import { ActionForm, Feedback } from "@/components/shared/management-ui";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { AttemptHistory, clockLabel } from "./student-quiz-parts";

function answersToMap(list: Array<{ question_id: number; option_ids: number[] }>): Record<number, number> {
  const map: Record<number, number> = {};
  for (const item of list) {
    if (item.option_ids.length > 0) {
      map[item.question_id] = item.option_ids[0];
    }
  }
  return map;
}

export function QuizPlayer({
  classId,
  quizId,
}: {
  classId: number;
  quizId: number;
}) {
  const [enrollmentId, setEnrollmentId] = useState<number | null>(null);
  const [runner, setRunner] = useState<QuizRunnerDto | null>(null);
  const [quizMeta, setQuizMeta] = useState<QuizDto | null>(null);
  const [attempts, setAttempts] = useState<QuizAttemptDto[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [nowMs, setNowMs] = useState(() => getServerNowMs());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedRevision, setSavedRevision] = useState(0);
  const [conflictNotice, setConflictNotice] = useState(false);
  const [uncertainSubmit, setUncertainSubmit] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [cutoffPollExhausted, setCutoffPollExhausted] = useState(false);

  const draftControllerRef = useRef<SerializedDraftController | null>(null);

  const loadRunnerState = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setConflictNotice(false);
      setUncertainSubmit(false);
      setCutoffPollExhausted(false);

      try {
        const [dash, quizDetail, attemptsPage] = await Promise.all([
          dashboardsApi.get("student", signal),
          quizzesApi.get("student", classId, quizId, signal),
          quizzesApi.studentAttempts(classId, quizId, { page: 1, page_size: 50 }, signal),
        ]);

        const classEntry = dash.classes.find((c) => c.class.id === classId);
        const activeCycle = classEntry?.enrollments.find((e) => e.enrollment.status === "enrolled");
        const eid = activeCycle?.enrollment.id ?? null;
        setEnrollmentId(eid);
        setQuizMeta(quizDetail.quiz);
        setAttempts(attemptsPage.items.map((i) => i.attempt));

        try {
          const active = await quizzesApi.studentActiveAttempt(classId, quizId, signal);
          setRunner(active);
          setAnswers(answersToMap(active.answers));
          setSavedRevision(active.attempt.draft_revision);
          if (eid) {
            draftControllerRef.current = new SerializedDraftController(
              active.attempt.draft_revision,
              async (ansMap, expectedRevision) => {
                const payloadAnswers = Object.entries(ansMap).map(([qid, optId]) => ({
                  question_id: Number(qid),
                  option_ids: [optId],
                }));
                const res = await quizzesApi.saveDraft(classId, active.attempt.id, {
                  enrollment_id: eid,
                  expected_revision: expectedRevision,
                  answers: payloadAnswers,
                });
                return res.draft_revision;
              },
            );
          }
        } catch (err) {
          if (signal?.aborted) return;
          if (err instanceof ApiError && err.status === 404) {
            setRunner(null);
          } else {
            throw err;
          }
        }
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải không gian làm bài."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [classId, quizId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadRunnerState(controller.signal);
    });
    return () => controller.abort();
  }, [loadRunnerState]);

  // Continuous server-offset clock; never pauses.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(getServerNowMs());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const attempt = runner?.attempt;
  const attemptId = attempt?.id;
  const attemptStatus = attempt?.status;
  const cutoffMs = attempt ? Date.parse(attempt.effective_cutoff_at) : 0;
  const remainingMs = attempt ? Math.max(0, cutoffMs - nowMs) : 0;
  const isCutoffReached = Boolean(attemptId && attemptStatus === "in_progress" && remainingMs <= 0);

  // When cutoff passes while in_progress, poll server worker with bounded recursive timer (no overlap/stale state).
  useEffect(() => {
    if (!isCutoffReached || !attemptId) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    queueMicrotask(() => {
      if (!cancelled) setCutoffPollExhausted(false);
    });

    const stopPoll = startBoundedPoll({
      maxAttempts: 8,
      intervalMs: 2000,
      poll: async () => {
        if (cancelled || controller.signal.aborted) return true;
        const res = await quizzesApi.studentAttempt(classId, attemptId, controller.signal);
        if (cancelled || controller.signal.aborted) return true;
        if (res.attempt.status === "submitted") {
          cycleKeyRegistry.clearScope(`start:${quizId}`);
          setRunner(null);
          await loadRunnerState(controller.signal);
          return true;
        }
        return false;
      },
      onExhausted: () => {
        if (!cancelled) setCutoffPollExhausted(true);
      },
    });

    return () => {
      cancelled = true;
      controller.abort();
      stopPoll();
    };
  }, [attemptId, isCutoffReached, classId, quizId, loadRunnerState]);

  async function reconcileFromServer() {
    if (!attempt) return;
    setError(null);
    try {
      const fresh = await quizzesApi.studentAttempt(classId, attempt.id);
      if (fresh.attempt.status === "submitted") {
        cycleKeyRegistry.clearScope(`start:${quizId}`);
        setRunner(null);
        await loadRunnerState();
        return;
      }
      setRunner(fresh);
      setAnswers(answersToMap(fresh.answers));
      setSavedRevision(fresh.attempt.draft_revision);
      draftControllerRef.current?.reset(fresh.attempt.draft_revision);
      setConflictNotice(false);
    } catch (err) {
      setError(formatApiError(err, "Không thể đồng bộ bản nháp mới nhất."));
    }
  }

  function handleSelectOption(questionId: number, optionId: number) {
    if (!attempt || attempt.status !== "in_progress" || conflictNotice || remainingMs <= 0) {
      return;
    }
    const nextAnswers = { ...answers, [questionId]: optionId };
    setAnswers(nextAnswers);
    setError(null);

    if (!draftControllerRef.current) return;
    setSaving(true);
    draftControllerRef.current
      .enqueue(nextAnswers)
      .then((newRev) => {
        setSavedRevision(newRev);
      })
      .catch(async (err) => {
        if (err instanceof ApiError && err.code === "draft_revision_conflict") {
          setConflictNotice(true);
          return;
        }
        if (
          err instanceof ApiError &&
          (err.code === "attempt_expired" || err.code === "attempt_already_submitted")
        ) {
          await reconcileFromServer();
          return;
        }
        setError(formatApiError(err, "Lưu nháp thất bại."));
      })
      .finally(() => {
        setSaving(false);
      });
  }

  const backButton = (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/student/classes/${classId}?tab=quizzes`}>Về danh sách Quiz</Link>
    </Button>
  );

  if (loading && !quizMeta) return <LoadingState label="Đang tải bài làm" />;
  if (error && !quizMeta) {
    return (
      <div className="space-y-4">
        {backButton}
        <ErrorState message={error} onRetry={() => void loadRunnerState()} />
      </div>
    );
  }
  if (!quizMeta) {
    return (
      <div className="space-y-4">
        {backButton}
        <EmptyState title="Không tìm thấy bài kiểm tra" description="Bài chưa xuất bản hoặc không tồn tại." />
      </div>
    );
  }

  // No active attempt -> show submitted results & attempt history (no answer key / review: null)
  if (!runner || !attempt || attempt.status === "submitted") {
    const latestSubmitted = attempts.find((a) => a.status === "submitted");
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {backButton}
        <Card className="space-y-5 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {quizMeta.quiz_type === "test" ? "Test" : "Assignment"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{quizMeta.title}</h1>
          </div>

          {latestSubmitted && latestSubmitted.score_percent !== null ? (
            <div role="status" className="rounded-xl bg-blue-50 p-5">
              <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
                <CheckCircle2 size={20} className="text-primary" />
                Lượt #{latestSubmitted.attempt_number}:{" "}
                {Math.round(latestSubmitted.score_percent * 10) / 10}% (
                {latestSubmitted.score ?? 0}/{latestSubmitted.max_score ?? 0})
              </div>
              <p className="mt-2 text-sm text-blue-900">
                Kết quả: {latestSubmitted.is_passed ? "Đạt" : "Chưa đạt"} (Điểm đạt{" "}
                {quizMeta.pass_score}/100)
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Hiện không có lượt làm bài nào đang mở. Quay lại danh sách Quiz để bắt đầu lượt mới nếu còn lượt.
            </p>
          )}

          <AttemptHistory attempts={attempts} />
        </Card>
      </div>
    );
  }

  const questions: QuizQuestionDto[] = runner.questions ?? [];
  const question = questions[Math.min(questionIndex, Math.max(0, questions.length - 1))];
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const quiz = runner.quiz ?? quizMeta;
  const isTest = quiz.quiz_type === "test";
  const manualGate = canManualSubmitTest(attempt.started_at, quiz.duration_seconds, nowMs);
  const manualSubmitAllowed = !isTest || manualGate.allowed;
  const waitUntilManualMs = manualGate.remainingToUnlockMs;
  const isLockedByCutoff = remainingMs <= 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {backButton}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {isTest ? "Test" : "Assignment"} · Lượt #{attempt.attempt_number}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{quiz.title}</h1>
          <p className="tabular-nums mt-1 text-xs text-muted-foreground">
            Cắt tự động lúc: {formatVietnamDateTime(attempt.effective_cutoff_at)} (UTC+7) · Revision #
            {savedRevision}
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3">
          <p className="text-xs text-blue-700">Thời gian còn lại (đồng hồ máy chủ)</p>
          <p
            role="timer"
            className="tabular-nums mt-1 font-mono text-2xl font-semibold text-blue-900"
          >
            {clockLabel(remainingMs)}
          </p>
        </div>
      </header>

      {error && <Feedback message={error} error />}

      {conflictNotice && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <p>
              Phát hiện xung đột phiên bản nháp (phiên bản trên máy chủ đã thay đổi). Vui lòng tải lại bản lưu mới nhất trước khi tiếp tục.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => void reconcileFromServer()}>
            <RefreshCw size={14} />
            Tải lại từ máy chủ
          </Button>
        </div>
      )}

      {isLockedByCutoff && (
        <Card className="space-y-2 border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Đã hết thời gian làm bài</p>
          {cutoffPollExhausted ? (
            <p className="text-amber-900">
              Chưa nhận được kết quả chốt tự động sau 8 lần kiểm tra. Vui lòng bấm kiểm tra lại kết quả thủ công.
            </p>
          ) : (
            <p>
              Hệ thống đang tự động chốt và chấm điểm trên máy chủ. Bạn có thể bấm làm mới nếu kết quả chưa hiển thị.
            </p>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => void loadRunnerState()}>
            <RefreshCw size={14} />
            {cutoffPollExhausted ? "Thử kiểm tra lại kết quả" : "Kiểm tra kết quả"}
          </Button>
        </Card>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="min-w-0 space-y-6 p-5 sm:p-8">
          {question ? (
            <fieldset
              disabled={conflictNotice || isLockedByCutoff}
              className="min-w-0 space-y-4"
            >
              <legend className="mb-4 w-full whitespace-pre-wrap text-lg font-semibold leading-8">
                Câu {questionIndex + 1}/{questions.length}. {question.question_text}
              </legend>
              {question.options.map((opt, idx) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-6 transition-colors ${
                    answers[question.id] === opt.id
                      ? "border-primary bg-blue-50"
                      : "border-border hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={opt.id}
                    checked={answers[question.id] === opt.id}
                    onChange={() => handleSelectOption(question.id, opt.id)}
                    className="mt-1 size-4 shrink-0 accent-blue-600"
                  />
                  <span className="whitespace-pre-wrap">
                    <span className="mr-2 font-semibold">{String.fromCharCode(65 + idx)}.</span>
                    {opt.option_text}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <EmptyState
              title="Bài kiểm tra chưa có câu hỏi"
              description="Vui lòng liên hệ Quản lý lớp."
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={questionIndex === 0}
              onClick={() => setQuestionIndex((i) => i - 1)}
            >
              Câu trước
            </Button>
            <span role="status" className="text-xs text-muted-foreground">
              {saving ? "Đang lưu nháp tuần tự…" : `Đã đồng bộ (Revision #${savedRevision})`}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={questionIndex >= questions.length - 1}
              onClick={() => setQuestionIndex((i) => i + 1)}
            >
              Câu tiếp
            </Button>
          </div>
        </Card>

        <Card className="space-y-5 p-5">
          <div>
            <h2 className="font-semibold">Tiến độ bài làm</h2>
            <p className="tabular-nums mt-1 text-sm text-muted-foreground">
              Đã chọn {answeredCount}/{questions.length} câu
            </p>
            <progress
              className="mt-3 h-2 w-full accent-blue-600"
              value={answeredCount}
              max={questions.length || 1}
              aria-label="Số câu đã chọn"
            />
          </div>

          <nav aria-label="Chọn câu hỏi" className="grid grid-cols-5 gap-2">
            {questions.map((item, idx) => (
              <Button
                key={item.id}
                type="button"
                size="icon"
                variant={answers[item.id] !== undefined ? "default" : "outline"}
                aria-current={idx === questionIndex ? "step" : undefined}
                className={`w-full ${idx === questionIndex ? "ring-2 ring-primary ring-offset-2" : ""}`}
                onClick={() => setQuestionIndex(idx)}
              >
                {idx + 1}
              </Button>
            ))}
          </nav>

          <div className="space-y-2 border-t border-border pt-4">
            <Button
              type="button"
              className="w-full"
              disabled={
                saving ||
                conflictNotice ||
                isLockedByCutoff ||
                !manualSubmitAllowed ||
                !enrollmentId
              }
              onClick={() => setSubmitDialogOpen(true)}
            >
              Nộp bài
            </Button>
            {isTest && !manualSubmitAllowed && (
              <p className="tabular-nums text-xs text-amber-800">
                Bài Test chỉ được nộp thủ công sau 2/3 thời lượng. Mở khóa nộp sau{" "}
                {clockLabel(waitUntilManualMs)}.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Dialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        title="Xác nhận nộp bài"
        description={`Bạn đã chọn ${answeredCount}/${questions.length} câu. Sau khi nộp, hệ thống chấm điểm trên máy chủ và khóa lượt này.`}
      >
        <ActionForm
          submitLabel="Xác nhận nộp bài"
          onCancel={() => setSubmitDialogOpen(false)}
          onSubmit={async () => {
            if (!enrollmentId || !attempt) {
              throw new Error("Thiếu thông tin ghi danh hiện hành.");
            }
            setError(null);
            setUncertainSubmit(false);
            if (draftControllerRef.current) {
              await draftControllerRef.current.flush();
            }
            const rev = draftControllerRef.current?.revision ?? savedRevision;
            const body = {
              enrollment_id: enrollmentId,
              expected_revision: rev,
            };
            const idemKey = cycleKeyRegistry.getOrCreate(
              `submit:${attempt.id}:rev:${rev}`,
              enrollmentId,
              body,
            );
            try {
              await quizzesApi.submit(classId, attempt.id, body, idemKey);
              cycleKeyRegistry.clearScope(`start:${quizId}`);
              setSubmitDialogOpen(false);
              setRunner(null);
              await loadRunnerState();
            } catch (err) {
              if (err instanceof ApiError && err.isUncertainOutcome) {
                setUncertainSubmit(true);
              } else if (err instanceof ApiError && err.code === "draft_revision_conflict") {
                setConflictNotice(true);
                setSubmitDialogOpen(false);
              }
              throw err;
            }
          }}
        >
          <p className="text-sm text-muted-foreground">
            Mã Idempotency-Key gắn với chu kỳ ghi danh và phiên bản nháp hiện tại để tránh nộp trùng.
          </p>
          {uncertainSubmit && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                Trạng thái nộp chưa xác định do lỗi mạng/máy chủ. Hãy kiểm tra kết quả trên máy chủ trước khi thao tác lại.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  setSubmitDialogOpen(false);
                  await reconcileFromServer();
                }}
              >
                Kiểm tra trạng thái bài làm
              </Button>
            </div>
          )}
        </ActionForm>
      </Dialog>
    </div>
  );
}
