"use client";
import { useState } from "react";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { canAccessClass, isExpired } from "@/mocks/services/management";
import { getLessonStatus } from "@/mocks/services/lessons";
import { ActionForm, Feedback, Field } from "@/components/shared/management-ui";
import { EmptyState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/features/dashboard/dashboard-parts";
import { LessonForm } from "./lesson-form";
import { LessonAttendance } from "./lesson-attendance";
import { LessonStatus, localLessonTime, utcLessonTime } from "./lesson-status";

export function LessonWorkspace({ role, classId }: { role: Role; classId: string }) {
  const { state, now, account, run } = useLms();
  const actor = account(role);
  const [selected, setSelected] = useState("");
  const [editor, setEditor] = useState<string | null>(null);
  const [makeup, setMakeup] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const course = state.classes.find(c => c.id === classId);
  const current = { ...state, referenceTime: new Date(now).toISOString() };
  if (!course || !canAccessClass(current, actor.id, classId) || (role === "student" && isExpired(course, now))) return <EmptyState title="Không thể truy cập buổi học" description="Bạn cần quyền truy cập lớp còn hạn để xem nội dung này." />;
  const expired = isExpired(course, now);
  const lessons = state.lessons.filter(l => l.classId === classId && (role !== "student" || l.completed || state.schedules.some(s => s.lessonId === l.id && ["approved", "confirmed"].includes(s.status))));
  const lesson = lessons.find(l => l.id === selected);
  const schedule = lesson && state.schedules.find(s => s.lessonId === lesson.id && ["approved", "confirmed", "cancelled"].includes(s.status));
  const draft = lesson?.draft;
  const shownDraft = role !== "student" && !schedule ? draft : undefined;
  const materialIds = shownDraft?.materialIds ?? lesson?.materialIds ?? [];
  const status = lesson ? getLessonStatus(state, lesson.id, now) : "draft";
  const pending = lesson && state.requests.some(r => r.lessonId === lesson.id && ["schedule", "teacher-leave"].includes(r.kind) && r.status === "waiting");
  const editable = role === "teacher" && !expired && !!lesson && !lesson.completed && status !== "active" && status !== "completed" && !pending;
  const canConfirm = !!schedule && schedule.status === "approved" && Date.parse(schedule.startsAt) - now >= 86400000 && !expired;
  const canMakeup = !!schedule && (["approved", "confirmed"].includes(schedule.status) ? Date.parse(schedule.startsAt) - now >= 86400000 : schedule.status === "cancelled") && !pending && !expired;
  const available = state.lessons.some(l => l.classId === classId && !l.completed && !l.draft && !state.schedules.some(s => s.lessonId === l.id));
  const requests = lesson ? state.requests.filter(r => r.lessonId === lesson.id && ["schedule", "teacher-leave"].includes(r.kind)) : [];
  return <section className="space-y-5" aria-label="Buổi học và điểm danh">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Buổi học</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{course.totalLessons} buổi cố định · Lịch và giờ học dùng UTC+7.</p></div>{role === "teacher" && <Button disabled={!available || expired} onClick={() => setEditor("new")}>Tạo buổi học</Button>}</div>
    <Feedback message={message} />
    <Feedback message={error} error />
    {expired && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Lớp đã hết hạn. Chỉ xem dữ liệu; không tạo hoặc thay đổi buổi học.</p>}
    {!lessons.length ? <EmptyState title={role === "student" ? "Chưa có buổi học được duyệt" : "Chưa có buổi học"} description={role === "student" ? "Buổi học sẽ hiển thị khi Admin duyệt lịch. Bạn cần chờ giảng viên xác nhận trước khi tham gia." : "Thiết lập tổng số buổi cố định trong Tổng quan lớp trước khi tạo nội dung và lịch học."} /> : <div className="grid items-start gap-5 xl:grid-cols-[minmax(240px,0.75fr)_minmax(0,2fr)]"><Card className="min-w-0 overflow-hidden"><ul className="divide-y divide-border">{lessons.map(l => {
      const s = state.schedules.find(s => s.lessonId === l.id && s.status !== "cancelled");
      return <li key={l.id}><button type="button" aria-pressed={selected === l.id} onClick={() => { setSelected(l.id); setMessage(""); setError(""); }} className={`w-full space-y-2 p-4 text-left transition-colors hover:bg-blue-50 ${selected === l.id ? "bg-blue-50 ring-2 ring-inset ring-blue-500" : ""}`}><span className="block text-sm font-semibold">{role !== "student" && l.draft ? l.draft.title : l.name}</span><LessonStatus status={getLessonStatus(state, l.id, now)} /><span className="block text-xs leading-5 text-muted-foreground">{s ? formatDate(s.startsAt) : l.draft ? formatDate(l.draft.startsAt) : "Chưa thiết lập lịch"}</span></button></li>;
    })}</ul></Card>
      {lesson ? <div className="min-w-0 space-y-5"><Card className="space-y-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-xl font-semibold">{shownDraft?.title ?? lesson.name}</h3><LessonStatus status={status} /></div><p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{lesson.description || (role !== "student" ? draft?.description : "") || "Chưa có mô tả buổi học."}</p>
        {schedule ? <div className="rounded-xl bg-slate-50 p-4 text-sm leading-7"><p><strong>Bắt đầu:</strong> {formatDate(schedule.startsAt)} (UTC+7)</p><p><strong>Kết thúc:</strong> {formatDate(schedule.endsAt)} (UTC+7)</p>{schedule.status === "approved" && <p className="text-amber-800">Lịch đã duyệt, đang chờ giảng viên xác nhận. Chưa mở điểm danh.</p>}</div> : <p className="text-sm text-muted-foreground">Chưa có lịch đã được duyệt.</p>}
        {role !== "student" && draft && <div className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6"><p className="font-medium">{pending ? "Đề xuất đang chờ Admin duyệt" : "Bản nháp / Đề xuất"}: {draft.title}</p><p>{formatDate(draft.startsAt)} — {formatDate(draft.endsAt)} (UTC+7)</p><p>Lịch hiện tại vẫn có hiệu lực cho đến khi Admin duyệt đề xuất.</p></div>}
        {role === "teacher" && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!editable} onClick={() => setEditor(lesson.id)}>Chỉnh sửa bản nháp</Button>{draft && <Button disabled={!editable} onClick={async () => { try { setError(""); await run(actor.id, { type: "submitSchedule", lessonId: lesson.id }); setMessage("Đã gửi lịch học cho Admin duyệt."); } catch (error) { setError(error instanceof Error ? error.message : "Không thể gửi lịch."); } }}>Gửi Admin duyệt lịch</Button>}{schedule?.status === "approved" && <Button disabled={!canConfirm} onClick={async () => { try { setError(""); await run(actor.id, { type: "confirmLesson", lessonId: lesson.id }); setMessage("Đã xác nhận buổi học và thông báo cho học viên."); } catch (error) { setError(error instanceof Error ? error.message : "Không thể xác nhận."); } }}>Xác nhận diễn ra</Button>}{schedule && <Button variant="outline" disabled={!canMakeup} onClick={() => setMakeup(true)}>Xin nghỉ & đề xuất học bù</Button>}</div>}
        {role === "teacher" && schedule?.status === "approved" && !canConfirm && <p className="text-sm leading-6 text-amber-800">Cần xác nhận ít nhất 24 giờ trước giờ học. Khi quá hạn, liên hệ Admin xử lý.</p>}
        <div className="space-y-2 border-t border-border pt-4"><h4 className="text-sm font-semibold">Tài liệu đính kèm</h4>{expired ? <p className="text-sm text-muted-foreground">Tài liệu không còn truy cập được khi lớp hết hạn.</p> : state.materials.filter(m => m.classId === classId && materialIds.includes(m.id)).map(m => <p key={m.id} className="text-sm text-slate-600">{m.title} · {m.kind === "video" ? "Video" : "Tài liệu"}</p>)}{!expired && !materialIds.length && <p className="text-sm text-muted-foreground">Chưa đính kèm tài liệu.</p>}</div>
        {role !== "student" && requests.length > 0 && <div className="space-y-3 border-t border-border pt-4"><h4 className="text-sm font-semibold">Lịch sử yêu cầu</h4>{requests.map(r => <article key={r.id} className="text-sm leading-6"><p className="font-medium">{r.title} · {r.status === "waiting" ? "Chờ duyệt" : r.status === "approved" ? "Đã duyệt" : r.status === "declined" ? "Bị từ chối" : "Đã hủy"}</p>{r.resolutionReason && <p className="text-red-700">Lý do: {r.resolutionReason}</p>}</article>)}</div>}
      </Card>{!expired && <LessonAttendance key={`${actor.id}-${lesson.id}`} role={role} lessonId={lesson.id} classId={classId} />}</div> : <EmptyState title="Chọn một buổi học" description="Xem lịch học, tài liệu đính kèm và trạng thái điểm danh tại đây." />}
    </div>}
    {role === "teacher" && <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }} title={editor === "new" ? "Tạo buổi học" : "Chỉnh sửa buổi học"} description="Lưu bản nháp, sau đó gửi Admin duyệt lịch. Không thay đổi tổng số buổi cố định.">{editor !== null && <LessonForm key={editor} classId={classId} lesson={state.lessons.find(l => l.id === editor)} onCancel={() => setEditor(null)} onSaved={id => { setEditor(null); setSelected(id); setMessage("Đã lưu bản nháp. Gửi Admin duyệt để lịch có hiệu lực."); }} />}</Dialog>}
    {role === "teacher" && lesson && <Dialog open={makeup} onOpenChange={setMakeup} title="Xin nghỉ & đề xuất học bù" description="Phải gửi thời gian học bù cùng lý do, ít nhất 24 giờ trước buổi học. Lịch bù dùng lại buổi cố định này."><MakeupForm key={lesson.id} startsAt={schedule?.startsAt} endsAt={schedule?.endsAt} onCancel={() => setMakeup(false)} onSubmit={async (startsAt, endsAt, reason) => { await run(actor.id, { type: "requestMakeup", lessonId: lesson.id, startsAt, endsAt, reason }); setMakeup(false); setMessage("Đã gửi yêu cầu nghỉ và lịch học bù cho Admin duyệt."); }} /></Dialog>}
    <p className="text-xs leading-5 text-muted-foreground">Mô phỏng lưu trên trình duyệt; thông báo theo giờ và đồng bộ nhiều người dùng thực tế cần backend.</p>
  </section>;
}

function MakeupForm({ startsAt, endsAt, onCancel, onSubmit }: { startsAt?: string; endsAt?: string; onCancel: () => void; onSubmit: (start: string, end: string, reason: string) => Promise<void> }) {
  const [start, setStart] = useState(localLessonTime(startsAt));
  const [end, setEnd] = useState(localLessonTime(endsAt));
  const [reason, setReason] = useState("");
  return <ActionForm submitLabel="Gửi yêu cầu nghỉ và lịch bù" onCancel={onCancel} onSubmit={async () => onSubmit(utcLessonTime(start), utcLessonTime(end), reason)}><Field label="Lý do nghỉ *"><textarea required maxLength={1000} className="form-control min-h-24" value={reason} onChange={e => setReason(e.target.value)} /></Field><Field label="Bắt đầu buổi bù (UTC+7) *"><input required type="datetime-local" className="form-control" value={start} onChange={e => setStart(e.target.value)} /></Field><Field label="Kết thúc buổi bù (UTC+7) *"><input required type="datetime-local" min={start} className="form-control" value={end} onChange={e => setEnd(e.target.value)} /></Field></ActionForm>;
}




