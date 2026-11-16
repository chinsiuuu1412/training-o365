"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { ClassDto, QuizDto, QuizQuestionDto } from "@/types/api";
import { formatApiError } from "@/lib/api-client";
import { quizzesApi } from "@/lib/lms-api";
import { formatVietnamDateTime } from "@/lib/date";
import { ActionForm, Feedback } from "@/components/shared/management-ui";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { QuizBuilder } from "./quiz-builder";
import { QuizResults } from "./quiz-results";

export function TeacherQuizzes({
  role,
  classDto,
}: {
  role: "admin" | "manager";
  classDto: ClassDto;
}) {
  const [quizzes, setQuizzes] = useState<QuizDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [builder, setBuilder] = useState<{ quiz?: QuizDto } | null>(null);
  const [preview, setPreview] = useState<{ quiz: QuizDto; questions: QuizQuestionDto[] } | null>(
    null,
  );
  const [resultsQuiz, setResultsQuiz] = useState<QuizDto | null>(null);

  const loadQuizzes = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const list = await quizzesApi.listAll(role, classDto.id, signal);
        setQuizzes(list);
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải danh sách bài kiểm tra."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [role, classDto.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadQuizzes(controller.signal);
    });
    return () => controller.abort();
  }, [loadQuizzes]);

  async function openPreview(quiz: QuizDto) {
    setError(null);
    try {
      const res =
        role === "manager"
          ? await quizzesApi.preview(classDto.id, quiz.id)
          : await quizzesApi.get("admin", classDto.id, quiz.id);
      setPreview({ quiz: res.quiz, questions: res.questions ?? [] });
    } catch (err) {
      setError(formatApiError(err, "Không thể tải nội dung xem trước."));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Test & Assignment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý bài trắc nghiệm một lựa chọn, xuất bản và theo dõi kết quả học viên.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadQuizzes()}>
            <RefreshCw size={14} />
            Làm mới
          </Button>
          {role === "manager" && !classDto.is_expired && (
            <Button size="sm" onClick={() => setBuilder({})}>
              <Plus size={15} />
              Tạo Quiz
            </Button>
          )}
        </div>
      </div>

      <Feedback message={message} />
      {error && <Feedback message={error} error />}

      {loading && quizzes.length === 0 ? (
        <LoadingState label="Đang tải danh sách bài kiểm tra" />
      ) : error && quizzes.length === 0 ? (
        <ErrorState message={error} onRetry={() => void loadQuizzes()} />
      ) : quizzes.length === 0 ? (
        <Card>
          <EmptyState
            title="Chưa có bài Test hoặc Assignment"
            description="Tạo bài kiểm tra mới để gắn vào lớp học."
          />
        </Card>
      ) : (
        (["test", "assignment"] as const).map((kind) => {
          const items = quizzes.filter((q) => q.quiz_type === kind);
          return (
            <Card key={kind} className="space-y-4 p-5">
              <h3 className="text-lg font-semibold">
                {kind === "test" ? "Test" : "Assignment"} ({items.length})
              </h3>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có bài {kind === "test" ? "Test" : "Assignment"} nào.
                </p>
              ) : (
                items.map((quiz) => (
                  <article key={quiz.id} className="space-y-3 border-t border-border pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold">{quiz.title}</h4>
                      <StatusBadge
                        status={quiz.is_published ? "approved" : "draft"}
                        label={quiz.is_published ? "Đã xuất bản" : "Bản nháp"}
                      />
                    </div>
                    <p className="tabular-nums text-sm text-muted-foreground">
                      Đạt: {quiz.pass_score}/100 · Thời lượng:{" "}
                      {Math.round(quiz.duration_seconds / 60)} phút · Tối đa {quiz.attempt_limit} lượt
                    </p>
                    <p className="tabular-nums text-xs text-muted-foreground">
                      Mở: {formatVietnamDateTime(quiz.open_at)} · Hạn:{" "}
                      {formatVietnamDateTime(quiz.deadline)} (UTC+7)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void openPreview(quiz)}>
                        {quiz.is_published ? "Xem nội dung" : "Xem trước & xuất bản"}
                      </Button>
                      {role === "manager" && !classDto.is_expired && (
                        <Button size="sm" variant="outline" onClick={() => setBuilder({ quiz })}>
                          Chỉnh sửa
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setResultsQuiz(resultsQuiz?.id === quiz.id ? null : quiz)
                        }
                      >
                        Kết quả & gia hạn
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </Card>
          );
        })
      )}

      {resultsQuiz && (
        <Card className="space-y-5 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{resultsQuiz.title}</h2>
            <Button variant="outline" size="sm" onClick={() => setResultsQuiz(null)}>
              Đóng kết quả
            </Button>
          </div>
          <QuizResults
            key={resultsQuiz.id}
            role={role}
            classId={classDto.id}
            quiz={resultsQuiz}
            isExpired={classDto.is_expired}
          />
        </Card>
      )}

      {role === "manager" && (
        <Dialog
          open={builder !== null}
          onOpenChange={(open) => {
            if (!open) setBuilder(null);
          }}
          title={builder?.quiz ? "Chỉnh sửa Quiz" : "Tạo Quiz mới"}
          description="Câu hỏi trắc nghiệm một đáp án đúng. Nội dung sẽ tự động khóa khi đã có lượt làm bài."
        >
          {builder && (
            <QuizBuilder
              key={builder.quiz?.id ?? "new"}
              classId={classDto.id}
              quiz={builder.quiz}
              onCancel={() => setBuilder(null)}
              onSaved={async () => {
                setBuilder(null);
                setMessage("Đã lưu bài kiểm tra.");
                await loadQuizzes();
              }}
            />
          )}
        </Dialog>
      )}

      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title={`Xem trước · ${preview?.quiz.title ?? ""}`}
        description="Kiểm tra toàn bộ câu hỏi và đáp án đúng trước khi xuất bản cho học viên."
      >
        {preview && (
          <div className="space-y-4">
            <p className="tabular-nums text-sm">
              {preview.quiz.quiz_type === "test" ? "Test" : "Assignment"} ·{" "}
              {Math.round(preview.quiz.duration_seconds / 60)} phút · Điểm đạt{" "}
              {preview.quiz.pass_score}/100 · {preview.quiz.attempt_limit} lượt
            </p>
            {preview.questions.map((q, idx) => (
              <article key={q.id} className="space-y-2 rounded-lg border border-border p-3 text-sm">
                <h3 className="font-medium">
                  Câu {idx + 1}. {q.question_text}
                </h3>
                <ol className="list-inside list-decimal space-y-1">
                  {q.options.map((o) => (
                    <li key={o.id}>
                      {o.option_text}
                      {o.is_correct && (
                        <span className="ml-2 font-semibold text-emerald-700">· Đáp án đúng</span>
                      )}
                    </li>
                  ))}
                </ol>
              </article>
            ))}

            {role === "manager" && !preview.quiz.is_published && !classDto.is_expired && (
              <ActionForm
                submitLabel="Xác nhận xuất bản"
                onCancel={() => setPreview(null)}
                onSubmit={async () => {
                  await quizzesApi.publish(classDto.id, preview.quiz.id);
                  setPreview(null);
                  setMessage("Đã xuất bản bài kiểm tra cho học viên.");
                  await loadQuizzes();
                }}
              >
                <p className="text-sm text-muted-foreground">
                  Sau khi xuất bản, học viên có thể xem thông tin bài và bắt đầu làm khi tới giờ mở.
                </p>
              </ActionForm>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
