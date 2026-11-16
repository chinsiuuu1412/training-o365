import type { ClassDto, ProgressDto } from "@/types/api";
import { translateIncompleteReason } from "@/lib/quiz-client";
import { ProgressCard } from "@/components/shared/progress-card";
import { StatusBadge } from "@/components/shared/status-badge";

export function displayPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

export function LearnerProgress({
  progress,
  minAttendancePercent,
  minQuizPercent,
  classInfo,
}: {
  progress: ProgressDto;
  minAttendancePercent?: number;
  minQuizPercent?: number;
  classInfo?: Pick<ClassDto, "min_attendance_percent" | "min_quiz_percent">;
}) {
  const attMin = minAttendancePercent ?? classInfo?.min_attendance_percent ?? 80;
  const quizMin = minQuizPercent ?? classInfo?.min_quiz_percent ?? 70;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <ProgressCard
          title="Chuyên cần (Attendance)"
          description="Số buổi được điểm danh hợp lệ / tổng số buổi của lớp."
          metrics={[
            {
              label: `${progress.attendance_count}/${progress.total_sessions} buổi`,
              value: displayPercent(progress.attendance_percent),
              detail: `Ngưỡng yêu cầu ≥ ${attMin}% · Đã kết thúc ${progress.ended_sessions} buổi`,
            },
          ]}
        />
        <ProgressCard
          title="Kiểm tra (Quiz)"
          description="Số bài Test & Assignment đạt / tổng số bài đã phát hành."
          metrics={[
            {
              label: `${progress.passed_quiz_count}/${progress.published_quiz_count} bài đạt`,
              value: displayPercent(progress.quiz_percent),
              detail: `Ngưỡng yêu cầu ≥ ${quizMin}%`,
              color: "teal",
            },
          ]}
        />
      </div>

      <div className="space-y-2 text-sm leading-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={progress.completed ? "completed" : "pending"}
            label={progress.completed ? "Đạt điều kiện hoàn thành" : "Chưa đạt điều kiện hoàn thành"}
          />
          <span className="tabular-nums text-xs text-muted-foreground">
            Chu kỳ ghi danh #{progress.enrollment_id}
          </span>
        </div>

        {progress.incomplete_reasons.length > 0 ? (
          <ul className="list-inside list-disc text-slate-700">
            {progress.incomplete_reasons.map((reason) => (
              <li key={reason}>{translateIncompleteReason(reason)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-emerald-700">
            Bạn đã đáp ứng đầy đủ các tiêu chí chuyên cần và bài kiểm tra do máy chủ xác nhận.
          </p>
        )}
      </div>
    </div>
  );
}
