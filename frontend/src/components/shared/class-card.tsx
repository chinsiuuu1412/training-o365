import { BookOpen, CalendarDays, Users } from "lucide-react";
import type { ClassDto } from "@/types/api";
import { formatVietnamDateOnly } from "@/lib/date";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressTrack } from "./progress-track";
import { StatusBadge } from "./status-badge";
import Link from "next/link";
import type { ReactNode } from "react";

export function ClassCard({
  course,
  registered = false,
  href,
  actions,
}: {
  course: ClassDto;
  registered?: boolean;
  href?: string;
  actions?: ReactNode;
}) {
  const total = course.total_sessions ?? 0;
  const teachingPercent = total > 0 ? Math.min(100, (course.ended_sessions / total) * 100) : 0;

  return (
    <Card className="dashboard-card min-w-0 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="course-icon course-blue">
          <BookOpen size={20} />
        </span>
        <StatusBadge status={course.is_expired ? "expired" : registered ? "enrolled" : "active"} />
      </div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground">{course.code}</p>
      <h3 className="mt-1 text-base font-semibold leading-6">{course.name}</h3>
      <p className="mt-2 text-sm text-muted-foreground">Quản lý lớp: {course.manager.full_name}</p>
      <div className="tabular-nums my-4 flex items-center gap-2 text-xs text-slate-600">
        <Users size={15} aria-hidden="true" />
        {course.enrolled_count}/{course.capacity} học viên
      </div>
      <p className="tabular-nums mb-2 text-xs font-medium">
        Buổi đã kết thúc · {course.ended_sessions}/{total} buổi
      </p>
      <ProgressTrack value={teachingPercent} label={`Tiến độ buổi học · ${course.name}`} />
      <details className="dashboard-details mt-5 border-t border-border pt-3">
        <summary className="text-sm font-medium text-primary">Xem chi tiết lớp {course.name}</summary>
        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          <p className="flex items-start gap-2">
            <CalendarDays size={16} className="mt-1 shrink-0" />
            Hết hạn cuối ngày: {formatVietnamDateOnly(course.end_date)} (UTC+7)
          </p>
          {course.description && <p>{course.description}</p>}
          <p>
            {total > 0
              ? `${total} buổi học cố định · Ngưỡng điểm danh ${course.min_attendance_percent}%, Quiz ${course.min_quiz_percent}%.`
              : "Quản lý lớp chưa thiết lập tổng số buổi cố định."}
          </p>
        </div>
      </details>
      {(href || actions) && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {href && (
            <Button variant="outline" size="sm" asChild>
              <Link href={href}>Mở lớp {course.name}</Link>
            </Button>
          )}
          {actions}
        </div>
      )}
    </Card>
  );
}
