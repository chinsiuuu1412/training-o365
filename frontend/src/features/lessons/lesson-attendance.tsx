"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AbsenceDto,
  AttendanceDto,
  AuditLogDto,
  ClassEnrollmentRosterItem,
  RouteRole,
  SessionDto,
} from "@/types/api";
import { ApiError, fetchAllPages, formatApiError, getServerNowMs } from "@/lib/api-client";
import { attendanceApi, enrollmentsApi } from "@/lib/lms-api";
import { formatVietnamDateTime } from "@/lib/date";
import {
  ActionForm,
  ConfirmAction,
  DataTable,
  Feedback,
  Field,
} from "@/components/shared/management-ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";

export function LessonAttendance({
  role,
  classId,
  session,
  enrollmentId,
  isExpired,
}: {
  role: RouteRole;
  classId: number;
  session: SessionDto;
  enrollmentId?: number | null;
  isExpired?: boolean;
}) {
  const [attendance, setAttendance] = useState<AttendanceDto[]>([]);
  const [absences, setAbsences] = useState<AbsenceDto[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogDto[]>([]);
  const [roster, setRoster] = useState<ClassEnrollmentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        if (role === "student") {
          const allAtt = await fetchAllPages<AttendanceDto>(
            (p, ps) => attendanceApi.listAttendance("student", classId, { page: p, page_size: ps }, signal),
          );
          setAttendance(allAtt);
        } else {
          const [allAtt, allAbs, allAudit, allRoster] = await Promise.all([
            fetchAllPages<AttendanceDto>((p, ps) =>
              attendanceApi.listAttendance(role, classId, { page: p, page_size: ps }, signal),
            ),
            fetchAllPages<AbsenceDto>((p, ps) =>
              attendanceApi.listAbsences(role, classId, { page: p, page_size: ps }, signal),
            ),
            fetchAllPages<AuditLogDto>((p, ps) =>
              attendanceApi.listAudit(role, classId, { page: p, page_size: ps }, signal),
            ),
            enrollmentsApi.listAllRoster(role, classId, signal),
          ]);
          setAttendance(allAtt);
          setAbsences(allAbs);
          setAuditLogs(allAudit);
          setRoster(allRoster.filter((r) => r.status === "enrolled"));
        }
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải dữ liệu điểm danh."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [role, classId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadData(controller.signal);
    });
    return () => controller.abort();
  }, [loadData]);

  if (loading) return <LoadingState label="Đang tải trạng thái điểm danh" />;

  const sessionAttendance = attendance.filter((a) => a.session_id === session.id);
  const sessionAbsences = absences.filter((a) => a.session_id === session.id);
  const nowMs = getServerNowMs();
  const isApproved = Boolean(session.approved_proposal_id && session.starts_at && session.ends_at);
  const startMs = session.starts_at ? Date.parse(session.starts_at) : 0;
  const endMs = session.ends_at ? Date.parse(session.ends_at) : 0;
  const isOpenWindow = isApproved && nowMs >= startMs && nowMs < endMs;
  const hasStarted = isApproved && nowMs >= startMs;
  const beforeEnd = isApproved && nowMs < endMs;

  if (role === "student") {
    const mine = sessionAttendance.find((a) => !enrollmentId || a.enrollment_id === enrollmentId);
    const attended = mine?.attended === 1;
    const locked = (mine?.wrong_count ?? 0) >= 3 && !attended;

    return (
      <Card className="space-y-4 p-5">
        <h3 className="text-lg font-semibold">Điểm danh buổi {session.session_number}</h3>
        <Feedback message={message} />
        {error && <Feedback message={error} error />}
        {remainingAttempts !== null && (
          <p className="text-sm font-medium text-amber-800">
            Còn {remainingAttempts} lần thử mã điểm danh cho buổi này.
          </p>
        )}

        {attended ? (
          <Feedback message="Bạn đã được ghi nhận có mặt ở buổi học này." />
        ) : !enrollmentId ? (
          <p className="text-sm text-muted-foreground">
            Không xác định được mã ghi danh hiện hành để thực hiện điểm danh.
          </p>
        ) : (
          <div className="space-y-4">
            {isOpenWindow && !locked && !isExpired ? (
              <ActionForm
                submitLabel="Xác nhận điểm danh"
                onSubmit={async () => {
                  setError(null);
                  setMessage("");
                  try {
                    const res = await attendanceApi.attend(classId, session.id, {
                      enrollment_id: enrollmentId,
                      code: code.trim(),
                    });
                    setCode("");
                    setRemainingAttempts(null);
                    setMessage(
                      res.authoritative_override
                        ? "Trạng thái điểm danh đang được áp dụng theo điều chỉnh của Quản lý lớp."
                        : "Đã điểm danh thành công.",
                    );
                    await loadData();
                  } catch (err) {
                    if (err instanceof ApiError && err.code === "wrong_attendance_code") {
                      const rem =
                        typeof err.details?.remaining_attempts === "number"
                          ? err.details.remaining_attempts
                          : null;
                      setRemainingAttempts(rem);
                    }
                    await loadData();
                    throw err;
                  }
                }}
              >
                <Field
                  label="Mã điểm danh *"
                  hint="Tối đa 3 lần nhập sai. Mỗi lần sai được hệ thống ghi nhận bền vững."
                >
                  <input
                    required
                    type="text"
                    autoComplete="off"
                    className="form-control max-w-sm"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </Field>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted-foreground">
                {locked
                  ? "Bạn đã nhập sai mã 3 lần. Liên hệ Quản lý lớp để được xác minh và điều chỉnh thủ công."
                  : "Điểm danh chỉ mở trong khung giờ diễn ra buổi học đã duyệt."}
              </p>
            )}

            {beforeEnd && !isExpired && (
              <div className="border-t border-border pt-4">
                <ConfirmAction
                  title={`Xin nghỉ buổi ${session.session_number}?`}
                  trigger="Xin nghỉ buổi học"
                  description="Yêu cầu nghỉ được tự động duyệt và gửi cho Quản lý lớp. Buổi học này không được tính điểm danh (không có credit chuyên cần)."
                  onConfirm={async (reason) => {
                    await attendanceApi.absence(classId, session.id, {
                      enrollment_id: enrollmentId,
                      reason,
                    });
                    setMessage("Đã gửi lý do xin nghỉ (tự động duyệt, không tính chuyên cần).");
                    await loadData();
                  }}
                />
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Danh sách điểm danh buổi {session.session_number}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {role === "manager"
                ? "Quản lý lớp có thể điều chỉnh Có mặt / Vắng mặt sau khi buổi học bắt đầu (kèm lý do)."
                : "Quản trị viên xem dữ liệu điểm danh và nhật ký điều chỉnh (chỉ đọc)."}
            </p>
          </div>
          {session.attendance_code && (
            <p className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-900">
              Mã điểm danh:{" "}
              <strong className="font-mono tracking-wider">{session.attendance_code}</strong>
            </p>
          )}
        </div>

        <Feedback message={message} />
        {error && <Feedback message={error} error />}

        {roster.length === 0 ? (
          <p className="text-sm text-muted-foreground">Lớp chưa có học viên đang theo học.</p>
        ) : (
          <DataTable
            caption="Điểm danh theo lần ghi danh"
            columns={["Học viên", "Trạng thái", "Sai mã", "Thao tác"]}
          >
            {roster.map((item) => {
              const att = sessionAttendance.find((a) => a.enrollment_id === item.id);
              const abs = sessionAbsences.find((a) => a.enrollment_id === item.id);
              const attended = att?.attended === 1;
              const wrongCount = att?.wrong_count ?? 0;

              return (
                <tr key={item.id}>
                  <th scope="row" className="px-4 py-4 font-medium">
                    {item.student.full_name}
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      {item.student.email} · Ghi danh #{item.id} (lần {item.cycle_number})
                    </p>
                  </th>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        status={attended ? "attended" : abs ? "absent" : "pending"}
                        label={attended ? "Có mặt" : abs ? "Xin nghỉ" : "Chưa điểm danh"}
                      />
                      {att?.overridden === 1 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          Đã điều chỉnh
                        </span>
                      )}
                    </div>
                    {abs && (
                      <p className="mt-1 text-xs text-muted-foreground">Lý do nghỉ: {abs.reason}</p>
                    )}
                  </td>
                  <td className="tabular-nums px-4 py-4 text-sm">{wrongCount}/3</td>
                  <td className="px-4 py-4">
                    {role === "manager" && hasStarted && !isExpired ? (
                      <div className="flex flex-wrap gap-2">
                        {!attended && (
                          <ConfirmAction
                            title={`Ghi nhận Có mặt cho ${item.student.full_name}?`}
                            trigger="Đánh dấu có mặt"
                            description="Ghi nhận điều chỉnh điểm danh thủ công vào nhật ký kiểm toán."
                            onConfirm={async (reason) => {
                              await attendanceApi.override(classId, session.id, item.id, {
                                attended: true,
                                reason,
                              });
                              setMessage(`Đã ghi nhận có mặt cho ${item.student.full_name}.`);
                              await loadData();
                            }}
                          />
                        )}
                        {attended && (
                          <ConfirmAction
                            title={`Ghi nhận Vắng mặt cho ${item.student.full_name}?`}
                            trigger="Đánh dấu vắng"
                            description="Điều chỉnh trạng thái sang vắng mặt và thông báo cho học viên."
                            onConfirm={async (reason) => {
                              await attendanceApi.override(classId, session.id, item.id, {
                                attended: false,
                                reason,
                              });
                              setMessage(`Đã chuyển ${item.student.full_name} sang vắng mặt.`);
                              await loadData();
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {role === "admin"
                          ? "Chỉ đọc"
                          : !hasStarted
                            ? "Chưa tới giờ bắt đầu"
                            : "Lớp đã hết hạn"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      {auditLogs.length > 0 && (
        <Card className="space-y-3 p-5">
          <h4 className="text-sm font-semibold">Nhật ký điều chỉnh gần đây (lớp #{classId})</h4>
          <ul className="divide-y divide-border text-xs">
            {auditLogs.slice(0, 10).map((log) => (
              <li key={log.id} className="py-2.5">
                <p className="font-medium">
                  {log.action} · Đối tượng #{log.target_id} ·{" "}
                  <span className="tabular-nums text-muted-foreground">
                    {formatVietnamDateTime(log.created_at)}
                  </span>
                </p>
                {log.reason && <p className="mt-1 text-muted-foreground">Lý do: {log.reason}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
