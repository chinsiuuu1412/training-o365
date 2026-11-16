import { Badge } from "@/components/ui/badge";

const statuses = {
  active: { label: "Đang hoạt động", style: "bg-emerald-50 text-emerald-800" },
  enrolled: { label: "Đã ghi danh", style: "bg-blue-50 text-blue-800" },
  pending: { label: "Chờ duyệt", style: "bg-amber-50 text-amber-800" },
  draft: { label: "Bản nháp", style: "bg-slate-100 text-slate-700" },
  approved: { label: "Đã duyệt", style: "bg-emerald-50 text-emerald-800" },
  rejected: { label: "Bị từ chối", style: "bg-red-50 text-red-800" },
  declined: { label: "Đã từ chối", style: "bg-red-50 text-red-800" },
  cancelled: { label: "Đã hủy", style: "bg-slate-100 text-slate-700" },
  removed: { label: "Đã rời lớp", style: "bg-slate-100 text-slate-700" },
  deleted: { label: "Đã xóa", style: "bg-red-50 text-red-800" },
  suspended: { label: "Đã vô hiệu hóa", style: "bg-red-50 text-red-800" },
  full: { label: "Đủ sĩ số", style: "bg-amber-50 text-amber-800" },
  expired: { label: "Đã hết hạn", style: "bg-slate-100 text-slate-700" },
  in_progress: { label: "Đang làm bài", style: "bg-blue-50 text-blue-800" },
  submitted: { label: "Đã nộp", style: "bg-emerald-50 text-emerald-800" },
  passed: { label: "Đạt", style: "bg-emerald-50 text-emerald-800" },
  failed: { label: "Chưa đạt", style: "bg-red-50 text-red-800" },
  completed: { label: "Hoàn thành", style: "bg-emerald-50 text-emerald-800" },
  incomplete: { label: "Chưa hoàn thành", style: "bg-amber-50 text-amber-800" },
  published: { label: "Đã xuất bản", style: "bg-emerald-50 text-emerald-800" },
  attended: { label: "Có mặt", style: "bg-emerald-50 text-emerald-800" },
  absent: { label: "Xin nghỉ", style: "bg-amber-50 text-amber-800" },
  unread: { label: "Chưa đọc", style: "bg-blue-50 text-blue-800" },
  read: { label: "Đã đọc", style: "bg-slate-100 text-slate-700" },
} as const;

export type StatusKind = keyof typeof statuses;

export function StatusBadge({ status, label: customLabel }: { status: StatusKind; label?: string }) {
  const { label, style } = statuses[status];
  return (
    <Badge className={style}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {customLabel ?? label}
    </Badge>
  );
}
