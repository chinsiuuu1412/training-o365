import { BookOpen, CalendarDays, ClipboardList, FilePenLine } from "lucide-react";
import type { StudentDashboardData } from "@/mocks/services/dashboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ClassCard } from "@/components/shared/class-card";
import { ProgressCard } from "@/components/shared/progress-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { DashboardPage, DemoDate, formatDate, LessonList, NotificationList } from "./dashboard-parts";

export function StudentDashboard({ data }: { data: StudentDashboardData }) {
  const draft = data.continueLearning;
  return <DashboardPage>
    <PageHeader eyebrow="Không gian học tập" title="Hành trình học tập của bạn" description="Chào An, tiếp tục bài đang làm và chuẩn bị cho những buổi học tiếp theo." />
    <DemoDate referenceTime={data.referenceTime} />
    <Card className="border-blue-100 bg-blue-50/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-navy">Tiếp tục học</h2>{draft && <StatusBadge status="inProgress" />}</div>
      {draft ? <div className="mt-4 grid items-start gap-5 md:grid-cols-[1fr_auto]">
        <div><p className="text-xs font-medium text-primary">{draft.course.name} · Assignment</p><h3 className="mt-2 text-lg font-semibold">{draft.quiz.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">Đã lưu {draft.answeredQuestions}/{draft.totalQuestions} câu trả lời · Còn {draft.remainingMinutes} phút làm bài</p><p className="mt-1 text-sm font-medium text-slate-700">Hạn nộp: {formatDate(draft.quiz.dueAt)} (UTC+7)</p></div>
        <details className="dashboard-details max-w-sm rounded-xl border border-blue-100 bg-white p-4"><summary className="text-sm font-medium text-primary">Xem bài đang làm</summary><div className="mt-3 space-y-3 text-sm leading-6"><p>Assignment cho phép tiếp tục bài được lưu sau gián đoạn. Hạn nộp vẫn áp dụng.</p><p>Điểm đạt: {draft.quiz.passingScore}/100. Chưa có kết quả nộp bài.</p><Button disabled size="sm">Tiếp tục Assignment · Chưa hỗ trợ</Button><p className="text-xs text-muted-foreground">Bản demo chưa triển khai màn hình làm bài.</p></div></details>
      </div> : <EmptyState title="Không có Assignment đang làm dở" description="Bạn có thể xem buổi học và hạn nộp sắp tới bên dưới." />}
    </Card>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Lớp đã đăng ký" value={data.classes.length} detail="Đã duyệt và còn thời hạn truy cập" icon={BookOpen} />
      <StatCard label="Buổi học sắp tới" value={data.upcomingLessons.length} detail="Giảng viên đã xác nhận lịch" icon={CalendarDays} tone="violet" />
      <StatCard label="Assignment sắp đến hạn" value={data.deadlines.length} detail="Theo các lớp bạn đã đăng ký" icon={ClipboardList} tone="amber" />
      <StatCard label="Assignment đang làm" value={draft ? 1 : 0} detail="Bài được lưu gần nhất để tiếp tục" icon={FilePenLine} tone="teal" />
    </div>
    <section aria-labelledby="registered-classes"><h2 id="registered-classes" className="mb-4 text-xl font-semibold">Lớp học đã đăng ký</h2>
      {data.classes.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.classes.map(course => <ClassCard key={course.id} course={course} registered />)}</div> : <EmptyState title="Chưa có lớp đã đăng ký" description="Lớp được duyệt và còn thời hạn sẽ xuất hiện tại đây." />}
    </section>
    <section aria-labelledby="learning-progress"><h2 id="learning-progress" className="mb-4 text-xl font-semibold">Tiến độ học tập</h2>
      {data.classes.length ? <div className="grid items-start gap-6 lg:grid-cols-2">
        <ProgressCard title="Attendance · Điểm danh" description="Số buổi được điểm danh / tổng số buổi của từng lớp × 100%." metrics={data.classes.map(c => ({ label: c.name, value: c.progress.attendance, detail: `Tổng ${c.totalLessons} buổi của lớp · Mỗi buổi chỉ tính một lần` }))} />
        <ProgressCard title="Quiz · Test & Assignment" description="Số bài đã đạt / tổng số bài của từng lớp × 100%." metrics={data.classes.map(c => ({ label: c.name, value: c.progress.quiz, detail: "Test và Assignment có vai trò tương đương · Không tính trùng bài đạt", color: "teal" }))} />
      </div> : <EmptyState title="Chưa có tiến độ học tập" description="Attendance và Quiz được theo dõi độc lập khi bạn có lớp học." />}
    </section>
    <div className="grid items-start gap-6 xl:grid-cols-2"><LessonList lessons={data.upcomingLessons} />
      <Card className="min-w-0 p-5 sm:p-6"><h2 className="text-lg font-semibold">Hạn nộp Assignment</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Sắp xếp theo hạn nộp gần nhất · UTC+7</p>
        {data.deadlines.length ? <div className="mt-4 divide-y divide-border">{data.deadlines.map(quiz => <details key={quiz.id} className="dashboard-details py-4 first:pt-0"><summary className="text-sm font-medium">{quiz.title}<span className="mt-1 block text-xs font-normal text-muted-foreground">{quiz.course.name} · {formatDate(quiz.dueAt)}</span></summary><div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-4 text-sm leading-6"><StatusBadge status={draft?.quiz.id === quiz.id ? "inProgress" : "available"} /><p>Assignment trắc nghiệm · {quiz.timeLimitMinutes} phút · Điểm đạt {quiz.passingScore}/100.</p><p>Chỉ kết quả đạt mới làm tăng tiến độ Quiz; không thay đổi Attendance.</p><Button disabled size="sm" variant="outline">Làm Assignment · Chưa hỗ trợ</Button></div></details>)}</div> : <EmptyState title="Không có hạn nộp sắp tới" description="Assignment còn hạn của các lớp đã đăng ký sẽ xuất hiện tại đây." />}
      </Card>
    </div>
    <NotificationList title="Thông báo học tập" notifications={data.notifications} />
  </DashboardPage>;
}
