import type { QuizAttemptDto } from "@/types/api";
import { formatVietnamDateTime } from "@/lib/date";
import { StatusBadge } from "@/components/shared/status-badge";

export function clockLabel(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AttemptHistory({ attempts }: { attempts: QuizAttemptDto[] }) {
  return (
    <section className="space-y-3" aria-label="Lịch sử làm bài">
      <h3 className="font-semibold">Lịch sử các lượt làm bài</h3>
      {attempts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bạn chưa bắt đầu lượt làm bài nào.</p>
      ) : (
        <ol className="divide-y divide-border">
          {attempts.map((attempt) => (
            <li
              key={attempt.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <div>
                <span className="font-medium">Lượt #{attempt.attempt_number}</span>
                <p className="tabular-nums text-xs text-muted-foreground">
                  {attempt.submitted_at
                    ? `Nộp lúc ${formatVietnamDateTime(attempt.submitted_at)}`
                    : `Bắt đầu lúc ${formatVietnamDateTime(attempt.started_at)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={attempt.status} />
                {attempt.status === "submitted" && attempt.score_percent !== null && (
                  <span
                    className={`tabular-nums font-medium ${
                      attempt.is_passed ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {Math.round(attempt.score_percent * 10) / 10}% ({attempt.score ?? 0}/
                    {attempt.max_score ?? 0})
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">
        Hệ thống chỉ trả về điểm số của lượt nộp. Đáp án chi tiết không được công bố.
      </p>
    </section>
  );
}
