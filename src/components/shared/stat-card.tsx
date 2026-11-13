import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
export function StatCard({ label, value, detail, icon: Icon, tone = "blue" }: { label: string; value: number; detail: string; icon: LucideIcon; tone?: "blue" | "violet" | "teal" | "amber" }) {
  const styles = { blue: "bg-blue-50 text-blue-600", violet: "bg-violet-50 text-violet-600", teal: "bg-teal-50 text-teal-700", amber: "bg-amber-50 text-amber-700" };
  return <Card className="dashboard-card p-5"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-muted-foreground">{label}</p><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${styles[tone]}`}><Icon size={20} strokeWidth={1.7} /></span></div><p className="mt-1 text-[32px] font-semibold leading-tight tracking-tight">{value.toLocaleString("vi-VN")}</p><p className="mt-3 text-xs text-muted-foreground">{detail}</p></Card>;
}
