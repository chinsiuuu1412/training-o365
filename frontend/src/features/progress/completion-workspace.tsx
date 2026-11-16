"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type {
  ClassDto,
  ClassEnrollmentRosterItem,
  DashboardResponse,
  Page,
  ProgressDto,
  RouteRole,
  StaffProgressItem,
} from "@/types/api";
import { fetchAllPages, formatApiError } from "@/lib/api-client";
import { classesApi, dashboardsApi, enrollmentsApi, progressApi } from "@/lib/lms-api";
import { formatVietnamDateTime } from "@/lib/date";
import { translateIncompleteReason } from "@/lib/quiz-client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, Feedback, Field } from "@/components/shared/management-ui";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LearnerProgress, displayPercent } from "./learner-progress";

export function CompletionWorkspace({
  role,
  initialClassId,
}: {
  role: RouteRole;
  initialClassId?: number;
}) {
  const [classes, setClasses] = useState<ClassDto[]>([]);
  const [studentDash, setStudentDash] = useState<DashboardResponse | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(initialClassId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadInit = async () => {
      try {
        if (role === "student") {
          const dash = await dashboardsApi.get("student");
          if (!active) return;
          setStudentDash(dash);
          if (!selectedClassId && dash.classes.length > 0) {
            setSelectedClassId(dash.classes[0].class.id);
          }
        } else {
          const list = await fetchAllPages<ClassDto>((p, ps) =>
            classesApi.list(role, { page: p, page_size: ps }),
          );
          if (!active) return;
          setClasses(list);
          if (!selectedClassId && list.length > 0) {
            setSelectedClassId(list[0].id);
          }
        }
      } catch (err) {
        if (!active) return;
        setError(formatApiError(err, "Không thể tải danh sách lớp."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadInit();
    return () => {
      active = false;
    };
  }, [role, selectedClassId]);

  if (loading) return <LoadingState label="Đang tải tiến độ học tập" />;
  if (error) return <ErrorState message={error} />;

  if (role === "student") {
    const classEntries = studentDash?.classes ?? [];
    const currentEntry = classEntries.find((c) => c.class.id === selectedClassId);

    return (
      <div className="dashboard-page space-y-6">
        <PageHeader
          title="Tiến độ học tập"
          description="Số liệu chuyên cần, bài kiểm tra và điều kiện hoàn thành của từng lần ghi danh."
        />

        {classEntries.length === 0 ? (
          <Card>
            <EmptyState
              title="Chưa có dữ liệu tiến độ"
              description="Khi bạn ghi danh vào lớp học, tiến độ từng chu kỳ sẽ hiển thị tại đây."
            />
          </Card>
        ) : (
          <>
            <Card className="p-5">
              <Field label="Chọn lớp học">
                <select
                  className="form-control max-w-lg"
                  value={selectedClassId ?? ""}
                  onChange={(e) => setSelectedClassId(Number(e.target.value))}
                >
                  {classEntries.map((entry) => (
                    <option key={entry.class.id} value={entry.class.id}>
                      {entry.class.code} · {entry.class.name}
                    </option>
                  ))}
                </select>
              </Field>
            </Card>

            {currentEntry && (
              <StudentClassProgressPanel
                classId={currentEntry.class.id}
                enrollments={currentEntry.enrollments}
              />
            )}
          </>
        )}
      </div>
    );
  }

  const activeClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="dashboard-page space-y-6">
      <PageHeader
        title="Tiến độ học tập theo lớp"
        description="Theo dõi tỷ lệ chuyên cần, điểm bài kiểm tra và các điều kiện chưa đạt của từng lượt ghi danh."
      />

      {classes.length === 0 ? (
        <Card>
          <EmptyState
            title="Chưa có lớp học"
            description="Lớp học bạn phụ trách hoặc quản lý sẽ hiển thị tại đây."
          />
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <Field label="Chọn lớp học">
              <select
                className="form-control max-w-lg"
                value={selectedClassId ?? ""}
                onChange={(e) => setSelectedClassId(Number(e.target.value))}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </Card>

          {activeClass && <CompletionClassPanel role={role} classDto={activeClass} />}
        </>
      )}
    </div>
  );
}

function StudentClassProgressPanel({
  classId,
  enrollments,
}: {
  classId: number;
  enrollments: DashboardResponse["classes"][number]["enrollments"];
}) {
  const activeCycle = enrollments.find((e) => e.enrollment.status === "enrolled");
  const [liveProgress, setLiveProgress] = useState<ProgressDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCycle) {
      return;
    }
    const controller = new AbortController();
    progressApi
      .studentGet(classId, controller.signal)
      .then((res) => setLiveProgress(res.progress))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(formatApiError(err, "Không thể tải tiến độ chu kỳ hiện hành."));
        }
      });
    return () => controller.abort();
  }, [classId, activeCycle]);

  return (
    <div className="space-y-6">
      {error && <Feedback message={error} error />}
      {activeCycle ? (
        <LearnerProgress progress={liveProgress ?? activeCycle.progress} />
      ) : (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            Bạn hiện không còn ở trạng thái đang theo học trong lớp này (đã bị gỡ hoặc lớp đã hết hạn). Chỉ hiển thị tóm tắt lịch sử bên dưới.
          </p>
        </Card>
      )}

      {enrollments.length > 0 && (
        <Card className="space-y-4 p-5">
          <h3 className="text-base font-semibold">Lịch sử các lần ghi danh lớp #{classId}</h3>
          <div className="space-y-3">
            {enrollments.map(({ enrollment, progress }) => (
              <div
                key={enrollment.id}
                className="space-y-2 rounded-xl border border-border p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    Chu kỳ #{enrollment.cycle_number} (ID #{enrollment.id})
                  </span>
                  <StatusBadge status={enrollment.status} />
                </div>
                <p className="tabular-nums text-xs text-muted-foreground">
                  Duyệt lúc {formatVietnamDateTime(enrollment.approved_at)}
                  {enrollment.removed_at
                    ? ` · Gỡ lúc ${formatVietnamDateTime(enrollment.removed_at)}`
                    : ""}
                </p>
                {enrollment.removal_reason && (
                  <p className="text-xs text-red-700">Lý do gỡ: {enrollment.removal_reason}</p>
                )}
                <p className="tabular-nums text-sm">
                  Chuyên cần: {progress.attendance_count}/{progress.total_sessions} (
                  {displayPercent(progress.attendance_percent)}%) · Quiz:{" "}
                  {progress.passed_quiz_count}/{progress.published_quiz_count} (
                  {displayPercent(progress.quiz_percent)}%)
                </p>
                {progress.incomplete_reasons.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Lý do chưa đạt:{" "}
                    {progress.incomplete_reasons.map(translateIncompleteReason).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function CompletionClassPanel({
  role,
  classDto,
}: {
  role: RouteRole;
  classDto: ClassDto;
}) {
  if (role === "student") {
    return <StudentSingleClassProgress classDto={classDto} />;
  }
  return <StaffClassProgress role={role} classDto={classDto} />;
}

function StudentSingleClassProgress({ classDto }: { classDto: ClassDto }) {
  const [progress, setProgress] = useState<ProgressDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await progressApi.studentGet(classDto.id, signal);
        setProgress(res.progress);
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải tiến độ học tập."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [classDto.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  if (loading && !progress) return <LoadingState label="Đang tải tiến độ" />;
  if (error && !progress) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!progress) return null;

  return <LearnerProgress progress={progress} classInfo={classDto} />;
}

function StaffClassProgress({
  role,
  classDto,
}: {
  role: "admin" | "manager";
  classDto: ClassDto;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<StaffProgressItem> | null>(null);
  const [rosterMap, setRosterMap] = useState<Map<number, ClassEnrollmentRosterItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const [progRes, rosterList] = await Promise.all([
          progressApi.staffList(role, classDto.id, { page, page_size: 20 }, signal),
          enrollmentsApi.listAllRoster(role, classDto.id, signal),
        ]);
        const map = new Map<number, ClassEnrollmentRosterItem>();
        for (const item of rosterList) {
          map.set(item.id, item);
        }
        setRosterMap(map);
        setData(progRes);
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải bảng tiến độ học viên."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [role, classDto.id, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Ngưỡng lớp: Chuyên cần ≥ {classDto.min_attendance_percent}% · Quiz ≥{" "}
          {classDto.min_quiz_percent}%
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw size={14} />
          Làm mới
        </Button>
      </div>

      {loading && !data ? (
        <LoadingState label="Đang tải tiến độ lớp" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            title="Chưa có lượt ghi danh nào"
            description="Tiến độ học viên sẽ xuất hiện sau khi có học viên được duyệt vào lớp."
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Tiến độ theo chu kỳ ghi danh"
            columns={["Học viên / Chu kỳ", "Trạng thái ghi danh", "Chuyên cần", "Quiz", "Kết quả"]}
          >
            {data.items.map(({ enrollment, progress }) => {
              const info = rosterMap.get(enrollment.id);
              return (
                <tr key={enrollment.id}>
                  <th scope="row" className="px-4 py-4 font-medium">
                    {info?.student.full_name ?? `Học viên #${enrollment.student_id}`}
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      {info?.student.email ?? ""} · Ghi danh #{enrollment.id} (chu kỳ{" "}
                      {enrollment.cycle_number})
                    </p>
                  </th>
                  <td className="px-4 py-4">
                    <StatusBadge status={enrollment.status} />
                  </td>
                  <td className="tabular-nums px-4 py-4">
                    {progress.attendance_count}/{progress.total_sessions} (
                    {displayPercent(progress.attendance_percent)}%)
                  </td>
                  <td className="tabular-nums px-4 py-4">
                    {progress.passed_quiz_count}/{progress.published_quiz_count} (
                    {displayPercent(progress.quiz_percent)}%)
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge
                      status={progress.completed ? "completed" : "pending"}
                      label={progress.completed ? "Đạt" : "Chưa đạt"}
                    />
                    {progress.incomplete_reasons.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {progress.incomplete_reasons.map(translateIncompleteReason).join(", ")}
                      </p>
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
    </div>
  );
}
