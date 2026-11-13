"use client";
import { useState } from "react";
import type { Class, Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { getDashboard, getStudentDashboard } from "@/mocks/services/dashboard";
import { getEnrollmentState, isExpired } from "@/mocks/services/management";
import { ClassCard } from "@/components/shared/class-card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Feedback, Field } from "@/components/shared/management-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EnrollmentAction } from "@/features/enrollments/enrollment-action";
import { ClassForm } from "./class-form";
import { formatDate } from "@/features/dashboard/dashboard-parts";

export function ClassesList({ role }: { role: Role }) {
  const { state, account, now } = useLms(); const actor = account(role);
  const [view, setView] = useState("registered"); const [query, setQuery] = useState(""); const [filter, setFilter] = useState("all"); const [teacher, setTeacher] = useState("all");
  const [editing, setEditing] = useState<Class | "new" | null>(null); const [message, setMessage] = useState("");
  const rows = getDashboard(state).classes.filter(c => {
    if (role === "teacher" && c.teacherId !== actor.id) return false;
    const enrollment = getEnrollmentState(state, c.id, actor.id, now);
    if (role === "student" && (view === "find" ? isExpired(c, now) : view === "requests" ? !["pending", "declined", "cancelled"].includes(enrollment.status) : enrollment.status !== "approved")) return false;
    if (!`${c.name} ${c.code} ${c.teacher.name}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))) return false;
    if (teacher !== "all" && c.teacherId !== teacher) return false;
    if (filter === "expired") return isExpired(c, now);
    if (filter === "active") return !isExpired(c, now);
    if (filter === "full") return enrollment.full;
    if (filter === "open") return !enrollment.full && !enrollment.expired;
    if (filter === "pending" || filter === "declined") return enrollment.status === filter;
    return true;
  });
  const upcoming = getStudentDashboard(actor.id, { ...state, referenceTime: new Date(now).toISOString() }).upcomingLessons;
  return <div className="dashboard-page management-content space-y-6"><PageHeader eyebrow={role === "admin" ? "Quản lý đào tạo" : role === "teacher" ? "Không gian giảng dạy" : "Không gian học tập"} title={role === "teacher" ? "Lớp phụ trách" : "Lớp học"} description={role === "student" ? "Tìm lớp phù hợp, gửi yêu cầu và theo dõi đăng ký của bạn." : "Theo dõi lớp học, thành viên và tiến độ từ dữ liệu dùng chung."} actions={role === "admin" ? <Button onClick={() => setEditing("new")}>Tạo lớp học</Button> : undefined} />
    <Feedback message={message} />
    {role === "student" && <div className="flex flex-wrap gap-2" aria-label="Danh sách lớp học"><Button variant={view === "registered" ? "default" : "outline"} aria-pressed={view === "registered"} onClick={() => { setView("registered"); setFilter("all"); }}>Registered Classes · Lớp đã đăng ký</Button><Button variant={view === "find" ? "default" : "outline"} aria-pressed={view === "find"} onClick={() => { setView("find"); setFilter("all"); }}>Find Classes · Tìm lớp</Button><Button variant={view === "requests" ? "default" : "outline"} aria-pressed={view === "requests"} onClick={() => { setView("requests"); setFilter("all"); }}>Yêu cầu của tôi</Button></div>}
    <Card className="flex flex-wrap items-end gap-4 p-5"><Field label="Tìm lớp học"><input className="form-control sm:w-64" placeholder="Tên lớp, mã hoặc giảng viên" value={query} onChange={e => setQuery(e.target.value)} /></Field><Field label="Lọc lớp học"><select className="form-control" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tất cả</option>{role === "student" && view === "find" ? <><option value="open">Còn chỗ</option><option value="full">Đủ sĩ số</option><option value="pending">Chờ duyệt</option><option value="declined">Đã từ chối</option></> : <><option value="active">Còn thời hạn</option><option value="expired">Đã hết hạn</option></>}</select></Field><Field label="Giảng viên"><select className="form-control" value={teacher} onChange={e => setTeacher(e.target.value)}><option value="all">Tất cả giảng viên</option>{state.users.filter(u => u.role === "teacher" && (role !== "teacher" || u.id === actor.id)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field></Card>
    <p className="text-sm text-muted-foreground" aria-live="polite">{rows.length} lớp phù hợp{role === "student" && view === "find" ? " · Lớp hết hạn không xuất hiện trong tìm kiếm" : ""}</p>
    {rows.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(course => {
      const expired = isExpired(course, now);
      const enrollment = getEnrollmentState(state, course.id, actor.id, now);
      const next = role === "student" ? (upcoming.find(l => l.classId === course.id) ?? state.schedules.filter(s => s.status === "confirmed" && Date.parse(s.startsAt) > now && state.lessons.find(l => l.id === s.lessonId)?.classId === course.id).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]) : undefined;
      return <ClassCard key={course.id} course={course} registered={role === "student" && enrollment.status === "approved"} expired={expired} href={role === "student" && expired ? undefined : `/${role}/classes/${course.id}`} actions={<>
        {role === "admin" && <Button variant="outline" size="sm" onClick={() => setEditing(course)}>Sửa lớp {course.code}</Button>}
        {role === "student" && <><p className="text-sm leading-6 text-muted-foreground">{course.description}</p><p className="text-xs text-muted-foreground">Hết hạn: {course.expiresAt}{next ? ` · Buổi tới: ${formatDate(next.startsAt)}` : " · Chưa có buổi tiếp theo xác nhận"}</p><EnrollmentAction classId={course.id} /></>}
      </>} />;
    })}</div> : <EmptyState title="Chưa có lớp phù hợp" description="Thay đổi bộ lọc hoặc tìm kiếm. Lớp được phân công/đăng ký sẽ xuất hiện tại đây." />}
    <Dialog title={editing === "new" ? "Tạo lớp học" : "Chỉnh sửa lớp học"} description="Thông tin lớp và phân công được cập nhật đồng thời cho các vai trò." open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }}>{editing && <ClassForm key={editing === "new" ? "new" : editing.id} course={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage("Đã lưu thông tin lớp học."); }} />}</Dialog>
  </div>;
}
