"use client";
import { useState } from "react";
import { useLms } from "@/state/lms-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, DataTable, Feedback, Field } from "@/components/shared/management-ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { formatDate } from "@/features/dashboard/dashboard-parts";

export function EnrollmentQueue({ classId }: { classId: string }) {
  const { state, account, run } = useLms();
  const [history, setHistory] = useState(false); const [decision, setDecision] = useState<{ id: string; value: "approved" | "declined" } | null>(null); const [message, setMessage] = useState("");
  const requests = state.requests.filter(r => r.classId === classId && r.kind === "enrollment" && (history ? r.status !== "waiting" : r.status === "waiting")).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const selected = state.requests.find(r => r.id === decision?.id);
  return <div className="space-y-4"><h2 className="text-xl font-semibold">Yêu cầu đăng ký lớp</h2><Feedback message={message} /><div className="flex gap-2"><Button variant={!history ? "default" : "outline"} aria-pressed={!history} onClick={() => setHistory(false)}>Đang chờ</Button><Button variant={history ? "default" : "outline"} aria-pressed={history} onClick={() => setHistory(true)}>Đã xử lý</Button></div>
    {requests.length ? <DataTable caption="Yêu cầu enrollment" columns={["Học viên", "Lý do tham gia", "Thời gian", "Trạng thái", "Thao tác"]}>{requests.map(request => <tr key={request.id}><th scope="row" className="px-4 py-4 font-medium">{state.users.find(u => u.id === request.senderId)?.name}</th><td className="max-w-72 px-4 py-4"><p className="whitespace-pre-wrap">{request.description}</p>{request.resolutionReason && <p className="mt-2 text-xs text-red-800">Phản hồi: {request.resolutionReason}</p>}</td><td className="px-4 py-4 text-xs">{formatDate(request.createdAt)}</td><td className="px-4 py-4"><StatusBadge status={request.status === "waiting" ? "waiting" : request.status} /></td><td className="px-4 py-4">{request.status === "waiting" ? <div className="flex gap-2"><Button size="sm" onClick={() => setDecision({ id: request.id, value: "approved" })}>Approve</Button><Button variant="outline" size="sm" onClick={() => setDecision({ id: request.id, value: "declined" })}>Decline</Button></div> : "—"}</td></tr>)}</DataTable> : <EmptyState title={history ? "Chưa có lịch sử xử lý" : "Không có yêu cầu chờ duyệt"} description="Yêu cầu đăng ký của học viên được cập nhật từ state chung." />}
    <Dialog title={decision?.value === "approved" ? "Phê duyệt đăng ký?" : "Từ chối đăng ký?"} description={`${state.users.find(u => u.id === selected?.senderId)?.name ?? "Học viên"} · ${selected?.description ?? ""}`} open={!!decision} onOpenChange={open => { if (!open) setDecision(null); }}><ActionForm onCancel={() => setDecision(null)} submitLabel={decision?.value === "approved" ? "Xác nhận Approve" : "Xác nhận Decline"} onSubmit={async data => { if (!decision) return; await run(account("teacher").id, { type: "decideEnrollment", requestId: decision.id, decision: decision.value, reason: String(data.get("reason") ?? "") }); setMessage(decision.value === "approved" ? "Đã duyệt. Học viên có quyền truy cập lớp; Attendance và Quiz bắt đầu từ 0." : "Đã từ chối và gửi lý do cho học viên."); setDecision(null); }}>{decision?.value === "declined" ? <Field label="Lý do từ chối *"><textarea name="reason" required maxLength={1000} className="form-control min-h-24" /></Field> : <p className="text-sm leading-6">Hệ thống kiểm tra lại sĩ số, ngày hết hạn và trạng thái đăng ký trước khi duyệt.</p>}</ActionForm></Dialog>
  </div>;
}
