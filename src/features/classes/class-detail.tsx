"use client";
import Link from "next/link";
import { useState } from "react";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { canAccessClass, isExpired } from "@/mocks/services/management";
import { getDashboard, getStudentProgress } from "@/mocks/services/dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressCard } from "@/components/shared/progress-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { ActionForm, ConfirmAction, DataTable, Feedback, Field } from "@/components/shared/management-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EnrollmentAction } from "@/features/enrollments/enrollment-action";
import { EnrollmentQueue } from "@/features/enrollments/enrollment-queue";
import { ClassForm } from "./class-form";
import { LessonWorkspace } from "@/features/lessons/lesson-workspace";
import { ScheduleCalendar } from "@/features/schedules/schedule-calendar";
import { formatDate } from "@/features/dashboard/dashboard-parts";

export function ClassDetail({ role, classId, initialTab = "overview" }: { role: Role; classId: string; initialTab?: string }) {
  const { account } = useLms();
  return <ClassDetailView key={`${account(role).id}-${classId}`} role={role} classId={classId} initialTab={initialTab} />;
}

function ClassDetailView({ role, classId, initialTab }: { role: Role; classId: string; initialTab: string }) {
  const { state, now, account, run } = useLms(); const actor = account(role);
  const [selectedTab, setTab] = useState(initialTab === "lessons" || initialTab === "schedule" ? initialTab : "overview"); const [edit, setEdit] = useState(false); const [message, setMessage] = useState(""); const [studentSearch, setStudentSearch] = useState("");
  const current = { ...state, referenceTime: new Date(now).toISOString() };
  const course = getDashboard(current).classes.find(c => c.id === classId);
  const back = <Button variant="outline" asChild><Link href={`/${role}/classes`}>Về danh sách lớp</Link></Button>;
  if (!course) return <div className="space-y-4"><EmptyState title="Không tìm thấy lớp học" description="Lớp không tồn tại hoặc dữ liệu demo đã được khôi phục." />{back}</div>;
  const expired = isExpired(course, now);
  const allowed = canAccessClass(current, actor.id, classId);
  const preview = role === "student" && !allowed && !expired && actor.status !== "suspended";
  const tab = preview ? "overview" : selectedTab;
  if (!allowed && !preview) return <div className="space-y-4"><EmptyState title={expired && role === "student" ? "Lớp học đã hết hạn" : "Bạn không có quyền truy cập lớp"} description="Chỉ giảng viên được phân công hoặc học viên đã được duyệt mới có quyền truy cập nội dung lớp còn hạn." />{back}</div>;
  const allSchedules = state.schedules.filter(s => state.lessons.find(l => l.id === s.lessonId)?.classId === classId).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const next = allSchedules.find(s => ["approved", "confirmed"].includes(s.status) && Date.parse(s.startsAt) > now);
  const tabs = preview ? [["overview", "Giới thiệu lớp"]] : [["overview", "Tổng quan"], ...(role !== "student" ? [["students", "Học viên"], ["progress", "Tiến độ"]] : []), ["lessons", "Buổi học"], ...(role !== "admin" ? [["quizzes", "Quiz"]] : []), ...(role === "teacher" ? [["requests", "Yêu cầu đăng ký"]] : []), ["materials", "Course materials"], ["schedule", "Lịch học"]];
  const members = state.enrollments.filter(e => e.classId === classId && e.status === "approved").map(e => state.users.find(u => u.id === e.studentId)!).filter(u => u.name.toLocaleLowerCase("vi").includes(studentSearch.trim().toLocaleLowerCase("vi")));
  const personal = getStudentProgress(classId, actor.id, state);
  const materials = state.materials.filter(m => m.classId === classId);
  return <div className="dashboard-page management-content space-y-6">{back}<PageHeader eyebrow={`${course.code}${preview ? " · Xem trước" : ""}`} title={course.name} description={`Giảng viên: ${course.teacher.name}`} actions={role === "admin" ? <Button onClick={() => setEdit(true)}>Chỉnh sửa lớp</Button> : undefined} />
    <div className="flex flex-wrap items-center gap-3"><StatusBadge status={expired ? "expired" : "active"} /><span className="text-sm text-muted-foreground">{course.students}/{course.capacity} học viên · Hết hạn {course.expiresAt} (UTC+7)</span></div><Feedback message={message} />
    <nav aria-label="Nội dung lớp học" className="flex flex-wrap gap-2 border-b border-border pb-4">{tabs.map(([id, label]) => <Button key={id} variant={tab === id ? "default" : "outline"} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</Button>)}</nav>
    {tab === "overview" && <div className="space-y-6"><Card className="space-y-4 p-5 sm:p-6"><h2 className="text-xl font-semibold">Giới thiệu lớp học</h2><p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{course.description}</p><p className="text-sm leading-6">Tiến độ giảng dạy: {course.completedLessons}/{course.totalLessons} buổi{course.totalLessons === 0 ? " · Chờ giảng viên thiết lập số buổi" : ""}.</p><p className="text-sm leading-6">Tiêu chí hoàn thành: Attendance ≥ {course.attendanceThreshold}% và Quiz ≥ {course.quizThreshold}%. Hai tiêu chí được tính riêng.</p><p className="text-sm">Buổi học tiếp theo: {next ? formatDate(next.startsAt) : "Chưa có lịch đã xác nhận"}</p>{role === "student" && <EnrollmentAction classId={classId} />}</Card>
      {!preview && <ProgressCard title={role === "student" ? "Tiến độ của bạn" : "Tổng quan tiến độ học tập"} description={role === "student" ? "Theo bản ghi Attendance và Quiz của riêng bạn." : "Trung bình học viên đã đăng ký lớp."} metrics={[{ label: "Attendance", value: role === "student" ? personal.attendance : course.attendance, detail: "Số buổi được điểm danh / tổng số buổi của lớp" }, { label: "Quiz", value: role === "student" ? personal.quiz : course.quiz, detail: "Số bài đã đạt / tổng số Test và Assignment", color: "teal" }]} />}
      {role === "teacher" && course.totalLessons === 0 && <Card className="p-5"><h2 className="mb-3 text-lg font-semibold">Thiết lập số buổi cố định</h2><ActionForm submitLabel="Xác nhận số buổi" onSubmit={async data => { await run(actor.id, { type: "setLessonCount", classId, count: Number(data.get("count")) }); setMessage("Đã cố định số buổi giảng dạy."); }}><Field label="Tổng số buổi *" hint="Chỉ thiết lập một lần. Các buổi nghỉ phải có lịch học bù theo workflow."><input className="form-control" type="number" name="count" required min={1} max={500} step={1} /></Field></ActionForm></Card>}
    </div>}
    {!preview && tab === "students" && role !== "student" && <div className="space-y-4"><h2 className="text-xl font-semibold">Học viên trong lớp</h2><Field label="Tìm học viên trong lớp"><input className="form-control max-w-sm" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} /></Field>{members.length ? <DataTable caption="Danh sách học viên và tiến độ" columns={["Học viên", "Tài khoản", "Attendance", "Quiz", "Thao tác"]}>{members.map(student => { const progress = getStudentProgress(classId, student.id, state); return <tr key={student.id}><th scope="row" className="px-4 py-4 font-medium">{student.name}<p className="mt-1 text-xs font-normal text-muted-foreground">{student.email}</p></th><td className="px-4 py-4"><StatusBadge status={student.status === "suspended" ? "suspended" : "active"} /></td><td className="px-4 py-4">{progress.attendance}%</td><td className="px-4 py-4">{progress.quiz}%</td><td className="px-4 py-4"><ConfirmAction title={`Xóa ${student.name} khỏi lớp?`} description="Học viên mất quyền truy cập nội dung lớp. Tài khoản vẫn tồn tại và không bị vô hiệu hóa." trigger={`Xóa ${student.name} khỏi lớp`} onConfirm={async reason => { await run(actor.id, { type: "removeStudent", classId, studentId: student.id, reason }); setMessage(`Đã xóa ${student.name} khỏi lớp.`); }} /></td></tr>; })}</DataTable> : <EmptyState title="Không có học viên phù hợp" description="Học viên chỉ xuất hiện sau khi đăng ký được duyệt." />}</div>}
    {!preview && tab === "progress" && role !== "student" && <div className="grid items-start gap-6 lg:grid-cols-2"><ProgressCard title="Tiến độ giảng dạy" description="Số buổi cố định, không tăng số buổi khi tạo buổi bù." metrics={[{ label: course.name, value: course.totalLessons ? Math.round(course.completedLessons / course.totalLessons * 100) : 0, detail: `${course.completedLessons}/${course.totalLessons} buổi đã hoàn thành` }]} /><ProgressCard title="Tiến độ học tập của lớp" description="Trung bình tiến độ của các học viên đã được duyệt." metrics={[{ label: "Attendance", value: course.attendance, detail: "Điểm danh / tổng số buổi" }, { label: "Quiz", value: course.quiz, color: "teal", detail: "Bài đạt / tổng số Test và Assignment" }]} /></div>}
    {!preview && tab === "requests" && role === "teacher" && <EnrollmentQueue classId={classId} />}
    {!preview && tab === "lessons" && <LessonWorkspace role={role} classId={classId} />}
    {!preview && tab === "quizzes" && <Card className="p-5"><h2 className="text-xl font-semibold">Test & Assignment</h2><p className="my-3 text-sm text-muted-foreground">Chỉ xem thông tin; chưa mở bài làm, tạo Quiz hoặc duyệt Test retake trong Prompt 03.</p>{state.quizzes.filter(q => q.classId === classId).map(quiz => <article key={quiz.id} className="border-t border-border py-4 text-sm"><h3 className="font-medium">{quiz.title} · {quiz.kind === "test" ? "Test" : "Assignment"}</h3><p className="mt-1 text-muted-foreground">Điểm đạt {quiz.passingScore}/100 · Hạn: {formatDate(quiz.dueAt)}</p></article>)}{!state.quizzes.some(q => q.classId === classId) && <EmptyState title="Chưa có Quiz" description="Chức năng tạo bài thuộc phạm vi tiếp theo." />}</Card>}
    {!preview && tab === "schedule" && <ScheduleCalendar role={role} classId={classId} />}
    {!preview && tab === "materials" && <Card className="p-5"><h2 className="text-xl font-semibold">Course materials</h2>{expired ? <EmptyState title="Không thể truy cập tài liệu lớp hết hạn" description="Theo Workflow 10, tất cả vai trò bị chặn tài liệu khi lớp hết hạn." /> : <><p className="my-3 text-sm text-muted-foreground">Chỉ xem danh mục trong Prompt 03; chưa upload, xóa hoặc tải tệp tài liệu.</p>{materials.length ? materials.map(material => <article key={material.id} className="border-t border-border py-4 text-sm"><h3 className="font-medium">{material.title}</h3><p className="mt-1 text-muted-foreground">{material.lessonId ? state.lessons.find(l => l.id === material.lessonId)?.name : "Tài liệu chung toàn khóa"} · {material.kind === "video" ? "Video" : "Tài liệu"}</p>{material.expiresAt && Date.parse(material.expiresAt) <= now && material.kind !== "video" && <StatusBadge status="expired" />}</article>) : <EmptyState title="Chưa có tài liệu" description="Tài liệu của lớp sẽ xuất hiện tại đây." />}</>}</Card>}
    {role === "admin" && <Dialog open={edit} onOpenChange={setEdit} title="Chỉnh sửa lớp học" description="Xác nhận thay đổi phân công sẽ chuyển quyền xử lý các yêu cầu đang chờ ngay lập tức."><ClassForm key={course.id} course={course} onCancel={() => setEdit(false)} onSaved={() => { setEdit(false); setMessage("Đã cập nhật lớp học."); }} /></Dialog>}
  </div>;
}
