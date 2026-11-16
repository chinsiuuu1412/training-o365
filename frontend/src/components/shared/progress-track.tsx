export function ProgressTrack({
  value,
  label,
  color = "blue",
}: {
  value: number;
  label: string;
  color?: "blue" | "teal";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value * 100) / 100));
  return (
    <div className="min-w-24">
      <div className="tabular-nums mb-1.5 text-xs font-medium text-slate-700">{clamped}%</div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-400 ${color === "teal" ? "bg-teal-500" : "bg-blue-500"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
