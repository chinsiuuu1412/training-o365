import type { ReactNode } from "react";
import { Bell, CalendarDays, ClipboardCheck } from "lucide-react";
import type { Notification } from "@/types/lms";
import type { RequestRow, UpcomingLesson } from "@/mocks/services/dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";

export function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DashboardPage({ children }: { children: ReactNode }) {
  return <div className="dashboard-page space-y-6">{children}</div>;
}

export function DemoDate({ referenceTime }: { referenceTime: string }) {
  return <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><CalendarDays size={15} className="mt-0.5 shrink-0" />Mốc dữ liệu demo: {formatDate(referenceTime)} (UTC+7) · Thống nhất giữa 3 vai trò</p>;
}

export function RequestList({ title, requests }: { title: string; requests: RequestRow[] }) {
  return <Card className="min-w-0 p-5 sm:p-6">
    <h2 className="flex items-center gap-2 text-lg font-semibold">{title}<span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{requests.length}</span></h2>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">Xem nội dung và lý do gửi yêu cầu.</p>
    {requests.length ? <div className="mt-4 divide-y divide-border">{requests.map(request => <details key={request.id} className="dashboard-details py-4 first:pt-0">
      <summary className="text-sm font-medium"><span className="inline-flex items-start gap-2 align-middle"><ClipboardCheck size={16} className="mt-0.5 shrink-0 text-primary" /><span>{request.sender.name} · {request.title}<span className="mt-1 block text-xs font-normal text-muted-foreground">{request.course.name}</span></span></span></summary>
      <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-4 text-sm leading-6">
        <StatusBadge status="waiting" /><p>{request.description}</p>
        <p className="text-xs text-muted-foreground">Gửi lúc {formatDate(request.createdAt)}{request.quiz ? ` · ${request.quiz.title}` : ""}</p>
        <Button disabled size="sm" variant="outline">Phê duyệt · Chưa hỗ trợ</Button>
        <p className="text-xs text-muted-foreground">Bản demo chỉ xem chi tiết; yêu cầu giữ nguyên trạng thái chờ duyệt.</p>
      </div>
    </details>)}</div> : <EmptyState title="Không có yêu cầu chờ duyệt" description="Yêu cầu mới của lớp được chọn sẽ xuất hiện tại đây." />}
  </Card>;
}

export function LessonList({ lessons }: { lessons: UpcomingLesson[] }) {
  return <Card className="min-w-0 p-5 sm:p-6"><h2 className="text-lg font-semibold">Buổi học sắp tới</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Chỉ hiển thị lịch đã được giảng viên xác nhận · UTC+7</p>
    {lessons.length ? <div className="mt-4 divide-y divide-border">{lessons.map(item => <details key={item.id} className="dashboard-details py-4 first:pt-0">
      <summary className="text-sm font-medium">{item.course.name} · {item.lesson.name}<span className="mt-1 block text-xs font-normal text-muted-foreground">{formatDate(item.startsAt)}</span></summary>
      <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-4 text-sm leading-6"><StatusBadge status="confirmed" /><p>Bắt đầu: {formatDate(item.startsAt)}<br />Kết thúc: {formatDate(item.endsAt)}</p><Button disabled size="sm" variant="outline">Vào buổi học · Chưa hỗ trợ</Button><p className="text-xs text-muted-foreground">Bản demo chưa mở phòng học hoặc ghi nhận điểm danh.</p></div>
    </details>)}</div> : <EmptyState title="Chưa có buổi học sắp tới" description="Lịch chờ duyệt chưa xuất hiện trong danh sách buổi học đã xác nhận." />}
  </Card>;
}

export function NotificationList({ notifications, title = "Thông báo" }: { notifications: Notification[]; title?: string }) {
  return <Card className="min-w-0 p-5 sm:p-6"><h2 className="text-lg font-semibold">{title}</h2>{notifications.length ? <div className="mt-4 divide-y divide-border">{notifications.map(item => <article key={item.id} className="flex items-start gap-3 py-4 first:pt-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary"><Bell size={16} /></span><div className="min-w-0"><h3 className="text-sm font-medium">{item.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p><time dateTime={item.createdAt} className="mt-2 block text-xs text-muted-foreground">{formatDate(item.createdAt)}</time></div></article>)}</div> : <EmptyState title="Chưa có thông báo" description="Thông báo liên quan đến các lớp của bạn sẽ xuất hiện tại đây." />}</Card>;
}
