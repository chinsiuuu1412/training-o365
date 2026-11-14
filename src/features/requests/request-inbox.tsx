"use client";

import Link from "next/link";
import { useState } from "react";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { getRequestItems, isRequestUnread, type RequestItem } from "@/mocks/services/communications";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Field, Feedback, ActionForm } from "@/components/shared/management-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/features/dashboard/dashboard-parts";
import { MessageCompose } from "@/features/notifications/message-compose";

const statusOptions = [
  ["all", "Tất cả"], ["waiting", "Đang chờ (Pending)"], ["approved", "Đã duyệt (Approved)"],
  ["declined", "Từ chối (Declined)"], ["cancelled", "Đã hủy"],
];

export function RequestInbox({ role }: { role: Role }) {
  const { account } = useLms();
  return <RequestView key={account(role).id} role={role} />;
}

function RequestView({ role }: { role: Role }) {
  const { state, account, run } = useLms();
  const actor = account(role);
  const [status, setStatus] = useState("all");
  const [direction, setDirection] = useState("all");
  const [search, setSearch] = useState("");
  const [compose, setCompose] = useState(false);
  const [selected, setSelected] = useState<{ id: string; source: RequestItem["source"] } | null>(null);
  const [decision, setDecision] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requests = getRequestItems(state, actor.id);
  const rows = requests.filter(request => (status === "all" || request.status === status)
    && (direction === "all" || (direction === "sent" ? request.senderId === actor.id : request.recipientIds.includes(actor.id)))
    && `${request.title} ${request.description} ${state.users.find(user => user.id === request.senderId)?.name ?? ""}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
  const detail = requests.find(request => request.id === selected?.id && request.source === selected.source);

  async function markRead(request: RequestItem, read: boolean) {
    setError(""); setBusy(true);
    try {
      await run(actor.id, { type: "markRequestRead", requestId: request.id, source: request.source, read }, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái đọc.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="dashboard-page space-y-6">
    <PageHeader title="Yêu cầu" description="Theo dõi yêu cầu và phản hồi trong LMS." actions={role !== "admin" ? <Button onClick={() => setCompose(true)}>Gửi yêu cầu tự do</Button> : undefined} />
    <Feedback message={message} /><Feedback message={error} error />
    <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href={`/${role}/notifications`}>Mở thông báo</Link></Button>{role === "admin" && <Button asChild variant="outline"><Link href="/admin/schedule-approvals">Phê duyệt lịch & điểm danh</Link></Button>}</div>
    <div className="flex flex-wrap gap-2" aria-label="Lọc trạng thái yêu cầu">{statusOptions.map(([value, label]) => <Button key={value} size="sm" variant={status === value ? "default" : "outline"} aria-pressed={status === value} onClick={() => setStatus(value)}>{label} ({requests.filter(request => value === "all" || request.status === value).length})</Button>)}</div>
    <Card className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Tìm yêu cầu"><input type="search" className="form-control" value={search} onChange={event => setSearch(event.target.value)} /></Field><Field label="Hướng gửi"><select className="form-control" value={direction} onChange={event => setDirection(event.target.value)}><option value="all">Tất cả của tôi</option><option value="received">Yêu cầu nhận được</option><option value="sent">Yêu cầu đã gửi</option></select></Field></Card>
    {rows.length ? <div className="space-y-3">{rows.map(request => {
      const unread = isRequestUnread(state, actor.id, request);
      const course = state.classes.find(item => item.id === request.classId);
      return <Card key={`${request.source}-${request.id}`} className={`space-y-3 p-5 ${unread ? "border-blue-200 bg-blue-50/40" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3">{unread && <span aria-label="Chưa đọc" className="mt-2 size-2 shrink-0 rounded-full bg-red-500" />}<div className="min-w-0"><h2 className="break-words text-lg font-semibold">{request.title}</h2><p className="mt-2 text-xs text-muted-foreground">{request.kindLabel}{course ? ` · ${course.name}` : ""}</p></div></div><StatusBadge status={request.status} label={request.status === "approved" ? "Approval · Đã duyệt" : request.status === "declined" ? "Decline · Từ chối" : request.status === "waiting" ? "Waiting · Đang chờ" : "Đã hủy"} /></div>
        <p className="text-sm text-muted-foreground">Từ {state.users.find(user => user.id === request.senderId)?.name} · {formatDate(request.createdAt)}</p>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => { setSelected({ id: request.id, source: request.source }); setDecision(null); setReason(""); if (unread) void markRead(request, true); }}>Xem yêu cầu</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => void markRead(request, unread)}>{unread ? "Đánh dấu đã đọc" : "Đánh dấu chưa đọc"}</Button></div>
      </Card>;
    })}</div> : <EmptyState title="Không có yêu cầu phù hợp" description="Thử đổi trạng thái, hướng gửi hoặc từ khóa." />}
    <Dialog open={compose} onOpenChange={setCompose} title="Gửi yêu cầu tự do" description={role === "teacher" ? "Gửi nội dung cần Admin xem xét." : "Gửi nội dung cần giảng viên lớp đã đăng ký xem xét."}>
      {compose && <MessageCompose role={role} request onCancel={() => setCompose(false)} onSent={() => { setCompose(false); setMessage("Đã gửi yêu cầu và thông báo cho người nhận."); }} />}
    </Dialog>
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) { setSelected(null); setDecision(null); } }} title={detail?.title ?? "Không có quyền xem yêu cầu"} description={detail ? detail.kindLabel : "Dữ liệu hoặc phân công lớp có thể đã thay đổi."}>
      {detail && <div className="space-y-5">
        <p className="text-sm text-muted-foreground">Người gửi {state.users.find(user => user.id === detail.senderId)?.name}<br />Người nhận {detail.recipientIds.map(id => state.users.find(user => user.id === id)?.name).join(", ")}</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-7">{detail.description}</p>
        <StatusBadge status={detail.status} />
        {detail.resolutionReason && <div className="rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-semibold">Phản hồi</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{detail.resolutionReason}</p>{detail.resolvedAt && <p className="mt-2 text-xs text-muted-foreground">{formatDate(detail.resolvedAt)}</p>}</div>}
        {detail.source !== "general" && detail.href && <Button asChild><Link href={detail.href}>Mở màn hình nghiệp vụ</Link></Button>}
        {detail.source === "general" && detail.status === "waiting" && detail.recipientIds.includes(actor.id) && <div className="space-y-4">
          <div className="flex flex-wrap gap-3"><Button onClick={() => { setDecision(true); setReason(""); }}>Approve</Button><Button variant="outline" onClick={() => { setDecision(false); setReason(""); }}>Decline</Button></div>
          {decision !== null && <ActionForm submitLabel={decision ? "Xác nhận Approve" : "Xác nhận Decline"} onCancel={() => setDecision(null)} onSubmit={async () => {
            await run(actor.id, { type: "decideGeneralRequest", requestId: detail.id, approved: decision, reason });
            setDecision(null); setMessage("Đã xử lý yêu cầu và gửi phản hồi cho người gửi.");
          }}><Field label="Nội dung phản hồi *"><textarea required maxLength={2000} className="form-control min-h-24" value={reason} onChange={event => setReason(event.target.value)} /></Field></ActionForm>}
        </div>}
        <Button variant="outline" disabled={busy} onClick={() => void markRead(detail, isRequestUnread(state, actor.id, detail))}>{isRequestUnread(state, actor.id, detail) ? "Đánh dấu đã đọc" : "Đánh dấu chưa đọc"}</Button>
        <Feedback message={error} error />
      </div>}
    </Dialog>
  </div>;
}
