"use client";

import Link from "next/link";
import { Bell, BookOpen, CalendarClock, ClipboardCheck, RefreshCw, Users } from "lucide-react";
import type { ClassDto, DashboardDto } from "@/types/api";
import { formatVietnamDateTime } from "@/lib/date";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClassCard } from "@/components/shared/class-card";
import { AgendaSection, StaffCompletionTable } from "./dashboard-parts";

export function ManagerDashboard({
  data,
  onRefresh,
  refreshing,
  lastUpdatedAt,
}: {
  data: DashboardDto<ClassDto>;
  onRefresh: () => void;
  refreshing: boolean;
  lastUpdatedAt: Date | null;
}) {
  const classes = data.classes.map((entry) => entry.class);

  return (
    <div className="dashboard-page space-y-6">
      <PageHeader
        title="Tổng quan Quản lý lớp"
        description="Theo dõi lớp được phân công, yêu cầu ghi danh chờ duyệt, lịch học sắp diễn ra và tiến độ hoàn thành của học viên."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {lastUpdatedAt && (
              <span className="tabular-nums text-xs text-muted-foreground">
                Cập nhật: {lastUpdatedAt.toLocaleTimeString("vi-VN")}
              </span>
            )}
            <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={onRefresh}>
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Làm mới
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lớp phụ trách"
          value={classes.length}
          detail="Tổng số lớp được phân công"
          icon={BookOpen}
          tone="blue"
        />
        <StatCard
          label="Học viên đang học"
          value={data.enrolled_count}
          detail="Ghi danh hiệu lực trên các lớp"
          icon={Users}
          tone="teal"
        />
        <StatCard
          label="Yêu cầu chờ duyệt"
          value={data.agenda.pending_enrollment_requests}
          detail="Đang chờ phê duyệt tại lớp hoạt động"
          icon={ClipboardCheck}
          tone="amber"
        />
        <StatCard
          label="Thông báo chưa đọc"
          value={data.unread_count}
          detail="Hộp thư nội bộ"
          icon={Bell}
          tone="violet"
        />
      </div>

      <AgendaSection role="manager" agenda={data.agenda} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Lớp phụ trách</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/manager/classes">Xem tất cả lớp</Link>
          </Button>
        </div>
        {classes.length === 0 ? (
          <Card>
            <EmptyState
              title="Chưa có lớp phụ trách"
              description="Quản trị viên chưa phân công lớp học nào cho tài khoản của bạn."
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {classes.map((course) => (
              <ClassCard
                key={course.id}
                course={course}
                href={`/manager/classes/${course.id}`}
                actions={
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={14} />
                      Hạn khóa: {formatVietnamDateTime(course.expires_at)}
                    </span>
                    <StatusBadge status={course.is_expired ? "expired" : "active"} />
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>

      <StaffCompletionTable role="manager" entries={data.classes} />
    </div>
  );
}