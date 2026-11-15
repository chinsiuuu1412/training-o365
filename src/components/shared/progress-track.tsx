export function ProgressTrack({ value, label, color = "blue" }: { value: number; label: string; color?: "blue" | "teal" }) {
  const percent = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return <div className="min-w-0"><div className="mb-1.5 text-xs font-medium tabular-nums text-slate-700">{percent}%</div><div role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full transition-[width] duration-200 ease-out ${color === "teal" ? "bg-teal-600" : "bg-primary"}`} style={{ width: `${percent}%` }} /></div></div>;
}
