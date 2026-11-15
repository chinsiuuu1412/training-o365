import { StatusBadge } from "@/components/shared/status-badge";

const labels: Record<string, string> = { draft: "Bản nháp", pending: "Chờ Admin duyệt", rejected: "Bị từ chối", waiting: "Chờ Admin duyệt", declined: "Bị từ chối", approved: "Đã duyệt", active: "Đang diễn ra", completed: "Đã kết thúc", cancelled: "Đã hủy" };
export function LessonStatus({ status }: { status: string }) {
  const badge = status === "draft" ? "available" : status === "completed" ? "confirmed" : status === "active" ? "active" : ["waiting", "pending"].includes(status) ? "waiting" : ["declined", "rejected"].includes(status) ? "declined" : status === "approved" ? "approved" : "cancelled";
  return <StatusBadge status={badge} label={labels[status] ?? status} />;
}

export function localLessonTime(value?: string) { return value ? new Date(Date.parse(value) + 7 * 60 * 60 * 1000).toISOString().slice(0, 16) : ""; }
export function utcLessonTime(value: string) { return new Date(`${value}:00+07:00`).toISOString(); }
