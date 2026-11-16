"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  ClassDto,
  ClassEnrollmentRosterItem,
  DashboardClassSummary,
  RouteRole,
  SessionDto,
} from "@/types/api";
import { ApiError, formatApiError } from "@/lib/api-client";
import { normalizeClassTab } from "@/lib/class-helpers";
import { classesApi, dashboardsApi, enrollmentsApi } from "@/lib/lms-api";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/date";
import { translateIncompleteReason } from "@/lib/quiz-client";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import {
  ActionForm,
  ConfirmAction,
  DataTable,
  Feedback,
  Field,
} from "@/components/shared/management-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ClassForm } from "./class-form";
import { EnrollmentQueue } from "@/features/enrollments/enrollment-queue";
import { LessonWorkspace } from "@/features/lessons/lesson-workspace";
import { LibraryWorkspace } from "@/features/materials/library-workspace";
import { CompletionClassPanel } from "@/features/progress/completion-workspace";
import { TeacherQuizzes } from "@/features/quizzes/teacher-quizzes";
import { StudentQuizzes } from "@/features/quizzes/student-quizzes";

export function ClassDetail({
  role,
  classId,
  initialTab = "overview",
}: {
  role: RouteRole;
  classId: number;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(() => normalizeClassTab(initialTab));
  const [classDto, setClassDto] = useState<ClassDto | null>(null);
  const [previewSessions, setPreviewSessions] = useState<
    Array<Pick<SessionDto, "id" | "session_number" | "title" | "starts_at" | "ends_at">>
  >([]);
  const [isPreview, setIsPreview] = useState(false);
  const [studentHistory, setStudentHistory] = useState<DashboardClassSummary | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<number | null>(null);
  const [roster, setRoster] = useState<ClassEnrollmentRosterItem[]>([]);
  const [rosterSearch, setRosterSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const loadClass = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setIsPreview(false);
      setStudentHistory(null);

      try {
        if (role === "student") {
          const dash = await dashboardsApi.get("student", signal);
          const summary = dash.classes.find((c) => c.class.id === classId) ?? null;
          setStudentHistory(summary);
          const activeCycle = summary?.enrollments.find((e) => e.enrollment.status === "enrolled");
          setEnrollmentId(activeCycle?.enrollment.id ?? null);

          try {
            const detail = await classesApi.get("student", classId, signal);
            setClassDto(detail.class);
            setIsPreview(false);
          } catch (err) {
            if (signal?.aborted) return;
            if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
              if (summary && !activeCycle) {
                // Removed or expired cycle: show summary only without fetching protected content.
                setClassDto(null);
              } else {
                const previewRes = await classesApi.studentPreview(classId, signal);
                setClassDto(previewRes.class);
                setPreviewSessions(previewRes.upcoming_sessions);
                setIsPreview(true);
              }
            } else {
              throw err;
            }
          }
        } else {
          const [detail, rosterList] = await Promise.all([
            classesApi.get(role, classId, signal),
            enrollmentsApi.listAllRoster(role, classId, signal),
          ]);
          setClassDto(detail.class);
          setRoster(rosterList);
        }
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải thông tin lớp học."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [role, classId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadClass(controller.signal);
    });
    return () => controller.abort();
  }, [loadClass]);

  const backButton = (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/${role}/classes`}>Về danh sách lớp</Link>
    </Button>
  );

  if (loading && !classDto && !studentHistory) {
    return <LoadingState label="Đang tải thông tin lớp học" />;
  }

  if (error && !classDto && !studentHistory) {
    return (
      <div className="space-y-4">
        {backButton}
        <ErrorState message={error} onRetry={() => void loadClass()} />
      </div>
    );
  }

  // Student with only removed/expired enrollment history and no active access
  if (role === "student" && !classDto && studentHistory) {
    return (
      <div className="dashboard-page space-y-6">
        {backButton}
        <PageHeader
          title={`${studentHistory.class.code} · ${studentHistory.class.name}`}
          description={`Ngày kết thúc: ${formatVietnamDate(studentHistory.class.end_date)}`}
        />
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Tóm tắt lịch sử ghi danh</h2>
          <p className="text-sm text-muted-foreground">
            Bạn không còn quyền truy cập nội dung học tập hiện hành của lớp này. Dưới đây là tóm tắt các lần ghi danh trước đó.
          </p>
          <div className="space-y-3">
            {studentHistory.enrollments.map(({ enrollment, progress }) => (
              <div key={enrollment.id} className="space-y-2 rounded-xl border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    Chu kỳ #{enrollment.cycle_number} (ID #{enrollment.id})
                  </span>
                  <StatusBadge status={enrollment.status} />
                </div>
                {enrollment.removal_reason && (
                  <p className="text-xs text-red-700">Lý do: {enrollment.removal_reason}</p>
                )}
                <p className="tabular-nums">
                  Chuyên cần: {progress.attendance_count}/{progress.total_sessions} (
                  {Math.round(progress.attendance_percent * 10) / 10}%) · Quiz:{" "}
                  {progress.passed_quiz_count}/{progress.published_quiz_count} (
                  {Math.round(progress.quiz_percent * 10) / 10}%)
                </p>
                {progress.incomplete_reasons.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {progress.incomplete_reasons.map(translateIncompleteReason).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!classDto) {
    return (
      <div className="space-y-4">
        {backButton}
        <EmptyState
          title="Không tìm thấy lớp học"
          description="Lớp không tồn tại hoặc bạn không có quyền truy cập."
        />
      </div>
    );
  }

  const tabs: Array<[string, string]> = isPreview
    ? [["overview", "Giới thiệu lớp"]]
    : [
        ["overview", "Tổng quan"],
        ...(role !== "student" ? ([["students", "Học viên"]] as [string, string][]) : []),
        ["progress", "Tiến độ"],
        ["lessons", "Buổi học & Điểm danh"],
        ["quizzes", "Quiz"],
        ...(role === "manager"
          ? ([["requests", "Duyệt ghi danh"]] as [string, string][])
          : []),
        ["materials", "Tài liệu"],
      ];
  const activeTab = isPreview
    ? "overview"
    : tabs.some(([id]) => id === tab)
      ? tab
      : "overview";

  const enrolledRoster = roster.filter(
    (item) =>
      item.status === "enrolled" &&
      `${item.student.full_name} ${item.student.email} ${item.student.student_id ?? ""}`
        .toLocaleLowerCase("vi")
        .includes(rosterSearch.trim().toLocaleLowerCase("vi")),
  );

  return (
    <div className="dashboard-page management-content space-y-6">
      {backButton}

      <PageHeader
        title={`${classDto.code}${isPreview ? " (Xem trước)" : ""} · ${classDto.name}`}
        description={`Quản lý lớp: ${classDto.manager?.full_name ?? `#${classDto.manager_id}`}`}
        actions={
          role === "admin" && !classDto.is_expired ? (
            <Button size="sm" onClick={() => setEditOpen(true)}>
              Chỉnh sửa lớp
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={classDto.is_expired ? "expired" : "active"} />
        <span className="tabular-nums text-sm text-muted-foreground">
          {classDto.enrolled_count}/{classDto.capacity} học viên · Kết thúc{" "}
          {formatVietnamDate(classDto.end_date)} · Hết hạn{" "}
          {formatVietnamDateTime(classDto.expires_at)} (UTC+7)
        </span>
      </div>

      <Feedback message={message} />
      {error && <Feedback message={error} error />}

      <nav aria-label="Nội dung lớp học" className="flex flex-wrap gap-2 border-b border-border pb-4">
        {tabs.map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={activeTab === id ? "default" : "outline"}
            aria-pressed={activeTab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="text-xl font-semibold">Thông tin lớp học</h2>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {classDto.description || "Chưa có mô tả chi tiết."}
            </p>
            <div className="tabular-nums space-y-1 text-sm leading-6">
              <p>
                <strong>Số buổi học:</strong>{" "}
                {classDto.total_sessions !== null
                  ? `${classDto.total_sessions} buổi cố định`
                  : "Chưa thiết lập (Quản lý lớp thiết lập 1 lần)"}
              </p>
              <p>
                <strong>Ngưỡng hoàn thành:</strong> Chuyên cần ≥{" "}
                {classDto.min_attendance_percent}% và Quiz ≥ {classDto.min_quiz_percent}%
              </p>
            </div>
          </Card>

          {isPreview && (
            <>
              <Card className="space-y-4 p-5">
                <h3 className="text-lg font-semibold">Lịch học sắp tới đã duyệt</h3>
                {previewSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Chưa có buổi học sắp tới được phê duyệt lịch.
                  </p>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {previewSessions.map((s) => (
                      <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                        <span className="font-medium">
                          Buổi {s.session_number}: {s.title}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatVietnamDateTime(s.starts_at)} – {formatVietnamDateTime(s.ends_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="space-y-4 p-5">
                <h3 className="text-lg font-semibold">Đăng ký tham gia lớp</h3>
                {classDto.enrolled_count >= classDto.capacity ? (
                  <p className="text-sm font-medium text-amber-800">
                    Lớp đã đủ sĩ số ({classDto.enrolled_count}/{classDto.capacity}). Không thể gửi yêu cầu mới.
                  </p>
                ) : (
                  <ActionForm
                    submitLabel="Gửi yêu cầu tham gia"
                    onSubmit={async (formData) => {
                      const reason = String(formData.get("reason") ?? "").trim();
                      await enrollmentsApi.studentRequest(classDto.id, reason);
                      setMessage("Đã gửi yêu cầu tham gia lớp cho Quản lý lớp.");
                    }}
                  >
                    <Field label="Lý do muốn tham gia lớp *">
                      <textarea
                        name="reason"
                        required
                        maxLength={2000}
                        className="form-control min-h-24"
                        placeholder="Nêu mục tiêu học tập hoặc nhu cầu tham gia lớp…"
                      />
                    </Field>
                  </ActionForm>
                )}
              </Card>
            </>
          )}

          {role === "manager" && classDto.total_sessions === null && !classDto.is_expired && (
            <Card className="space-y-4 p-5">
              <h3 className="text-lg font-semibold">Thiết lập tổng số buổi cố định</h3>
              <p className="text-sm text-muted-foreground">
                Tổng số buổi chỉ được thiết lập một lần duy nhất trước khi tạo buổi học và đề xuất lịch.
              </p>
              <ActionForm
                submitLabel="Xác nhận tổng số buổi"
                onSubmit={async (formData) => {
                  const total = Number(formData.get("total_sessions"));
                  await classesApi.setTotalSessions(classDto.id, total);
                  setMessage(`Đã cố định tổng số buổi của lớp là ${total} buổi.`);
                  await loadClass();
                }}
              >
                <Field label="Tổng số buổi (1 - 10000) *">
                  <input
                    name="total_sessions"
                    type="number"
                    required
                    min={1}
                    max={10000}
                    step={1}
                    className="form-control max-w-xs"
                  />
                </Field>
              </ActionForm>
            </Card>
          )}
        </div>
      )}

      {!isPreview && activeTab === "students" && role !== "student" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-xl font-semibold">
              Danh sách học viên đang theo học ({enrolledRoster.length})
            </h2>
            <Field label="Lọc học viên">
              <input
                type="search"
                className="form-control sm:w-64"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Tên, email hoặc MSSV…"
              />
            </Field>
          </div>

          {enrolledRoster.length === 0 ? (
            <Card>
              <EmptyState
                title="Chưa có học viên nào"
                description="Học viên sẽ xuất hiện sau khi Quản lý lớp duyệt yêu cầu ghi danh."
              />
            </Card>
          ) : (
            <DataTable
              caption="Danh sách học viên đang theo học"
              columns={["Học viên", "Mã ghi danh", "Chuyên cần", "Quiz", "Thao tác"]}
            >
              {enrolledRoster.map((item) => (
                <tr key={item.id}>
                  <th scope="row" className="px-4 py-4 font-medium">
                    {item.student.full_name}
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      {item.student.email}
                      {item.student.student_id ? ` · ${item.student.student_id}` : ""}
                    </p>
                  </th>
                  <td className="tabular-nums px-4 py-4 text-sm">
                    #{item.id} (chu kỳ {item.cycle_number})
                  </td>
                  <td className="tabular-nums px-4 py-4 text-sm">
                    {Math.round(item.progress.attendance_percent * 10) / 10}%
                  </td>
                  <td className="tabular-nums px-4 py-4 text-sm">
                    {Math.round(item.progress.quiz_percent * 10) / 10}%
                  </td>
                  <td className="px-4 py-4">
                    {classDto.is_expired ? (
                      <span className="text-xs text-muted-foreground">Lớp đã hết hạn</span>
                    ) : (
                      <ConfirmAction
                        title={`Gỡ ${item.student.full_name} khỏi lớp?`}
                        trigger="Gỡ khỏi lớp"
                        description="Học viên mất quyền truy cập nội dung lớp hiện hành nhưng lịch sử tiến độ vẫn được lưu."
                        onConfirm={async (reason) => {
                          await enrollmentsApi.removeStudent(role, classDto.id, item.id, reason);
                          setMessage(`Đã gỡ ${item.student.full_name} (ghi danh #${item.id}).`);
                          await loadClass();
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      )}

      {!isPreview && activeTab === "progress" && (
        <CompletionClassPanel role={role} classDto={classDto} />
      )}

      {!isPreview && activeTab === "lessons" && (
        <LessonWorkspace role={role} classDto={classDto} enrollmentId={enrollmentId} />
      )}

      {!isPreview && activeTab === "quizzes" &&
        (role === "student" ? (
          <StudentQuizzes classId={classDto.id} enrollmentId={enrollmentId} />
        ) : (
          <TeacherQuizzes role={role} classDto={classDto} />
        ))}

      {!isPreview && activeTab === "requests" && role === "manager" && (
        <EnrollmentQueue
          role={role}
          classId={classDto.id}
          isExpired={classDto.is_expired}
          onChanged={loadClass}
        />
      )}

      {!isPreview && activeTab === "materials" && (
        <LibraryWorkspace role={role} classId={classDto.id} isExpired={classDto.is_expired} />
      )}

      {role === "admin" && !classDto.is_expired && (
        <Dialog
          open={editOpen}
          onOpenChange={setEditOpen}
          title="Chỉnh sửa lớp học"
          description="Thay đổi quản lý lớp yêu cầu xác nhận và nhập lý do rõ ràng."
        >
          <ClassForm
            key={classDto.id}
            course={classDto}
            onCancel={() => setEditOpen(false)}
            onSaved={async () => {
              setEditOpen(false);
              setMessage("Đã cập nhật thông tin lớp học.");
              await loadClass();
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
