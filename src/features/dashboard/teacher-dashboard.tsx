"use client";

import { useState } from "react";
import { BookOpen, CalendarDays, ClipboardCheck, Users } from "lucide-react";
import type { TeacherDashboardData } from "@/mocks/services/dashboard";
import { isExpired } from "@/mocks/services/management";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ClassCard } from "@/components/shared/class-card";
import { ProgressCard } from "@/components/shared/progress-card";
import { EmptyState } from "@/components/shared/states";
import { DashboardPage, DemoDate, LessonList, NotificationList, RequestList } from "./dashboard-parts";

export function TeacherDashboard({ data, displayName = "Hoàng Nam" }: { data: TeacherDashboardData; displayName?: string }) {
  const [selectedClass, setSelectedClass] = useState("all");
  const matches = (classId: string) => selectedClass === "all" || selectedClass === classId;
  const classes = data.classes.filter(c => matches(c.id));
  const lessons = data.upcomingLessons.filter(l => matches(l.classId));
  const enrollments = data.enrollmentRequests.filter(r => matches(r.classId));
  const retakes = data.retakeRequests.filter(r => matches(r.classId));
  const notifications = data.notifications.filter(n => !n.classId || matches(n.classId));

  return <DashboardPage>
    <PageHeader eyebrow="Không gian giảng dạy" title="Tổng quan giảng dạy" description={`Chào ${displayName}, xem lịch dạy và những yêu cầu cần bạn quan tâm.`} />
    <div className="flex flex-wrap items-center justify-between gap-4">
      <DemoDate referenceTime={data.referenceTime} />
      <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">Lớp phụ trách
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="h-10 max-w-full rounded-lg border border-border bg-white px-3 text-sm" aria-label="Chọn lớp phụ trách"><option value="all">Tất cả lớp phụ trách</option>{data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Lớp phụ trách" value={classes.length} detail="Theo bộ lọc lớp hiện tại" icon={BookOpen} />
      <StatCard label="Lượt học viên đăng ký" value={classes.reduce((sum, c) => sum + c.students, 0)} detail="Chỉ tính đăng ký đã được duyệt" icon={Users} tone="violet" />
      <StatCard label="Buổi học sắp tới" value={lessons.length} detail="Lịch đã xác nhận trong dữ liệu demo" icon={CalendarDays} tone="teal" />
      <StatCard label="Yêu cầu chờ bạn" value={enrollments.length + retakes.length} detail="Đăng ký lớp và làm lại Test" icon={ClipboardCheck} tone="amber" />
    </div>
    <section aria-labelledby="my-classes"><h2 id="my-classes" className="mb-4 text-xl font-semibold">Lớp học của tôi</h2>
      {classes.length ? <div className="grid gap-4 md:grid-cols-2">{classes.map(course => <ClassCard key={course.id} course={course} expired={isExpired(course, Date.parse(data.referenceTime))} href={`/teacher/classes/${course.id}`} />)}</div> : <EmptyState title="Chưa có lớp phụ trách" description="Các lớp được quản trị viên phân công sẽ xuất hiện tại đây." />}
    </section>
    <section aria-labelledby="teaching-progress"><h2 id="teaching-progress" className="mb-4 text-xl font-semibold">Tiến độ giảng dạy & học tập</h2>
      <div className="grid gap-4 md:grid-cols-2">{classes.map(course => <ProgressCard key={course.id} title={course.name} description="Giảng dạy theo số buổi cố định; học tập là trung bình học viên đã đăng ký." metrics={[
        { label: "Giảng dạy", value: course.totalLessons ? Math.round(course.completedLessons / course.totalLessons * 100) : 0, detail: `${course.completedLessons}/${course.totalLessons} buổi đã hoàn thành` },
        { label: "Attendance trung bình", value: course.attendance, detail: "Số buổi điểm danh / tổng số buổi của lớp" },
        { label: "Quiz trung bình", value: course.quiz, detail: "Số bài đạt / tổng số Test và Assignment", color: "teal" },
      ]} />)}</div>
      {!classes.length && <EmptyState title="Chưa có tiến độ giảng dạy" description="Tiến độ được tính khi bạn được phân công lớp." />}
    </section>
    <div className="grid items-start gap-6 xl:grid-cols-2"><LessonList lessons={lessons} role="teacher" /><NotificationList notifications={notifications} /></div>
    <div className="grid items-start gap-6 xl:grid-cols-2"><RequestList title="Yêu cầu đăng ký lớp" requests={enrollments} /><RequestList title="Yêu cầu làm lại Test" requests={retakes} /></div>
  </DashboardPage>;
}
