import { BookOpen, CalendarDays, Users } from "lucide-react";
import type { ClassRow } from "@/mocks/services/dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressTrack } from "./progress-track";
import { StatusBadge } from "./status-badge";

export function ClassCard({ course, registered = false }: { course: ClassRow; registered?: boolean }) {
  return <Card className="dashboard-card min-w-0 p-5 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><span className={`course-icon course-${course.color}`}><BookOpen size={20} /></span><StatusBadge status={registered ? "registered" : "active"} /></div>
    <p className="text-xs font-medium tracking-wide text-muted-foreground">{course.code}</p>
    <h3 className="mt-1 text-base font-semibold leading-6">{course.name}</h3>
    <p className="mt-2 text-sm text-muted-foreground">{course.teacher.name}</p>
    <div className="my-4 flex items-center gap-2 text-xs text-slate-600"><Users size={15} aria-hidden="true" />{course.students}/{course.capacity} học viên</div>
    <p className="mb-2 text-xs font-medium">{registered ? "Nội dung đã giảng" : "Tiến độ giảng dạy"} · {course.completedLessons}/{course.totalLessons} buổi</p>
    <ProgressTrack value={course.totalLessons ? Math.round(course.completedLessons / course.totalLessons * 100) : 0} label={`Giảng dạy · ${course.name}`} />
    <details className="dashboard-details mt-5 border-t border-border pt-3">
      <summary className="text-sm font-medium text-primary">Xem chi tiết lớp {course.name}</summary>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
        <p className="flex items-start gap-2"><CalendarDays size={16} className="mt-1 shrink-0" />Hết hạn: {new Date(`${course.expiresAt}T00:00:00+07:00`).toLocaleDateString("vi-VN", { timeZone: "Asia/Bangkok" })}</p>
        <p>{course.totalLessons} buổi học cố định. Attendance và Quiz được theo dõi riêng.</p>
        <Button disabled variant="outline" size="sm">Mở lớp · Chưa hỗ trợ</Button>
        <p className="text-xs">Bản demo chỉ xem thông tin; trang học và quản lý lớp chưa triển khai.</p>
      </div>
    </details>
  </Card>;
}
