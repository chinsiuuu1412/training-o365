import { Badge } from "@/components/ui/badge";

const statuses = {
  active: { label: "Đang hoạt động", style: "bg-emerald-50 text-emerald-800" },
  registered: { label: "Đã đăng ký", style: "bg-blue-50 text-blue-800" },
  waiting: { label: "Chờ duyệt", style: "bg-amber-50 text-amber-800" },
  confirmed: { label: "Đã xác nhận", style: "bg-emerald-50 text-emerald-800" },
  inProgress: { label: "Đang làm dở", style: "bg-blue-50 text-blue-800" },
  available: { label: "Chưa nộp", style: "bg-slate-100 text-slate-700" },
} as const;

export function StatusBadge({ status }: { status: keyof typeof statuses }) {
  const { label, style } = statuses[status];
  return <Badge className={style}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{label}</Badge>;
}
