import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <span className="mb-4 rounded-full bg-slate-100 p-4 text-slate-500">
        <Inbox size={24} />
      </span>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function LoadingState({ label = "Đang tải nội dung" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-6">
      <div aria-hidden="true" className="h-20 w-2/3 animate-pulse rounded-xl bg-slate-200" />
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div aria-hidden="true" className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function DashboardSkeleton() {
  return <LoadingState label="Đang tải tổng quan" />;
}

export function ErrorState({
  title = "Không thể tải dữ liệu",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" />
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-red-800">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw size={14} />
          Thử lại
        </Button>
      )}
    </div>
  );
}
