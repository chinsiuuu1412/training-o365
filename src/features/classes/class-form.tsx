"use client";
import { useState } from "react";
import type { Class } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { dateInBangkok } from "@/mocks/services/management";
import { ActionForm, Field } from "@/components/shared/management-ui";

export function ClassForm({ course, onSaved, onCancel }: { course?: Class; onSaved: () => void; onCancel: () => void }) {
  const { state, account, run, now } = useLms();
  const [teacherId, setTeacherId] = useState(course?.teacherId ?? "");
  const changed = !!course && teacherId !== course.teacherId;
  return <ActionForm submitLabel={changed ? "Xác nhận đổi giảng viên và lưu" : "Lưu lớp học"} onCancel={onCancel} onSubmit={async data => {
    await run(account("admin").id, { type: "saveClass", reason: String(data.get("reason") ?? ""), course: { id: course?.id ?? "", name: String(data.get("name")), code: String(data.get("code")), description: String(data.get("description")), teacherId, capacity: Number(data.get("capacity")), expiresAt: String(data.get("expiresAt")), attendanceThreshold: Number(data.get("attendanceThreshold")), quizThreshold: Number(data.get("quizThreshold")), totalLessons: course?.totalLessons ?? 0, color: course?.color ?? "blue" } }); onSaved();
  }}>
    <Field label="Tên lớp *"><input name="name" required maxLength={150} className="form-control" defaultValue={course?.name} /></Field>
    <Field label="Mã lớp *"><input name="code" required maxLength={30} className="form-control" defaultValue={course?.code} /></Field>
    <Field label="Mô tả nội dung giảng dạy *"><textarea name="description" required maxLength={2000} className="form-control min-h-24" defaultValue={course?.description} /></Field>
    <Field label="Giảng viên phụ trách *"><select required className="form-control" value={teacherId} onChange={e => setTeacherId(e.target.value)}><option value="">Chọn giảng viên</option>{state.users.filter(u => u.role === "teacher" && (u.status !== "suspended" || u.id === course?.teacherId)).map(u => <option key={u.id} value={u.id}>{u.name}{u.status === "suspended" ? " · Đã vô hiệu hóa" : ""}</option>)}</select></Field>
    {changed && <><p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">Sau khi xác nhận, giảng viên mới nhận toàn bộ yêu cầu đang chờ của lớp ngay lập tức. Tài liệu, học viên và tiến độ giữ nguyên.</p><Field label="Lý do đổi giảng viên *"><textarea name="reason" required maxLength={1000} className="form-control" /></Field></>}
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Sĩ số tối đa *"><input name="capacity" type="number" min={1} step={1} required className="form-control" defaultValue={course?.capacity ?? 30} /></Field><Field label="Ngày hết hạn *"><input name="expiresAt" type="date" min={dateInBangkok(now)} required className="form-control" defaultValue={course?.expiresAt} /></Field></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Attendance tối thiểu (%) *"><input name="attendanceThreshold" type="number" min={0} max={100} required className="form-control" defaultValue={course?.attendanceThreshold ?? 80} /></Field><Field label="Quiz tối thiểu (%) *"><input name="quizThreshold" type="number" min={0} max={100} required className="form-control" defaultValue={course?.quizThreshold ?? 70} /></Field></div>
    <p className="text-xs leading-5 text-muted-foreground">Học viên cần đạt cả hai tiêu chí. Giảng viên thiết lập số buổi cố định sau khi được phân công lớp mới.</p>
  </ActionForm>;
}
