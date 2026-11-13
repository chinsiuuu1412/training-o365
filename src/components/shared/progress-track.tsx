export function ProgressTrack({ value, label, color = "blue" }: { value: number; label: string; color?: "blue" | "teal" }) {
  return <div className="min-w-24"><div className="mb-1.5 text-xs font-medium text-slate-700">{value}%</div><div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-[width] duration-400 ${color === "teal" ? "bg-teal-500" : "bg-blue-500"}`} style={{ width: `${value}%` }} /></div></div>;
}
