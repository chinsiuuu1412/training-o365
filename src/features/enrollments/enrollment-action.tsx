"use client";
import { useState } from "react";
import { useLms } from "@/state/lms-provider";
import { getEnrollmentState } from "@/mocks/services/management";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, ConfirmAction, Feedback, Field } from "@/components/shared/management-ui";
import { StatusBadge } from "@/components/shared/status-badge";

export function EnrollmentAction({ classId }: { classId: string }) {
  const { state, account, run, now } = useLms(); const student = account("student");
  const info = getEnrollmentState(state, classId, student.id, now);
  const [open, setOpen] = useState(false); const [message, setMessage] = useState("");
  const seconds = Math.max(0, Math.ceil((info.retryAt - now) / 1000));
  return <div className="space-y-3"><Feedback message={message} />
    {info.status === "approved" ? <StatusBadge status="registered" /> : info.status === "pending" ? <><StatusBadge status="pending" /><p className="text-xs text-muted-foreground">Đã gửi yêu cầu. Đợi giảng viên phụ trách xét duyệt.</p><Button disabled>Gửi yêu cầu · Đang chờ</Button><ConfirmAction title="Hủy yêu cầu đăng ký?" description="Lần gửi đã hủy không tiêu hao lượt. Bạn có thể gửi lại ngay nếu lớp còn chỗ và chưa hết hạn." trigger="Hủy yêu cầu" needsReason={false} onConfirm={async () => { await run(student.id, { type: "cancelEnrollment", classId }); setMessage("Đã hủy yêu cầu đăng ký."); }} /></> : <>
      {info.status === "declined" && <><StatusBadge status="declined" /><p className="text-sm leading-6">Lý do: {info.declineReason}</p><p className="text-xs text-muted-foreground">Đã bị từ chối {info.declineCount}/3 lần. Gửi lại cần lý do mới.</p>{seconds > 0 && <p role="status" className="text-xs text-amber-800">Có thể gửi lại sau {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>}{info.declineCount >= 3 && <p className="text-sm text-red-800">Đã hết lượt gửi lại.</p>}</>}
      {info.expired ? <StatusBadge status="expired" /> : info.full ? <StatusBadge status="full" /> : <Button disabled={!info.canRequest || student.status === "suspended"} onClick={() => setOpen(true)}>{info.status === "declined" ? "Gửi lại yêu cầu" : "Gửi yêu cầu đăng ký"}</Button>}
    </>}
    <Dialog title="Gửi yêu cầu đăng ký lớp" description="Giảng viên phụ trách cần phê duyệt trước khi bạn có quyền truy cập lớp. Hủy yêu cầu không tiêu hao lượt." open={open} onOpenChange={setOpen}><ActionForm submitLabel="Xác nhận đăng ký" onCancel={() => setOpen(false)} onSubmit={async data => { await run(student.id, { type: "requestEnrollment", classId, reason: String(data.get("reason")) }); setOpen(false); setMessage("Đã gửi yêu cầu. Waiting for Approval."); }}><Field label="Lý do tham gia *"><textarea name="reason" required maxLength={1000} className="form-control min-h-28" /></Field></ActionForm></Dialog>
  </div>;
}
