"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Eye, Plus, Search, Send } from "lucide-react";
import type {
  ClassDto,
  DiscoverClassDto,
  EnrollmentHistoryItem,
  EnrollmentRequest,
  Page,
  PreviewUpcomingSession,
  RouteRole,
} from "@/types/api";
import { formatApiError } from "@/lib/api-client";
import { classesApi, enrollmentsApi } from "@/lib/lms-api";
import { formatVietnamDateOnly, formatVietnamDateTime } from "@/lib/date";
import { translateIncompleteReason } from "@/lib/quiz-client";
import { ClassCard } from "@/components/shared/class-card";
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
import { PaginationBar } from "@/components/shared/pagination-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ClassForm } from "./class-form";

type StudentTab = "enrolled" | "discover" | "requests";

export function ClassesList({ role }: { role: RouteRole }) {
  const [studentTab, setStudentTab] = useState<StudentTab>("enrolled");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [staffClasses, setStaffClasses] = useState<Page<ClassDto> | null>(null);
  const [discoverClasses, setDiscoverClasses] = useState<Page<DiscoverClassDto> | null>(null);
  const [studentRequests, setStudentRequests] = useState<Page<EnrollmentRequest> | null>(null);
  const [studentHistory, setStudentHistory] = useState<Page<EnrollmentHistoryItem> | null>(null);
  const [reqPage, setReqPage] = useState(1);
  const [histPage, setHistPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [editing, setEditing] = useState<ClassDto | "new" | null>(null);
  const [previewData, setPreviewData] = useState<{
    class: ClassDto;
    upcoming_sessions: PreviewUpcomingSession[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [requestTarget, setRequestTarget] = useState<DiscoverClassDto | null>(null);

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        if (role !== "student" || studentTab === "enrolled") {
          const res = await classesApi.list(role, { search: search || undefined, page, page_size: 12 }, signal);
          setStaffClasses(res);
        } else if (studentTab === "discover") {
          const [disc, reqs] = await Promise.all([
            classesApi.discover({ search: search || undefined, page, page_size: 12 }, signal),
            enrollmentsApi.studentAllRequests(signal),
          ]);
          setDiscoverClasses(disc);
          setStudentRequests({ items: reqs, page: 1, page_size: reqs.length || 20, total: reqs.length });
        } else {
          const [reqs, hist] = await Promise.all([
            enrollmentsApi.studentRequests({ page: reqPage, page_size: 20 }, signal),
            enrollmentsApi.studentHistory({ page: histPage, page_size: 20 }, signal),
          ]);
          setStudentRequests(reqs);
          setStudentHistory(hist);
        }
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải danh sách lớp học."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [role, studentTab, search, page, reqPage, histPage],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadData(controller.signal);
    });
    return () => controller.abort();
  }, [loadData]);

  async function openPreview(classId: number) {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await classesApi.preview(classId);
      setPreviewData(res);
    } catch (err) {
      setError(formatApiError(err, "Không thể tải thông tin xem trước lớp."));
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="dashboard-page management-content space-y-6">
      <PageHeader
        title={role === "manager" ? "Lớp phụ trách" : "Lớp học"}
        description={
          role === "student"
            ? "Quản lý các lớp đang theo học, khám phá lớp mở ghi danh và theo dõi lịch sử đăng ký."
            : "Quản lý danh sách lớp học, phân công quản lý lớp và tiến độ từng lớp."
        }
        actions={
          role === "admin" ? (
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} />
              Tạo lớp học
            </Button>
          ) : undefined
        }
      />

      <Feedback message={message} />
      {error && <Feedback message={error} error />}

      {role === "student" && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Phân loại lớp học">
          <Button
            variant={studentTab === "enrolled" ? "default" : "outline"}
            onClick={() => {
              setStudentTab("enrolled");
              setPage(1);
            }}
          >
            Lớp đang theo học
          </Button>
          <Button
            variant={studentTab === "discover" ? "default" : "outline"}
            onClick={() => {
              setStudentTab("discover");
              setPage(1);
            }}
          >
            Tìm lớp học
          </Button>
          <Button
            variant={studentTab === "requests" ? "default" : "outline"}
            onClick={() => setStudentTab("requests")}
          >
            Yêu cầu & Lịch sử ghi danh
          </Button>
        </div>
      )}

      {(role !== "student" || studentTab !== "requests") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="Tìm theo tên hoặc mã lớp">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
              <input
                className="form-control pl-9 sm:w-72"
                placeholder="Ví dụ: O365, Excel…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </Field>
          <Button type="submit" variant="outline">
            Tìm kiếm
          </Button>
        </form>
      )}

      {loading ? (
        <LoadingState label="Đang tải dữ liệu lớp học" />
      ) : error && !staffClasses && !discoverClasses && !studentRequests ? (
        <ErrorState message={error} onRetry={() => void loadData()} />
      ) : role !== "student" || studentTab === "enrolled" ? (
        !staffClasses || staffClasses.items.length === 0 ? (
          <EmptyState
            title="Chưa có lớp học"
            description={
              role === "student"
                ? "Bạn chưa có lớp đang theo học. Hãy mở mục Tìm lớp học để gửi yêu cầu tham gia."
                : "Chưa có lớp nào phù hợp điều kiện tìm kiếm."
            }
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {staffClasses.items.map((course) => (
                <ClassCard
                  key={course.id}
                  course={course}
                  registered={role === "student"}
                  href={
                    role === "student" && course.is_expired
                      ? undefined
                      : `/${role}/classes/${course.id}`
                  }
                  actions={
                    role === "admin" && !course.is_expired ? (
                      <Button variant="outline" size="sm" onClick={() => setEditing(course)}>
                        Sửa lớp {course.code}
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </div>
            <PaginationBar
              page={staffClasses.page}
              pageSize={staffClasses.page_size}
              total={staffClasses.total}
              onPageChange={setPage}
            />
          </>
        )
      ) : studentTab === "discover" ? (
        !discoverClasses || discoverClasses.items.length === 0 ? (
          <EmptyState
            title="Chưa có lớp đang mở"
            description="Hiện không có lớp nào còn hạn phù hợp từ khóa tìm kiếm."
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {discoverClasses.items.map((course) => {
                const isFull = course.enrolled_count >= course.capacity;
                const pendingReq = studentRequests?.items.find(
                  (r) => r.class_id === course.id && r.status === "pending",
                );
                return (
                  <ClassCard
                    key={course.id}
                    course={course}
                    registered={course.is_enrolled}
                    href={course.is_enrolled ? `/student/classes/${course.id}` : undefined}
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={previewLoading}
                          onClick={() => void openPreview(course.id)}
                        >
                          <Eye size={14} />
                          Xem trước
                        </Button>
                        {course.is_enrolled ? (
                          <StatusBadge status="enrolled" />
                        ) : pendingReq ? (
                          <ConfirmAction
                            title={`Hủy yêu cầu vào lớp ${course.code}?`}
                            description="Bạn có thể gửi lại yêu cầu khác sau khi hủy."
                            trigger="Đang chờ duyệt · Hủy yêu cầu"
                            needsReason={false}
                            onConfirm={async () => {
                              await enrollmentsApi.cancelRequest(course.id, pendingReq.id);
                              setMessage(`Đã hủy yêu cầu ghi danh lớp ${course.code}.`);
                              await loadData();
                            }}
                          />
                        ) : isFull ? (
                          <StatusBadge status="full" />
                        ) : (
                          <Button size="sm" onClick={() => setRequestTarget(course)}>
                            <Send size={14} />
                            Gửi yêu cầu tham gia
                          </Button>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </div>
            <PaginationBar
              page={discoverClasses.page}
              pageSize={discoverClasses.page_size}
              total={discoverClasses.total}
              onPageChange={setPage}
            />
          </>
        )
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Yêu cầu ghi danh của bạn</h2>
            {!studentRequests || studentRequests.items.length === 0 ? (
              <Card>
                <EmptyState
                  title="Chưa có yêu cầu ghi danh"
                  description="Yêu cầu tham gia lớp học sẽ hiển thị tại đây."
                />
              </Card>
            ) : (
              <>
                <DataTable
                  caption="Danh sách yêu cầu ghi danh"
                  columns={["Mã lớp", "Lý do gửi", "Trạng thái", "Phản hồi", "Thời gian", "Thao tác"]}
                >
                  {studentRequests.items.map((req) => (
                    <tr key={req.id}>
                      <td className="tabular-nums px-4 py-3 font-medium">Lớp #{req.class_id}</td>
                      <td className="px-4 py-3 text-sm">{req.reason}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {req.decision_reason ?? "—"}
                      </td>
                      <td className="tabular-nums px-4 py-3 text-xs text-muted-foreground">
                        {formatVietnamDateTime(req.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {req.status === "pending" && (
                          <ConfirmAction
                            title="Hủy yêu cầu ghi danh?"
                            description="Xác nhận hủy yêu cầu chờ duyệt này."
                            trigger="Hủy yêu cầu"
                            needsReason={false}
                            onConfirm={async () => {
                              await enrollmentsApi.cancelRequest(req.class_id, req.id);
                              setMessage("Đã hủy yêu cầu ghi danh.");
                              await loadData();
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </DataTable>
                <PaginationBar
                  page={studentRequests.page}
                  pageSize={studentRequests.page_size}
                  total={studentRequests.total}
                  onPageChange={setReqPage}
                />
              </>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Lịch sử chu kỳ ghi danh</h2>
            {!studentHistory || studentHistory.items.length === 0 ? (
              <Card>
                <EmptyState
                  title="Chưa có lịch sử ghi danh"
                  description="Các chu kỳ ghi danh đã được duyệt sẽ được lưu tại đây."
                />
              </Card>
            ) : (
              <>
                <DataTable
                  caption="Lịch sử chu kỳ ghi danh"
                  columns={["Lớp học", "Chu kỳ", "Trạng thái", "Điểm danh / Quiz", "Kết quả", "Ghi chú"]}
                >
                  {studentHistory.items.map(({ enrollment, class: cls, progress }) => (
                    <tr key={enrollment.id}>
                      <td className="px-4 py-3 font-medium">
                        {cls.code} · {cls.name}
                        <p className="tabular-nums text-xs font-normal text-muted-foreground">
                          Hết hạn: {formatVietnamDateOnly(cls.end_date)}
                        </p>
                      </td>
                      <td className="tabular-nums px-4 py-3 text-xs">
                        Chu kỳ #{enrollment.cycle_number} (ID #{enrollment.id})
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={enrollment.status} />
                      </td>
                      <td className="tabular-nums px-4 py-3 text-xs">
                        ĐD: {progress.attendance_count}/{progress.total_sessions} ({progress.attendance_percent.toFixed(0)}%)
                        <br />
                        Quiz: {progress.passed_quiz_count}/{progress.published_quiz_count} ({progress.quiz_percent.toFixed(0)}%)
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={progress.completed ? "completed" : "incomplete"} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {enrollment.removal_reason
                          ? `Rời lớp: ${enrollment.removal_reason}`
                          : progress.incomplete_reasons.length > 0
                            ? progress.incomplete_reasons.map(translateIncompleteReason).join("; ")
                            : "Đạt yêu cầu"}
                      </td>
                    </tr>
                  ))}
                </DataTable>
                <PaginationBar
                  page={studentHistory.page}
                  pageSize={studentHistory.page_size}
                  total={studentHistory.total}
                  onPageChange={setHistPage}
                />
              </>
            )}
          </section>
        </div>
      )}

      <Dialog
        title={editing === "new" ? "Tạo lớp học" : "Chỉnh sửa lớp học"}
        description="Thông tin lớp, quản lý phụ trách và ngưỡng hoàn thành được lưu trực tiếp trên máy chủ."
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        {editing && (
          <ClassForm
            key={editing === "new" ? "new" : editing.id}
            course={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              setMessage("Đã lưu thông tin lớp học.");
              await loadData();
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={previewData !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewData(null);
        }}
        title={previewData ? `${previewData.class.code} · ${previewData.class.name}` : "Xem trước lớp"}
        description="Thông tin công khai của lớp học trước khi gửi yêu cầu tham gia."
      >
        {previewData && (
          <div className="space-y-4 text-sm">
            <p className="leading-6 text-slate-700">{previewData.class.description}</p>
            <div className="tabular-nums grid gap-2 rounded-xl bg-slate-50 p-4 text-xs">
              <p>Quản lý lớp: {previewData.class.manager.full_name}</p>
              <p>
                Sĩ số: {previewData.class.enrolled_count}/{previewData.class.capacity}
              </p>
              <p>
                Ngưỡng hoàn thành: Điểm danh {previewData.class.min_attendance_percent}% · Quiz{" "}
                {previewData.class.min_quiz_percent}%
              </p>
              <p>Hết hạn cuối ngày: {formatVietnamDateOnly(previewData.class.end_date)} (UTC+7)</p>
            </div>
            <div>
              <h3 className="font-semibold">Buổi học sắp tới</h3>
              {previewData.upcoming_sessions.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">Chưa có buổi học sắp tới được duyệt.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {previewData.upcoming_sessions.map((s) => (
                    <li key={s.id} className="tabular-nums flex items-center gap-2 text-xs text-slate-700">
                      <CalendarDays size={14} className="text-primary" />
                      Buổi {s.session_number}: {s.title} ({formatVietnamDateTime(s.starts_at)})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={requestTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRequestTarget(null);
        }}
        title={requestTarget ? `Gửi yêu cầu tham gia · ${requestTarget.code}` : "Gửi yêu cầu"}
        description="Nhập lý do tham gia lớp. Nếu từng bị từ chối, lý do mới phải khác lần trước."
      >
        {requestTarget && (
          <ActionForm
            submitLabel="Gửi yêu cầu"
            onCancel={() => setRequestTarget(null)}
            onSubmit={async (formData) => {
              const reason = String(formData.get("reason") ?? "").trim();
              await enrollmentsApi.createRequest(requestTarget.id, reason);
              setMessage(`Đã gửi yêu cầu tham gia lớp ${requestTarget.code}.`);
              setRequestTarget(null);
              await loadData();
            }}
          >
            <Field label="Lý do tham gia *">
              <textarea name="reason" required maxLength={1000} className="form-control min-h-24" />
            </Field>
          </ActionForm>
        )}
      </Dialog>
    </div>
  );
}
