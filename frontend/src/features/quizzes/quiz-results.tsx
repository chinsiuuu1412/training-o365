"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type {
  ClassEnrollmentRosterItem,
  Page,
  QuizAttemptResultDto,
  QuizDto,
} from "@/types/api";
import { formatApiError } from "@/lib/api-client";
import { enrollmentsApi, quizzesApi } from "@/lib/lms-api";
import {
  fromVietnamDatetimeLocal,
  formatVietnamDateTime,
  toVietnamDatetimeLocal,
} from "@/lib/date";
import {
  ActionForm,
  DataTable,
  Feedback,
  Field,
} from "@/components/shared/management-ui";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function QuizResults({
  role,
  classId,
  quiz,
  isExpired = false,
}: {
  role: "admin" | "manager";
  classId: number;
  quiz: QuizDto;
  isExpired?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<QuizAttemptResultDto> | null>(null);
  const [roster, setRoster] = useState<ClassEnrollmentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [grantTargets, setGrantTargets] = useState<number[] | null>(null);

  const loadResults = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const [attemptsPage, rosterList] = await Promise.all([
          quizzesApi.listAttempts(role, classId, quiz.id, { page, page_size: 20 }, signal),
          enrollmentsApi.listAllRoster(role, classId, signal),
        ]);
        setData(attemptsPage);
        setRoster(rosterList);
        setLastUpdated(new Date());
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải kết quả làm bài."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [role, classId, quiz.id, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadResults(controller.signal);
    });
    const timer = window.setInterval(() => {
      void loadResults();
    }, 180_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadResults]);

  const rosterByEnrollmentId = new Map(roster.map((item) => [item.id, item]));
  const activeEnrollmentIds = roster.filter((r) => r.status === "enrolled").map((r) => r.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Danh sách lượt làm bài</h3>
          {lastUpdated && (
            <p className="tabular-nums text-xs text-muted-foreground">
              Tự làm mới mỗi 3 phút · Cập nhật lúc{" "}
              {formatVietnamDateTime(lastUpdated.toISOString())}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadResults()}>
            <RefreshCw size={14} />
            Làm mới
          </Button>
          {role === "manager" && !isExpired && quiz.is_published && activeEnrollmentIds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGrantTargets(activeEnrollmentIds)}
            >
              Cấp lượt cho cả lớp ({activeEnrollmentIds.length})
            </Button>
          )}
        </div>
      </div>

      <Feedback message={message} />
      {error && data && <Feedback message={error} error />}

      {loading && !data ? (
        <LoadingState label="Đang tải kết quả làm bài" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => void loadResults()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="Chưa có lượt làm bài nào"
          description="Các lượt làm bài của học viên sẽ hiển thị tại đây."
        />
      ) : (
        <>
          <DataTable
            caption={`Lượt làm bài · ${quiz.title}`}
            columns={["Học viên / Ghi danh", "Lượt", "Trạng thái", "Điểm số", "Thời gian nộp", "Thao tác"]}
          >
            {data.items.map(({ attempt }) => {
              const info = rosterByEnrollmentId.get(attempt.enrollment_id);
              const isEnrolled = info?.status === "enrolled";
              return (
                <tr key={attempt.id}>
                  <th scope="row" className="px-4 py-4 font-medium">
                    {info?.student.full_name ?? `Học viên #${attempt.student_id}`}
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      {info?.student.email ?? ""} · Ghi danh #{attempt.enrollment_id}
                    </p>
                  </th>
                  <td className="tabular-nums px-4 py-4 text-sm">Lượt #{attempt.attempt_number}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={attempt.status} />
                  </td>
                  <td className="tabular-nums px-4 py-4 text-sm">
                    {attempt.status === "submitted" && attempt.score_percent !== null ? (
                      <span>
                        {Math.round(attempt.score_percent * 10) / 10}% ({attempt.score ?? 0}/
                        {attempt.max_score ?? 0}) ·{" "}
                        <strong className={attempt.is_passed ? "text-emerald-700" : "text-red-700"}>
                          {attempt.is_passed ? "Đạt" : "Chưa đạt"}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Đang làm bài</span>
                    )}
                  </td>
                  <td className="tabular-nums px-4 py-4 text-xs text-muted-foreground">
                    {attempt.submitted_at
                      ? formatVietnamDateTime(attempt.submitted_at)
                      : `Cắt lúc ${formatVietnamDateTime(attempt.effective_cutoff_at)}`}
                  </td>
                  <td className="px-4 py-4">
                    {role === "manager" && !isExpired && quiz.is_published && isEnrolled && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setGrantTargets([attempt.enrollment_id])}
                      >
                        Gia hạn / Thêm lượt
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>

          <PaginationBar
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={grantTargets !== null}
        onOpenChange={(open) => {
          if (!open) setGrantTargets(null);
        }}
        title={
          grantTargets && grantTargets.length > 1
            ? `Cấp thêm lượt cho ${grantTargets.length} lượt ghi danh`
            : "Gia hạn & cấp thêm lượt làm bài"
        }
        description="Hạn nộp mới bắt buộc phải lớn hơn hạn hiệu lực hiện tại của từng học viên và ở tương lai."
      >
        {grantTargets && (
          <ActionForm
            submitLabel="Xác nhận cấp lượt"
            onCancel={() => setGrantTargets(null)}
            onSubmit={async (formData) => {
              const deadlineLocal = String(formData.get("deadline") ?? "");
              const extraAttempts = Number(formData.get("extra_attempts") ?? 1);
              const reason = String(formData.get("reason") ?? "").trim();
              if (!deadlineLocal) throw new Error("Vui lòng chọn hạn nộp mới.");
              await quizzesApi.grantAttempts(classId, quiz.id, {
                enrollment_ids: grantTargets,
                deadline: fromVietnamDatetimeLocal(deadlineLocal),
                extra_attempts: extraAttempts,
                reason,
              });
              setMessage(
                `Đã cấp thêm ${extraAttempts} lượt và gia hạn cho ${grantTargets.length} lượt ghi danh.`,
              );
              setGrantTargets(null);
              await loadResults();
            }}
          >
            <Field
              label="Số lượt bổ sung *"
              hint={
                quiz.quiz_type === "assignment"
                  ? "Assignment cho phép tối đa 10 lượt mỗi lần cấp."
                  : "Mặc định 1 lượt bổ sung."
              }
            >
              <input
                name="extra_attempts"
                type="number"
                required
                min={1}
                max={quiz.quiz_type === "assignment" ? 10 : undefined}
                step={1}
                defaultValue={1}
                className="form-control max-w-xs"
              />
            </Field>
            <Field label="Hạn nộp mới (UTC+7) *">
              <input
                name="deadline"
                type="datetime-local"
                required
                defaultValue={toVietnamDatetimeLocal(quiz.deadline)}
                className="form-control"
              />
            </Field>
            <Field label="Lý do cấp thêm lượt *">
              <textarea
                name="reason"
                required
                maxLength={2000}
                className="form-control min-h-24"
                placeholder="Ghi rõ lý do để thông báo cho học viên và Admin…"
              />
            </Field>
          </ActionForm>
        )}
      </Dialog>
    </div>
  );
}
