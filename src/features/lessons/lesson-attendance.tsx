"use client";
import { useState } from "react";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { getAttendanceStatus, getLessonStatus } from "@/mocks/services/lessons";
import { ActionForm, ConfirmAction, DataTable, Feedback, Field } from "@/components/shared/management-ui";
import { Card } from "@/components/ui/card";

export function LessonAttendance({ role, lessonId, classId }: { role: Role; lessonId: string; classId: string }) {
  const { state, now, account, run } = useLms();
  const actor = account(role);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const mine = getAttendanceStatus(state, lessonId, actor.id, now);
  const lesson = state.lessons.find(l => l.id === lessonId)!;
  const schedule = state.schedules.find(s => s.lessonId === lessonId && ["approved", "confirmed"].includes(s.status));
  const active = getLessonStatus(state, lessonId, now) === "active";
  const roster = state.enrollments.filter(e => e.classId === classId && e.status === "approved").map(e => state.users.find(u => u.id === e.studentId)).filter(u => !!u);
  if (role === "student") return <Card className="space-y-4 p-5"><h3 className="text-lg font-semibold">Điểm danh của bạn</h3><Feedback message={message} />
    {mine.recorded ? <Feedback message="Đã điểm danh thành công" /> : mine.absence ? <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6">Đã tự động duyệt nghỉ học. Attendance không được tính; kết quả Quiz được tính riêng.</p> : <>
      {mine.open && !mine.locked ? <ActionForm submitLabel="Xác nhận điểm danh" onSubmit={async () => { await run(actor.id, { type: "enterAttendance", lessonId, code }); setCode(""); }}><Field label="Mã điểm danh *" hint="Mã được hiển thị để bạn kiểm tra trước khi gửi. Tối đa 3 lần nhập sai."><input type="text" autoComplete="off" required value={code} onChange={e => setCode(e.target.value)} className="form-control max-w-sm" /></Field></ActionForm> : <p className="text-sm leading-6 text-muted-foreground">{mine.locked ? "Bạn đã nhập sai 3 lần. Liên hệ giảng viên để xác minh và điểm danh thủ công trong giờ học." : "Điểm danh chỉ mở trong thời gian buổi học đã được xác nhận."}</p>}
      {mine.feedback && <Feedback message={mine.feedback} error={mine.failures > 0} />}
      {mine.failures > 0 && !mine.locked && <p className="text-sm">Còn {mine.remaining} lượt nhập.</p>}
      {schedule && now < Date.parse(schedule.endsAt) && <ConfirmAction title="Xin nghỉ buổi học" trigger="Xin nghỉ học" description="Yêu cầu tự động được duyệt và lý do được gửi cho giảng viên. Bạn không được tính Attendance cho buổi này." onConfirm={async reason => { await run(actor.id, { type: "requestAbsence", lessonId, reason }); setMessage("Đã gửi lý do và tự động duyệt nghỉ học."); }} />}
    </>}
  </Card>;
  return <Card className="space-y-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Quản lý Attendance</h3><p className="mt-1 text-sm text-muted-foreground">Chỉ ghi nhận thủ công trong thời gian buổi học đã xác nhận.</p></div>{role === "teacher" && <p className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-900">Mã demo: <strong className="font-mono tracking-wider">{lesson.attendanceCode || "Chưa thiết lập"}</strong></p>}</div><Feedback message={message} />
    {roster.length ? <DataTable caption="Điểm danh học viên" columns={["Học viên", "Trạng thái Attendance", "Nhập mã", "Thao tác"]}>{roster.map(student => {
      const status = getAttendanceStatus(state, lessonId, student.id, now);
      const correction = state.requests.find(r => r.kind === "attendance-correction" && r.lessonId === lessonId && r.studentId === student.id && r.status === "waiting");
      const absence = state.requests.find(r => r.kind === "absence" && r.lessonId === lessonId && r.senderId === student.id);
      return <tr key={student.id}><th scope="row" className="px-4 py-4 font-medium">{student.name}<p className="mt-1 text-xs font-normal text-muted-foreground">{student.email}</p></th><td className="px-4 py-4">{status.recorded ? "Đã điểm danh" : status.absence ? "Đã xin nghỉ" : "Chưa điểm danh"}{absence && <p className="mt-1 text-xs leading-5 text-muted-foreground">Lý do nghỉ: {absence.description}</p>}</td><td className="px-4 py-4">{status.failures}/3 lần sai{status.locked && <p className="mt-1 text-xs text-red-700">Đã khóa nhập mã</p>}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2">
        {role === "teacher" && !status.recorded && !status.absence && active && student.status !== "suspended" && <ConfirmAction title={`Điểm danh ${student.name}`} trigger="Điểm danh thủ công" description="Xác minh học viên có tham gia trước khi ghi nhận Attendance, kể cả khi đã nhập sai mã 3 lần." onConfirm={async reason => { await run(actor.id, { type: "manualAttendance", lessonId, studentId: student.id, reason }); setMessage(`Đã điểm danh cho ${student.name}.`); }} />}
        {role === "teacher" && status.recorded && !correction && <ConfirmAction title="Yêu cầu xóa Attendance" trigger="Yêu cầu xóa" description="Attendance hiện tại giữ nguyên cho đến khi Admin duyệt yêu cầu." onConfirm={async reason => { await run(actor.id, { type: "requestAttendanceCorrection", lessonId, studentId: student.id, reason }); setMessage("Đã gửi yêu cầu xóa Attendance cho Admin."); }} />}
        {correction && <span className="text-xs text-amber-800">Yêu cầu xóa đang chờ duyệt</span>}
        {role === "admin" && status.recorded && <ConfirmAction title={`Xóa Attendance của ${student.name}?`} trigger="Xóa Attendance" description="Kết quả và tiến độ Attendance sẽ giảm ngay sau khi xác nhận." onConfirm={async reason => { await run(actor.id, { type: "removeAttendance", lessonId, studentId: student.id, reason }); setMessage(`Đã xóa Attendance của ${student.name}.`); }} />}
        {!status.recorded && !active && <span className="text-xs text-muted-foreground">Ngoài thời gian điểm danh</span>}
      </div></td></tr>;
    })}</DataTable> : <p className="text-sm text-muted-foreground">Lớp chưa có học viên đã được duyệt.</p>}
    <p className="text-xs leading-5 text-muted-foreground">Đây là mô phỏng trong trình duyệt. Xác minh tham gia và bảo mật điểm danh thực tế cần backend.</p>
  </Card>;
}
