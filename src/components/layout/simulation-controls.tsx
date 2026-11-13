"use client";
import { useState } from "react";
import { useLms } from "@/state/lms-provider";
import { ConfirmAction, Feedback } from "@/components/shared/management-ui";
import { formatDate } from "@/features/dashboard/dashboard-parts";

export function SimulationControls() {
  const { state, now, simulateTime } = useLms();
  const [scheduleId,setScheduleId]=useState(""); const [phase,setPhase]=useState("before"); const [feedback,setFeedback]=useState("");
  const schedule=state.schedules.find(s=>s.id===scheduleId) ?? state.schedules.find(s=>s.status==="confirmed" || s.status==="approved");
  const target=schedule ? phase==="end"?Date.parse(schedule.endsAt)+1000:phase==="start"?Date.parse(schedule.startsAt)+60000:Date.parse(schedule.startsAt)-25*3600000 : now;
  return <details className="mt-3 border-t border-border pt-3"><summary className="cursor-pointer text-xs font-medium text-amber-800">Điều khiển thời gian mô phỏng · {formatDate(new Date(now).toISOString())}</summary><div className="mt-3 space-y-3"><p className="text-xs leading-5 text-muted-foreground">Chỉ phục vụ demo, đồng bộ mọi vai trò/tab. Xác minh thời hạn và mã thật cần backend. Đổi mốc không xóa dữ liệu.</p><div className="flex flex-wrap items-end gap-3"><label className="grid max-w-full gap-1 text-xs">Buổi học<select className="form-control max-w-full sm:max-w-80" aria-label="Buổi học mô phỏng" value={schedule?.id??""} onChange={e=>setScheduleId(e.target.value)}>{state.schedules.filter(s=>!["draft","declined","cancelled"].includes(s.status)).map(s=><option value={s.id} key={s.id}>{state.lessons.find(l=>l.id===s.lessonId)?.name} · {state.classes.find(c=>c.id===state.lessons.find(l=>l.id===s.lessonId)?.classId)?.name}</option>)}</select></label><label className="grid gap-1 text-xs">Mốc mô phỏng<select className="form-control" value={phase} onChange={e=>setPhase(e.target.value)}><option value="before">Trước giờ học 25 giờ</option><option value="start">Trong giờ học</option><option value="end">Sau giờ kết thúc</option></select></label>{schedule&&<ConfirmAction title="Đổi thời gian mô phỏng?" description={`Chuyển tất cả tab đến ${formatDate(new Date(target).toISOString())} UTC+7. Các giới hạn thời gian được tính theo mốc mới.`} trigger="Áp dụng mốc mô phỏng" needsReason={false} onConfirm={async()=>{await simulateTime(target);setFeedback("Đã đổi mốc mô phỏng cho mọi vai trò.");}} />}</div><Feedback message={feedback} /></div></details>;
}
