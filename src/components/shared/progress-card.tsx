import { Card } from "@/components/ui/card";
import { ProgressTrack } from "./progress-track";

export interface ProgressMetric { label: string; value: number; detail: string; color?: "blue" | "teal" }

export function ProgressCard({ title, description, metrics }: { title: string; description: string; metrics: ProgressMetric[] }) {
  return <Card className="dashboard-card p-5 sm:p-6">
    <h3 className="text-base font-semibold">{title}</h3>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    <div className="mt-5 space-y-5">{metrics.map(metric => <div key={metric.label}>
      <p className="mb-2 text-sm font-medium">{metric.label}</p>
      <ProgressTrack value={metric.value} color={metric.color} label={`${title} · ${metric.label}`} />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{metric.detail}</p>
    </div>)}</div>
  </Card>;
}
