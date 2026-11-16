"use client";

import { useCallback, useEffect, useState } from "react";
import type { Page, StaffEnrollmentRequest, StaffEnrollmentRow } from "@/types/api";
import { formatApiError } from "@/lib/api-client";
import { enrollmentsApi } from "@/lib/lms-api";
import { formatVietnamDateTime } from "@/lib/date";
import { translateIncompleteReason } from "@/lib/quiz-client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  ActionForm,
  ConfirmAction,
  DataTable,
  Feedback,
  Field,
} from "@/components/shared/management-ui";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";

export function EnrollmentQueue({
  role,
  classId,
  isExpired,
  onChanged,
}: {
  role: "admin" | "manager";
  classId: number;
  isExpired: boolean;
  onChanged?: () => Promise<void> | void;
}) {
  const [reqPage, setReqPage] = useState(1);
  const [rosterPage, setRosterPage] = useState(1);
  const [requests, setRequests] = useState<Page<StaffEnrollmentRequest> | null>(null);
  const [roster, setRoster] = useState<Page<StaffEnrollmentRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState<{
    request: StaffEnrollmentRequest;
    value: "approve" | "decline";
  } | null>(null);

  const loadAll = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const [reqs, members] = await Promise.all([
          enrollmentsApi.staffRequests(role, classId, { page: reqPage, page_size: 20 }, signal),
          enrollmentsApi.staffRoster(role, classId, { page: rosterPage, page_size: 20 }, signal),
        ]);
        setRequests(reqs);
        setRoster(members);
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải danh sách ghi danh."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [role, classId, reqPage, rosterPage],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadAll(controller.signal);
    });
    return () => controller.abort();
  }, [loadAll]);

  if (loading && !requests && !roster) {
    return <LoadingState label="Đang tải ghi danh lớp" />;
  }

  if (error && !requests && !roster) {
    return <ErrorState message={error} onRetry={() => void loadAll()} />;
  }

  return (
    <div className="space-y-8">
      <Feedback message={feedback} />
      {error && <Feedback message={error} error />}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Yêu cầu ghi danh</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {role === "manager"
              ? "Quản lý lớp phê duyệt hoặc từ chối (kèm lý do) cho các yêu cầu chờ duyệt."
              : "Quản trị viên xem lịch sử yêu cầu ghi danh của lớp."}
          </p>
        </div>

        {!requests || requests.items.length === 0 ? (
          <EmptyState
            title="Chưa có yêu cầu ghi danh"
            description="Yêu cầu tham gia lớp từ học viên sẽ hiển thị tại đây."
          />
        ) : (
          <>
            <DataTable
              caption="Danh sách yêu cầu ghi danh"
              columns={["Học viên", "Lý do", "Trạng thái", "Thời gian", "Thao tác"]}
            >
              {requests.items.map((req) => (
                <tr key={req.id}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    <p>{req.full_name}</p>
                    <p className="tabular-nums text-xs font-normal text-muted-foreground">
                      MSSV: {req.student_number} · Req #{req.id}
                    </p>
                  </th>
                  <td className="max-w-72 px-4 py-3 text-sm">
                    <p className="whitespace-pre-wrap">{req.reason}</p>
                    {req.decision_reason && (
                      <p className="mt-1 text-xs text-red-700">Phản hồi: {req.decision_reason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="tabular-nums px-4 py-3 text-xs text-muted-foreground">
                    {formatVietnamDateTime(req.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {role === "manager" && req.status === "pending" && !isExpired ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => setDecision({ request: req, value: "approve" })}
                        >
                          Duyệt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDecision({ request: req, value: "decline" })}
                        >
                          Từ chối
                        </Button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
            <PaginationBar
              page={requests.page}
              pageSize={requests.page_size}
              total={requests.total}
              onPageChange={setReqPage}
            />
          </>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Danh sách chu kỳ ghi danh & tiến độ</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Hiển thị theo mã chu kỳ ghi danh (enrollment_id). Học viên từng bị xóa khỏi lớp và đăng ký lại sẽ có chu kỳ mới.
          </p>
        </div>

        {!roster || roster.items.length === 0 ? (
          <EmptyState
            title="Chưa có học viên trong lớp"
            description="Các chu kỳ ghi danh đã được duyệt sẽ xuất hiện tại đây."
          />
        ) : (
          <>
            <DataTable
              caption="Danh sách học viên và tiến độ trong lớp"
              columns={[
                "Học viên",
                "Chu kỳ",
                "Trạng thái",
                "Điểm danh",
                "Quiz đạt",
                "Hoàn thành",
                "Thao tác",
              ]}
            >
              {roster.items.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    <p>{row.student.full_name}</p>
                    <p className="tabular-nums text-xs font-normal text-muted-foreground">
                      {row.student.student_id ?? "—"} · {row.student.email}
                    </p>
                  </th>
                  <td className="tabular-nums px-4 py-3 text-xs">
                    Chu kỳ #{row.cycle_number}
                    <br />
                    <span className="text-muted-foreground">Enrollment #{row.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                    {row.removal_reason && (
                      <p className="mt-1 max-w-52 text-xs text-red-700">{row.removal_reason}</p>
                    )}
                  </td>
                  <td className="tabular-nums px-4 py-3 text-xs">
                    {row.progress.attendance_count}/{row.progress.total_sessions} (
                    {row.progress.attendance_percent.toFixed(0)}%)
                  </td>
                  <td className="tabular-nums px-4 py-3 text-xs">
                    {row.progress.passed_quiz_count}/{row.progress.published_quiz_count} (
                    {row.progress.quiz_percent.toFixed(0)}%)
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <StatusBadge status={row.progress.completed ? "completed" : "incomplete"} />
                    {row.progress.incomplete_reasons.length > 0 && (
                      <p className="mt-1 max-w-56 text-muted-foreground">
                        {row.progress.incomplete_reasons.map(translateIncompleteReason).join("; ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.status === "enrolled" && !isExpired ? (
                      <ConfirmAction
                        title={`Xóa ${row.student.full_name} khỏi lớp?`}
                        description={`Thao tác xóa chu kỳ #${row.cycle_number} (Enrollment #${row.id}). Tiến độ chu kỳ cũ vẫn được lưu lại lịch sử.`}
                        trigger="Xóa khỏi lớp"
                        onConfirm={async (reason) => {
                          await enrollmentsApi.removeEnrollment(role, classId, row.id, reason);
                          setFeedback(`Đã xóa ${row.student.full_name} (chu kỳ #${row.cycle_number}) khỏi lớp.`);
                          await loadAll();
                          await onChanged?.();
                        }}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
            <PaginationBar
              page={roster.page}
              pageSize={roster.page_size}
              total={roster.total}
              onPageChange={setRosterPage}
            />
          </>
        )}
      </section>

      <Dialog
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        title={
          decision?.value === "approve"
            ? "Phê duyệt yêu cầu ghi danh?"
            : "Từ chối yêu cầu ghi danh?"
        }
        description={
          decision
            ? `${decision.request.full_name} (${decision.request.student_number}) — ${decision.request.reason}`
            : ""
        }
      >
        {decision && (
          <ActionForm
            onCancel={() => setDecision(null)}
            submitLabel={decision.value === "approve" ? "Xác nhận duyệt" : "Xác nhận từ chối"}
            onSubmit={async (formData) => {
              const reason = String(formData.get("reason") ?? "").trim();
              await enrollmentsApi.reviewRequest(classId, decision.request.id, {
                decision: decision.value,
                ...(decision.value === "decline" ? { reason } : {}),
              });
              setFeedback(
                decision.value === "approve"
                  ? `Đã duyệt ghi danh cho ${decision.request.full_name}.`
                  : `Đã từ chối yêu cầu của ${decision.request.full_name}.`,
              );
              setDecision(null);
              await loadAll();
              await onChanged?.();
            }}
          >
            {decision.value === "decline" ? (
              <Field label="Lý do từ chối *">
                <textarea name="reason" required maxLength={1000} className="form-control min-h-24" />
              </Field>
            ) : (
              <p className="text-sm leading-6 text-slate-700">
                Hệ thống sẽ kiểm tra sĩ số lớp và tạo chu kỳ ghi danh mới bắt đầu từ 0% cho học viên.
              </p>
            )}
          </ActionForm>
        )}
      </Dialog>
    </div>
  );
}
