"use client";
import { useState } from "react";
import type { Lesson } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { ActionForm, Field } from "@/components/shared/management-ui";
import { localLessonTime, utcLessonTime } from "./lesson-status";

export function LessonForm({ classId, lesson, onSaved, onCancel }: { classId: string; lesson?: Lesson; onSaved: (lessonId: string) => void; onCancel: () => void }) {
  const { state, account, run, now } = useLms();
  const course = state.classes.find(c => c.id === classId)!;
  const schedule = state.schedules.find(s => s.lessonId === lesson?.id && s.status !== "cancelled");
  const draft = lesson?.draft;
  const slots = state.lessons.filter(l => l.classId === classId && !l.completed && (l.id === lesson?.id || (!l.draft && !state.schedules.some(s => s.lessonId === l.id))));
  const [selectedClass, setClass] = useState(classId);
  const [slot, setSlot] = useState(lesson?.id ?? slots[0]?.id ?? "");
  const [title, setTitle] = useState(draft?.title ?? lesson?.name ?? "");
  const [description, setDescription] = useState(draft?.description ?? lesson?.description ?? "");
  const [startsAt, setStartsAt] = useState(localLessonTime(draft?.startsAt ?? schedule?.startsAt));
  const [endsAt, setEndsAt] = useState(localLessonTime(draft?.endsAt ?? schedule?.endsAt));
  const [materialIds, setMaterialIds] = useState<string[]>(draft?.materialIds ?? lesson?.materialIds ?? []);
  const [code, setCode] = useState(draft?.attendanceCode ?? lesson?.attendanceCode ?? "");
  return <ActionForm submitLabel="Lưu bản nháp" onCancel={onCancel} onSubmit={async () => {
    await run(account("teacher").id, { type: "saveLesson", lessonId: slot, classId: selectedClass, title, description, startsAt: utcLessonTime(startsAt), endsAt: utcLessonTime(endsAt), materialIds, attendanceCode: code }); onSaved(slot);
  }}>
    <Field label="Lớp học *"><select required value={selectedClass} onChange={e => setClass(e.target.value)} className="form-control"><option value={course.id}>{course.code} · {course.name}</option></select></Field>
    <Field label="Buổi học cố định *" hint="Dùng một buổi chưa hoàn thành trong tổng số buổi đã thiết lập."><select required disabled={!!lesson} value={slot} onChange={e => setSlot(e.target.value)} className="form-control"><option value="">Chọn buổi học</option>{slots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
    <Field label="Tên buổi học *"><input required maxLength={150} value={title} onChange={e => setTitle(e.target.value)} className="form-control" /></Field>
    <Field label="Mô tả *"><textarea required maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} className="form-control min-h-24" /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Bắt đầu (UTC+7) *"><input required type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} className="form-control" /></Field><Field label="Kết thúc (UTC+7) *"><input required type="datetime-local" min={startsAt} value={endsAt} onChange={e => setEndsAt(e.target.value)} className="form-control" /></Field></div>
    <Field label="Mã điểm danh demo *" hint="Mã hiển thị rõ; chỉ hợp lệ trong thời gian buổi học đã xác nhận. Bảo mật mã thực tế cần backend."><input required type="text" maxLength={30} autoComplete="off" value={code} onChange={e => setCode(e.target.value)} className="form-control" /></Field>
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Đính kèm tài liệu đã có trong lớp</legend>{state.materials.filter(m => m.classId === classId).map(m => <label key={m.id} className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={!!m.expiresAt && Date.parse(m.expiresAt) <= now && !materialIds.includes(m.id)} checked={materialIds.includes(m.id)} onChange={e => setMaterialIds(e.target.checked ? [...materialIds, m.id] : materialIds.filter(id => id !== m.id))} />{m.title}{m.expiresAt && Date.parse(m.expiresAt) <= now ? " · Đã hết hạn" : ""}</label>)}{!state.materials.some(m => m.classId === classId) && <p className="text-sm text-muted-foreground">Lớp chưa có tài liệu để đính kèm.</p>}</fieldset>
    {schedule && ["approved", "confirmed"].includes(schedule.status) && <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">Đây là đề xuất chỉnh sửa. Lịch đã duyệt hiện tại vẫn có hiệu lực cho đến khi Admin duyệt đề xuất mới. Sau khi lưu, gửi đề xuất để duyệt.</p>}
  </ActionForm>;
}

