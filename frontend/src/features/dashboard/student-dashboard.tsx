"use client";

import Link from "next/link";
import { Bell, BookOpen, CalendarDays, ClipboardList, FilePenLine, RefreshCw } from "lucide-react";
import type { ClassSummary, DashboardDto } from "@/types/api";
import { formatVietnamDateOnly } from "@/lib/date";
import { translateIncompleteReason } from "@/lib/quiz-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProgressTrack } from "@/components/shared/progress-track";
import { EmptyState } from "@/components/shared/states";
import { AgendaSection } from "./dashboard-parts";

export function StudentDashboard({
  data,
  displayName,
  onRefresh,
  refreshing,
}: {
  data: DashboardDto<ClassSummary>;
  displayName: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="dashboard-page space-y-6">
      <PageHeader
        title="Hành trình học tập"
        description={`Xin chào ${displayName}, theo dõi lớp học, lịch học sắp tới, bài kiểm tra đang mở và tiến độ từng chu kỳ ghi danh.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={onRefresh}>
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Làm mới
            </Button>
            <Button asChild size="sm">
              <Link href="/student/classes">Tìm & mở lớp học</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lớp đang theo học"
          value={data.enrolled_count}
          detail="Chu kỳ ghi danh hiệu lực"
          icon={BookOpen}
        />
        <StatCard
          label="Buổi học sắp tới"
          value={data.agenda.upcoming_sessions.length}
          detail="Lịch đã được phê duyệt"
          icon={CalendarDays}
          tone="violet"
        />
        <StatCard
          label="Bài kiểm tra đang mở"
          value={data.agenda.quizzes.length}
          detail="Còn trong thời hạn nộp"
          icon={ClipboardList}
          tone="amber"
        />
        <StatCard
          label="Thông báo chưa đọc"
          value={data.unread_count}
          detail={
            data.agenda.active_attempts.length > 0
              ? `${data.agenda.active_attempts.length} bài đang làm dở`
              : "Hộp thư cá nhân"
          }
          icon={data.agenda.active_attempts.length > 0 ? FilePenLine : Bell}
          tone="teal"
        />
      </div>

      <AgendaSection role="student" agenda={data.agenda} />

      <section aria-labelledby="student-cycles" className="space-y-4">
        <div>
          <h2 id="student-cycles" className="text-lg font-semibold">
            Lớp học & tóm tắt chu kỳ ghi danh
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Các chu kỳ đã rời lớp hoặc lớp đã hết hạn chỉ giữ tóm tắt tiến độ tại đây.
          </p>
        </div>

        {data.classes.length === 0 ? (
          <Card>
            <EmptyState
              title="Chưa có lịch sử ghi danh"
              description="Bạn có thể tìm lớp học đang mở trong mục Lớp học để gửi yêu cầu tham gia."
            />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.classes.map(({ class: cls, enrollments }) => (
              <Card key={cls.id} className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{cls.code}</p>
                    <h3 className="mt-1 text-base font-semibold">{cls.name}</h3>
                    <p className="tabular-nums mt-1 text-xs text-muted-foreground">
                      Hạn khóa: {formatVietnamDateOnly(cls.end_date)} (UTC+7)
                    </p>
                  </div>
                  {enrollments.some((e) => e.enrollment.status === "enrolled") && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/student/classes/${cls.id}`}>Vào lớp</Link>
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {enrollments.map(({ enrollment, progress }) => (
                    <div key={enrollment.id} className="rounded-xl border border-border bg-slate-50 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="tabular-nums text-xs font-semibold">
                          Chu kỳ #{enrollment.cycle_number} (Mã ghi danh #{enrollment.id})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={enrollment.status} />
                          <StatusBadge status={progress.completed ? "completed" : "incomplete"} />
                        </div>
                      </div>

                      {enrollment.status === "removed" && enrollment.removal_reason && (
                        <p className="text-xs text-red-700">Lý do rời lớp: {enrollment.removal_reason}</p>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="tabular-nums mb-1 text-xs text-muted-foreground">
                            Điểm danh: {progress.attendance_count}/{progress.total_sessions} buổi
                          </p>
                          <ProgressTrack
                            value={progress.attendance_percent}
                            label={`Điểm danh ${cls.name}`}
                          />
                        </div>
                        <div>
                          <p className="tabular-nums mb-1 text-xs text-muted-foreground">
                            Quiz đạt: {progress.passed_quiz_count}/{progress.published_quiz_count} bài
                          </p>
                          <ProgressTrack
                            value={progress.quiz_percent}
                            color="teal"
                            label={`Quiz ${cls.name}`}
                          />
                        </div>
                      </div>

                      {progress.incomplete_reasons.length > 0 && (
                        <p className="text-xs text-slate-600">
                          Chưa đạt: {progress.incomplete_reasons.map(translateIncompleteReason).join("; ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
