"use client";

import Link from "next/link";
import { useState } from "react";
import type { Notification, Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Field, Feedback } from "@/components/shared/management-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/features/dashboard/dashboard-parts";
import { MessageCompose } from "./message-compose";

export function NotificationInbox({ role }: { role: Role }) {
  const { account } = useLms();
  return <InboxView key={account(role).id} role={role} />;
}

function InboxView({ role }: { role: Role }) {
  const { state, account, run } = useLms();
  const actor = account(role);
  const [folder, setFolder] = useState("inbox");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [compose, setCompose] = useState(false);
  const [detailId, setDetail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inbox = state.notifications.filter(item => item.recipientId === actor.id);
  const sent = state.notifications.filter(item => item.senderId === actor.id);
  const grouped = new Map<string, Notification[]>();
  for (const notification of sent) {
    const key = notification.messageId ?? notification.id;
    grouped.set(key, [...(grouped.get(key) ?? []), notification]);
  }
  const rows = (folder === "inbox" ? inbox : [...grouped.values()].map(items => items[0])).filter(item => {
    const readMatches = folder !== "inbox" || filter === "all" || (filter === "unread" ? !item.read : !!item.read);
    return readMatches && `${item.title} ${item.description}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"));
  }).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const detail = (folder === "inbox" ? inbox : sent).find(item => item.id === detailId);
  const recipients = detail && folder === "sent" ? grouped.get(detail.messageId ?? detail.id) ?? [] : [];

  async function markRead(notification: Notification, read: boolean) {
    setError(""); setBusy(true);
    try {
      await run(actor.id, { type: "markNotificationRead", notificationId: notification.id, read }, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái đọc.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="dashboard-page space-y-6">
    <PageHeader title="Thông báo" description="Hộp thư trong hệ thống LMS." actions={<Button onClick={() => setCompose(true)}>Soạn thông báo</Button>} />
    <Feedback message={message} /><Feedback message={error} error />
    <div className="flex flex-wrap gap-3"><Button variant={folder === "inbox" ? "default" : "outline"} aria-pressed={folder === "inbox"} onClick={() => { setFolder("inbox"); setDetail(null); }}>Inbox ({inbox.filter(item => !item.read).length} chưa đọc)</Button><Button variant={folder === "sent" ? "default" : "outline"} aria-pressed={folder === "sent"} onClick={() => { setFolder("sent"); setDetail(null); }}>Đã gửi ({grouped.size})</Button><Button asChild variant="outline"><Link href={`/${role}/requests`}>Xem yêu cầu</Link></Button></div>
    <Card className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Tìm thông báo"><input type="search" className="form-control" value={search} onChange={event => setSearch(event.target.value)} /></Field>{folder === "inbox" && <Field label="Trạng thái đọc"><select className="form-control" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả</option><option value="unread">Chưa đọc</option><option value="read">Đã đọc</option></select></Field>}</Card>
    {rows.length ? <div className="space-y-3">{rows.map(notification => <Card key={notification.id} className={`space-y-3 p-5 ${folder === "inbox" && !notification.read ? "border-blue-200 bg-blue-50/40" : ""}`}>
      <div className="flex items-start gap-3">{folder === "inbox" && !notification.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-red-500" aria-label="Chưa đọc" />}<div className="min-w-0 flex-1"><h2 className="break-words text-lg font-semibold">{notification.title}</h2><p className="mt-2 text-sm text-muted-foreground">{folder === "inbox" ? `Từ ${state.users.find(user => user.id === notification.senderId)?.name ?? "Hệ thống LMS"}` : `${grouped.get(notification.messageId ?? notification.id)?.length ?? 1} người nhận`} · {formatDate(notification.createdAt)}</p></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => { setDetail(notification.id); if (folder === "inbox" && !notification.read) void markRead(notification, true); }}>Xem chi tiết</Button>{folder === "inbox" && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void markRead(notification, !notification.read)}>{notification.read ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}</Button>}</div>
    </Card>)}</div> : <EmptyState title="Không có thông báo phù hợp" description={folder === "sent" ? "Thông báo bạn gửi sẽ xuất hiện cùng danh sách người nhận." : "Thử đổi bộ lọc hoặc tìm kiếm."} />}
    <Dialog open={compose} onOpenChange={setCompose} title="Soạn thông báo" description="Chọn người nhận được phép và gửi nội dung trong LMS.">{compose && <MessageCompose role={role} onCancel={() => setCompose(false)} onSent={() => { setCompose(false); setMessage("Đã gửi thông báo đến các người nhận đã chọn."); }} />}</Dialog>
    <Dialog open={detailId !== null} onOpenChange={open => { if (!open) setDetail(null); }} title={detail?.title ?? "Không tìm thấy thông báo"} description={detail ? formatDate(detail.createdAt) : "Dữ liệu có thể đã được khôi phục."}>
      {detail && <div className="space-y-5"><p className="whitespace-pre-wrap break-words text-sm leading-7">{detail.description}</p>{folder === "sent" ? <div><h3 className="text-sm font-semibold">Danh sách người nhận</h3><ul className="mt-3 space-y-2 text-sm">{recipients.map(notification => <li key={notification.id}>{state.users.find(user => user.id === notification.recipientId)?.name ?? "Tài khoản không còn tồn tại"}</li>)}</ul></div> : <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={() => void markRead(detail, !detail.read)}>{detail.read ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}</Button>{detail.href !== `/${role}/notifications` && (detail.href === `/${role}` || detail.href.startsWith(`/${role}/`)) && <Button asChild><Link href={detail.href}>Mở nội dung liên quan</Link></Button>}</div>}<Feedback message={error} error /></div>}
    </Dialog>
  </div>;
}
