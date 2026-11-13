import { StatusBadge } from "@/components/shared/status-badge";

const labels: Record<string, string> = { draft: "Bản nháp", waiting: "Chờ Admin duyệt", declined: "Bị từ chối", approved: "Đã duyệt · Chưa xác nhận", late: "Quá hạn xác nhận", confirmed: "Đã xác nhận", active: "Đang diễn ra", completed: "Đã hoàn thành", cancelled: "Đã hủy" };
export function LessonStatus({ status }: { status: string }) {
  const badge = status === "draft" ? "available" : status === "late" ? "declined" : status === "completed" ? "confirmed" : status === "active" ? "active" : status === "waiting" ? "waiting" : status === "declined" ? "declined" : status === "approved" ? "approved" : status === "confirmed" ? "confirmed" : "cancelled";
  return <StatusBadge status={badge} label={labels[status] ?? status} />;
}

export function localLessonTime(value?: string) { return value ? new Date(Date.parse(value) + 7 * 60 * 60 * 1000).toISOString().slice(0, 16) : ""; }
export function utcLessonTime(value: string) { return new Date(`${value}:00+07:00`).toISOString(); }
