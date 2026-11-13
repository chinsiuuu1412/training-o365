"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ClipboardCheck, GraduationCap, Search, Users } from "lucide-react";
import type { DashboardData } from "@/mocks/services/dashboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ClassCard } from "@/components/shared/class-card";
import { ProgressCard } from "@/components/shared/progress-card";
import { EmptyState } from "@/components/shared/states";
import { DashboardPage, DemoDate, NotificationList, RequestList } from "./dashboard-parts";
import { ProgressChart } from "./progress-chart";

export function AdminDashboard({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const rows = data.classes.filter(c => `${c.name} ${c.code} ${c.teacher.name}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const chartRows = data.classes.filter(c => selectedClass === "all" || c.id === selectedClass);
  const requests = data.requests.filter(r => r.status === "waiting");
  const assignedTeachers = new Set(data.classes.map(c => c.teacherId)).size;

  return <DashboardPage>
    <PageHeader eyebrow="Không gian quản trị" title="Tổng quan hệ thống" description="Chào Minh Anh, cùng theo dõi hoạt động học tập và những lịch học cần xem xét." actions={<Button asChild><a href="#schedule-requests"><ClipboardCheck />Xem lịch chờ duyệt</a></Button>} />
    <DemoDate referenceTime={data.referenceTime} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Tổng học viên" value={data.stats.students} detail="Tài khoản học viên duy nhất trong hệ thống" icon={Users} />
      <StatCard label="Giảng viên" value={data.stats.teachers} detail={`${assignedTeachers} giảng viên đang phụ trách ${data.stats.classes} lớp`} icon={GraduationCap} tone="violet" />
      <StatCard label="Lớp học đang hoạt động" value={data.stats.classes} detail={`${data.classes.reduce((sum, c) => sum + c.students, 0)} lượt đăng ký đã được duyệt`} icon={BookOpen} tone="teal" />
      <StatCard label="Lịch học chờ duyệt" value={data.stats.pending} detail="Yêu cầu thuộc quyền xử lý của Admin" icon={ClipboardCheck} tone="amber" />
    </div>
    <section aria-labelledby="class-overview">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4"><div><h2 id="class-overview" className="text-xl font-semibold">Tổng quan lớp học</h2><p className="mt-1 text-sm text-muted-foreground">Sĩ số, phân công giảng viên và số buổi đã dạy</p></div>
        <div className="relative max-w-full"><Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><label htmlFor="class-search" className="sr-only">Tìm lớp học hoặc giảng viên</label><input id="class-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm lớp hoặc giảng viên…" className="h-10 w-64 max-w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm" /></div>
      </div>
      {rows.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(course => <ClassCard key={course.id} course={course} />)}</div> : <div aria-live="polite"><EmptyState title="Không tìm thấy lớp học" description="Thử tên lớp, mã lớp hoặc tên giảng viên khác." /><Button variant="outline" size="sm" onClick={() => setQuery("")}>Xóa tìm kiếm</Button></div>}
      <p aria-live="polite" className="mt-3 text-xs text-muted-foreground">Hiển thị {rows.length} trên {data.classes.length} lớp học</p>
    </section>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card className="min-w-0 p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Attendance & Quiz theo lớp</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Trung bình tiến độ học viên đã đăng ký</p></div><label className="sr-only" htmlFor="chart-class">Lọc biểu đồ theo lớp</label><select id="chart-class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="h-10 max-w-full rounded-lg border border-border bg-white px-3 text-sm"><option value="all">Tất cả lớp học</option>{data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        {chartRows.length ? <ProgressChart classes={chartRows} /> : <EmptyState title="Chưa có dữ liệu tiến độ" description="Tiến độ của các lớp sẽ xuất hiện tại đây." />}
        <details className="dashboard-details mt-4"><summary className="text-sm font-medium text-primary">Xem số liệu chi tiết</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Tiến độ Attendance và Quiz trung bình theo lớp</caption><thead><tr><th scope="col" className="py-2 pr-3">Lớp học</th><th scope="col" className="p-2">Attendance</th><th scope="col" className="p-2">Quiz</th></tr></thead><tbody>{chartRows.map(c => <tr key={c.id} className="border-t border-border"><th scope="row" className="py-3 pr-3 font-medium">{c.name}</th><td className="p-2">{c.attendance}%</td><td className="p-2">{c.quiz}%</td></tr>)}</tbody></table></div></details>
        <p className="mt-4 border-t border-border pt-3 text-xs leading-6 text-muted-foreground">Attendance = số buổi được điểm danh / tổng số buổi. Quiz = số bài đạt / tổng số Test và Assignment. Hai tiêu chí được tính riêng.</p>
      </Card>
      <ProgressCard title="Tiến độ giảng dạy" description="Số buổi đã dạy trên tổng số buổi cố định của mỗi lớp." metrics={chartRows.map(c => ({ label: c.name, value: c.totalLessons ? Math.round(c.completedLessons / c.totalLessons * 100) : 0, detail: `${c.completedLessons}/${c.totalLessons} buổi đã hoàn thành` }))} />
    </div>
    <div className="grid items-start gap-6 xl:grid-cols-2"><div id="schedule-requests" className="min-w-0 scroll-mt-6"><RequestList title="Lịch học chờ phê duyệt" requests={requests} /></div><NotificationList title="Hoạt động gần đây" notifications={data.activities} /></div>
    <Card className="p-5 sm:p-6"><h2 className="text-lg font-semibold">Thao tác nhanh</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Xem các mục quản lý hoặc kiểm tra yêu cầu ngay trên dashboard.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Button asChild variant="outline"><a href="#class-overview"><BookOpen />Xem các lớp</a></Button><Button asChild variant="outline"><a href="#schedule-requests"><ClipboardCheck />Xem yêu cầu lịch học</a></Button><Button asChild variant="outline"><Link href="/admin/students"><Users />Danh sách học viên</Link></Button><Button asChild variant="outline"><Link href="/admin/teachers"><GraduationCap />Danh sách giảng viên</Link></Button></div>
      <div className="mt-4 flex flex-wrap gap-3"><Button disabled size="sm">Tạo lớp · Chưa hỗ trợ</Button><Button disabled size="sm" variant="outline">Thêm tài khoản · Chưa hỗ trợ</Button></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Danh sách quản lý hiện là trang giữ chỗ. Bản demo chưa hỗ trợ tạo, duyệt hoặc chỉnh sửa dữ liệu.</p>
    </Card>
  </DashboardPage>;
}
