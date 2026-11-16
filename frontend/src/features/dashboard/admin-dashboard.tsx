"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, CalendarClock, RefreshCw, Search, UserCog, Users } from "lucide-react";
import type { ClassDto, DashboardDto } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ClassCard } from "@/components/shared/class-card";
import { EmptyState } from "@/components/shared/states";
import { AgendaSection, StaffCompletionTable } from "./dashboard-parts";

export function AdminDashboard({
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
  const [query, setQuery] = useState("");
  const allClasses = data.classes.map((entry) => entry.class);
  const filteredClasses = allClasses.filter((c) =>
    `${c.name} ${c.code} ${c.manager.full_name}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")),
  );

  return (
    <div className="dashboard-page space-y-6">
      <PageHeader
        title="Tổng quan Quản trị viên"
        description="Theo dõi tài khoản, lớp học, đề xuất lịch chờ duyệt và tiến độ hoàn thành trên toàn hệ thống."
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
            <Button asChild size="sm">
              <Link href="/admin/schedule-proposals">
                <CalendarClock size={15} />
                Duyệt lịch chờ ({data.pending_schedules ?? 0})
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tổng học viên"
          value={data.student_count ?? 0}
          detail="Tài khoản học viên trong hệ thống"
          icon={Users}
        />
        <StatCard
          label="Quản lý lớp"
          value={data.manager_count ?? 0}
          detail="Tài khoản phụ trách lớp học"
          icon={UserCog}
          tone="violet"
        />
        <StatCard
          label="Ghi danh hiệu lực"
          value={data.enrolled_count}
          detail={`${allClasses.length} lớp học trong hệ thống`}
          icon={BookOpen}
          tone="teal"
        />
        <StatCard
          label="Lịch chờ duyệt"
          value={data.pending_schedules ?? 0}
          detail={`Thông báo chưa đọc: ${data.unread_count}`}
          icon={CalendarClock}
          tone="amber"
        />
      </div>

      <AgendaSection role="admin" agenda={data.agenda} />

      <section aria-labelledby="admin-class-overview" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="admin-class-overview" className="text-lg font-semibold">
              Danh sách lớp học
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sĩ số, quản lý lớp phụ trách và số buổi đã kết thúc.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <label htmlFor="admin-class-search" className="sr-only">
                Tìm lớp học hoặc quản lý lớp
              </label>
              <input
                id="admin-class-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm lớp hoặc quản lý…"
                className="h-10 w-64 max-w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm"
              />
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/classes">Quản lý lớp</Link>
            </Button>
          </div>
        </div>

        {filteredClasses.length === 0 ? (
          <Card>
            <EmptyState
              title="Không có lớp phù hợp"
              description="Thử từ khóa khác hoặc tạo lớp mới trong mục Lớp học."
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredClasses.map((course) => (
              <ClassCard key={course.id} course={course} href={`/admin/classes/${course.id}`} />
            ))}
          </div>
        )}
      </section>

      <StaffCompletionTable role="admin" entries={data.classes} />
    </div>
  );
}
