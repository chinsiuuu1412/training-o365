"use client";
import { useState } from "react";
import Link from "next/link";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { canAccessClass } from "@/mocks/services/management";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { formatDate } from "@/features/dashboard/dashboard-parts";

export function ScheduleCalendar({ role, classId }: { role: Role; classId?: string }) {
  const { state, now, account } = useLms();
  const today = new Date(now + 7 * 3600000);
  const [month, setMonth] = useState(() => today.toISOString().slice(0, 7));
  const [selected, setSelected] = useState("");
  const [year, number] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const snapshot = { ...state, referenceTime: new Date(now).toISOString() };
  const entries = state.schedules.filter(s => {
    const lesson = state.lessons.find(l => l.id === s.lessonId);
    return lesson && (!classId || lesson.classId === classId) && canAccessClass(snapshot, account(role).id, lesson.classId) && (role !== "student" || ["approved", "confirmed"].includes(s.status));
  });
  const localDay = (value: string) => new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 10);
  const visible = entries.filter(s => localDay(s.startsAt).startsWith(month) && (!selected || localDay(s.startsAt) === selected)).sort((a,b) => Date.parse(a.startsAt)-Date.parse(b.startsAt));
  function move(amount: number) { const date = new Date(Date.UTC(year, number - 1 + amount, 1)); setMonth(date.toISOString().slice(0,7)); setSelected(""); }
  return <div className="space-y-5"><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Lịch mô phỏng · UTC+7. Lịch đã duyệt có thể đang chờ giảng viên xác nhận. Điểm danh chỉ mở khi đã xác nhận và đúng thời gian.</p><Card className="p-4 sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Lịch học · {number}/{year}</h2><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={()=>move(-1)} aria-label="Tháng trước">←</Button><Button variant="outline" size="sm" onClick={()=>{setMonth(today.toISOString().slice(0,7));setSelected("");}}>Hôm nay</Button><Button variant="outline" size="sm" onClick={()=>move(1)} aria-label="Tháng sau">→</Button></div></div><div className="grid grid-cols-7 gap-1 text-center text-xs">{["T2","T3","T4","T5","T6","T7","CN"].map(day=><span key={day} className="py-2 font-semibold text-muted-foreground">{day}</span>)}{Array.from({length:offset},(_,i)=><span key={`blank${i}`} />)}{Array.from({length:days},(_,index)=>{const day=`${month}-${String(index+1).padStart(2,"0")}`;const count=entries.filter(s=>localDay(s.startsAt)===day).length;return <button key={day} aria-label={`${day}, ${count} buổi học`} aria-pressed={selected===day} onClick={()=>setSelected(selected===day?"":day)} className={`min-h-14 rounded-lg border p-1 transition-colors ${selected===day?"border-primary bg-blue-50 text-primary":"border-border hover:bg-slate-50"}`}><span className="block">{index+1}</span>{count>0&&<span className="mt-1 block text-[10px] font-semibold text-primary">{count} buổi</span>}</button>;})}</div></Card>{visible.length?<div className="space-y-3">{visible.map(schedule=>{const lesson=state.lessons.find(l=>l.id===schedule.lessonId)!;const course=state.classes.find(c=>c.id===lesson.classId)!;return <Card key={schedule.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h3 className="font-semibold">{lesson.name} · {course.name}</h3><p className="mt-2 text-sm text-muted-foreground">{formatDate(schedule.startsAt)} — {formatDate(schedule.endsAt)}</p><p className="mt-1 text-xs text-primary">{schedule.status==="approved"?"Đã duyệt · Chờ giảng viên xác nhận":schedule.status==="confirmed"?"Đã xác nhận":schedule.status}</p></div><Button asChild variant="outline" size="sm"><Link href={`/${role}/classes/${course.id}?tab=lessons`}>Chi tiết buổi học</Link></Button></Card>;})}</div>:<EmptyState title="Không có buổi học trong thời gian đã chọn" description="Chuyển tháng hoặc bỏ chọn ngày để xem các buổi khác." />}</div>;
}
