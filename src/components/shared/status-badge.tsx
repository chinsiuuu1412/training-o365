import { Badge } from "@/components/ui/badge";

const statuses = {
  active: { label: "Đang hoạt động", style: "bg-emerald-50 text-emerald-800" },
  registered: { label: "Đã đăng ký", style: "bg-blue-50 text-blue-800" },
  waiting: { label: "Chờ duyệt", style: "bg-amber-50 text-amber-800" },
  confirmed: { label: "Đã xác nhận", style: "bg-emerald-50 text-emerald-800" },
  inProgress: { label: "Đang làm dở", style: "bg-blue-50 text-blue-800" },
  available: { label: "Chưa nộp", style: "bg-slate-100 text-slate-700" },
  suspended: { label: "Đã vô hiệu hóa", style: "bg-red-50 text-red-800" },
  declined: { label: "Đã từ chối", style: "bg-red-50 text-red-800" },
  cancelled: { label: "Đã hủy", style: "bg-slate-100 text-slate-700" },
  removed: { label: "Đã rời lớp", style: "bg-slate-100 text-slate-700" },
  full: { label: "Full · Đủ sĩ số", style: "bg-amber-50 text-amber-800" },
  expired: { label: "Đã hết hạn", style: "bg-slate-100 text-slate-700" },
  approved: { label: "Đã duyệt", style: "bg-emerald-50 text-emerald-800" },
  pending: { label: "Waiting for Approval", style: "bg-amber-50 text-amber-800" },
  eligible: { label: "Đủ ngưỡng điểm", style: "bg-emerald-50 text-emerald-800" },
  ineligible: { label: "Chưa đủ ngưỡng", style: "bg-amber-50 text-amber-800" },
  issued: { label: "Issued · Đã cấp mô phỏng", style: "bg-emerald-50 text-emerald-800" },
  underReview: { label: "Under review · Đang xem xét", style: "bg-amber-50 text-amber-800" },
  revoked: { label: "Revoked · Đã thu hồi", style: "bg-red-50 text-red-800" },
  passed: { label: "Đạt", style: "bg-emerald-50 text-emerald-800" },
  failed: { label: "Chưa đạt", style: "bg-red-50 text-red-800" },
} as const;

export function StatusBadge({ status, label: customLabel }: { status: keyof typeof statuses; label?: string }) {
  const { label, style } = statuses[status];
  return <Badge className={style}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{customLabel ?? label}</Badge>;
}
