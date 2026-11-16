"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuizDto, QuizQuestionDto } from "@/types/api";
import { formatApiError } from "@/lib/api-client";
import { quizzesApi } from "@/lib/lms-api";
import { fromVietnamDatetimeLocal, toVietnamDatetimeLocal } from "@/lib/date";
import { ActionForm, Field } from "@/components/shared/management-ui";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

interface DraftOption {
  key: string;
  option_text: string;
  is_correct: boolean;
}

interface DraftQuestion {
  key: string;
  question_text: string;
  options: DraftOption[];
}

function emptyQuestion(): DraftQuestion {
  const k1 = crypto.randomUUID();
  const k2 = crypto.randomUUID();
  return {
    key: crypto.randomUUID(),
    question_text: "",
    options: [
      { key: k1, option_text: "", is_correct: true },
      { key: k2, option_text: "", is_correct: false },
    ],
  };
}

function fromServerQuestions(list: QuizQuestionDto[]): DraftQuestion[] {
  if (list.length === 0) return [emptyQuestion()];
  return list.map((q) => ({
    key: String(q.id),
    question_text: q.question_text,
    options: q.options.map((o) => ({
      key: String(o.id),
      option_text: o.option_text,
      is_correct: Boolean(o.is_correct),
    })),
  }));
}

export function QuizBuilder({
  classId,
  quiz,
  onSaved,
  onCancel,
}: {
  classId: number;
  quiz?: QuizDto;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(Boolean(quiz));
  const [definitionLoaded, setDefinitionLoaded] = useState(!quiz);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quizType, setQuizType] = useState<"test" | "assignment">(quiz?.quiz_type ?? "test");
  const [title, setTitle] = useState(quiz?.title ?? "");
  const [description, setDescription] = useState(quiz?.description ?? "");
  const [passScore, setPassScore] = useState(String(quiz?.pass_score ?? 70));
  const [durationMinutes, setDurationMinutes] = useState(
    String(quiz ? Math.max(1, Math.round(quiz.duration_seconds / 60)) : 15),
  );
  const [openAt, setOpenAt] = useState(toVietnamDatetimeLocal(quiz?.open_at));
  const [deadline, setDeadline] = useState(toVietnamDatetimeLocal(quiz?.deadline));
  const [attemptLimit, setAttemptLimit] = useState(
    quiz ? String(quiz.attempt_limit) : "10",
  );
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);

  const quizId = quiz?.id;

  const loadDefinition = useCallback(
    async (signal?: AbortSignal) => {
      if (!quizId) return;
      setLoading(true);
      setLoadError(null);
      setDefinitionLoaded(false);
      try {
        const res = await quizzesApi.get("manager", classId, quizId, signal);
        if (signal?.aborted) return;
        setQuizType(res.quiz.quiz_type);
        setTitle(res.quiz.title);
        setDescription(res.quiz.description ?? "");
        setPassScore(String(res.quiz.pass_score));
        setDurationMinutes(String(Math.max(1, Math.round(res.quiz.duration_seconds / 60))));
        setOpenAt(toVietnamDatetimeLocal(res.quiz.open_at));
        setDeadline(toVietnamDatetimeLocal(res.quiz.deadline));
        setAttemptLimit(String(res.quiz.attempt_limit));
        setQuestions(fromServerQuestions(res.questions ?? []));
        setDefinitionLoaded(true);
      } catch (err) {
        if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        setDefinitionLoaded(false);
        setLoadError(formatApiError(err, "Không thể tải nội dung câu hỏi bài kiểm tra."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [classId, quizId],
  );

  useEffect(() => {
    if (!quizId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void loadDefinition(controller.signal);
      }
    });
    return () => controller.abort();
  }, [quizId, loadDefinition]);

  if (loading) return <LoadingState label="Đang tải câu hỏi bài kiểm tra" />;

  if (loadError || !definitionLoaded) {
    return (
      <div className="space-y-4">
        <ErrorState
          message={loadError ?? "Chưa tải được dữ liệu câu hỏi của bài kiểm tra."}
          onRetry={() => void loadDefinition()}
        />
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Đóng
          </Button>
        </div>
      </div>
    );
  }

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }

  return (
    <ActionForm
      submitLabel={quiz ? "Cập nhật bản nháp" : "Tạo bài kiểm tra"}
      onCancel={onCancel}
      onSubmit={async () => {
        if (!definitionLoaded) {
          throw new Error("Nội dung bài kiểm tra chưa được tải đầy đủ.");
        }
        if (!openAt || !deadline) {
          throw new Error("Vui lòng chọn thời gian mở và hạn nộp.");
        }
        const openIso = fromVietnamDatetimeLocal(openAt);
        const deadlineIso = fromVietnamDatetimeLocal(deadline);
        if (Date.parse(openIso) >= Date.parse(deadlineIso)) {
          throw new Error("Hạn nộp phải sau thời gian mở bài.");
        }
        const minutes = Number(durationMinutes);
        if (!Number.isFinite(minutes) || minutes < 1) {
          throw new Error("Thời gian làm bài phải tối thiểu 1 phút.");
        }
        const pass = Number(passScore);
        if (!Number.isFinite(pass) || pass < 0 || pass > 100) {
          throw new Error("Điểm đạt phải nằm trong khoảng 0 đến 100.");
        }

        const payload = {
          title: title.trim(),
          description: description.trim(),
          quiz_type: quizType,
          duration_seconds: Math.round(minutes * 60),
          open_at: openIso,
          deadline: deadlineIso,
          pass_score: pass,
          attempt_limit:
            quizType === "test" ? 1 : Math.max(1, Number(attemptLimit) || 10),
          questions: questions.map((q) => {
            if (!q.question_text.trim()) {
              throw new Error("Tất cả câu hỏi đều phải có nội dung.");
            }
            if (q.options.length < 2) {
              throw new Error("Mỗi câu hỏi cần ít nhất 2 lựa chọn.");
            }
            const correctCount = q.options.filter((o) => o.is_correct).length;
            if (correctCount !== 1) {
              throw new Error("Mỗi câu hỏi phải có đúng 1 đáp án đúng.");
            }
            return {
              question_text: q.question_text.trim(),
              options: q.options.map((o) => {
                if (!o.option_text.trim()) {
                  throw new Error("Nội dung lựa chọn không được để trống.");
                }
                return {
                  option_text: o.option_text.trim(),
                  is_correct: o.is_correct,
                };
              }),
            };
          }),
        };

        if (quiz) {
          await quizzesApi.update(classId, quiz.id, payload);
        } else {
          await quizzesApi.create(classId, payload);
        }
        await onSaved();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Loại bài *">
          <select
            className="form-control"
            value={quizType}
            onChange={(e) => setQuizType(e.target.value as "test" | "assignment")}
          >
            <option value="test">Test (1 lượt, nộp sau ≥ 2/3 giờ)</option>
            <option value="assignment">Assignment (nhiều lượt, nộp bất kỳ lúc nào)</option>
          </select>
        </Field>
        <Field label="Tên bài *">
          <input
            required
            maxLength={200}
            className="form-control"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Mô tả">
        <textarea
          maxLength={10000}
          className="form-control min-h-20"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Điểm đạt / 100 *">
          <input
            required
            type="number"
            min={0}
            max={100}
            step="any"
            className="form-control"
            value={passScore}
            onChange={(e) => setPassScore(e.target.value)}
          />
        </Field>
        <Field label="Thời gian làm bài (phút) *">
          <input
            required
            type="number"
            min={1}
            step={1}
            className="form-control"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
        </Field>
        <Field label="Mở bài (UTC+7) *">
          <input
            required
            type="datetime-local"
            className="form-control"
            value={openAt}
            onChange={(e) => setOpenAt(e.target.value)}
          />
        </Field>
        <Field label="Hạn nộp (UTC+7) *">
          <input
            required
            type="datetime-local"
            min={openAt}
            className="form-control"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </Field>
      </div>

      {quizType === "test" ? (
        <p className="text-xs text-muted-foreground">
          Bài Test cố định 1 lượt mặc định; cấp thêm lượt sau khi có bài nộp thông qua tính năng Cấp lượt bổ sung.
        </p>
      ) : (
        <Field label="Giới hạn lượt làm (Assignment) *">
          <input
            required
            type="number"
            min={1}
            step={1}
            className="form-control max-w-xs"
            value={attemptLimit}
            onChange={(e) => setAttemptLimit(e.target.value)}
          />
        </Field>
      )}

      <div className="space-y-4">
        {questions.map((q, qIdx) => (
          <fieldset key={q.key} className="space-y-3 rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Câu {qIdx + 1} (Single-choice)</legend>
            <Field label={`Nội dung câu ${qIdx + 1} *`}>
              <textarea
                required
                maxLength={10000}
                className="form-control min-h-20"
                value={q.question_text}
                onChange={(e) => updateQuestion(q.key, { question_text: e.target.value })}
              />
            </Field>

            <div className="space-y-2">
              {q.options.map((o, oIdx) => (
                <div key={o.key} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.key}`}
                    aria-label={`Đáp án đúng câu ${qIdx + 1} lựa chọn ${oIdx + 1}`}
                    checked={o.is_correct}
                    onChange={() =>
                      updateQuestion(q.key, {
                        options: q.options.map((opt) => ({
                          ...opt,
                          is_correct: opt.key === o.key,
                        })),
                      })
                    }
                  />
                  <input
                    required
                    maxLength={10000}
                    className="form-control min-w-0 flex-1"
                    aria-label={`Câu ${qIdx + 1} lựa chọn ${oIdx + 1}`}
                    value={o.option_text}
                    onChange={(e) =>
                      updateQuestion(q.key, {
                        options: q.options.map((opt) =>
                          opt.key === o.key ? { ...opt, option_text: e.target.value } : opt,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={q.options.length <= 2}
                    onClick={() => {
                      const nextOpts = q.options.filter((opt) => opt.key !== o.key);
                      if (nextOpts.length > 0 && !nextOpts.some((opt) => opt.is_correct)) {
                        nextOpts[0].is_correct = true;
                      }
                      updateQuestion(q.key, { options: nextOpts });
                    }}
                  >
                    Xóa
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  updateQuestion(q.key, {
                    options: [
                      ...q.options,
                      { key: crypto.randomUUID(), option_text: "", is_correct: false },
                    ],
                  })
                }
              >
                Thêm lựa chọn
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={questions.length <= 1}
                onClick={() => setQuestions((prev) => prev.filter((item) => item.key !== q.key))}
              >
                Xóa câu {qIdx + 1}
              </Button>
            </div>
          </fieldset>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
        >
          Thêm câu hỏi
        </Button>
      </div>
    </ActionForm>
  );
}
