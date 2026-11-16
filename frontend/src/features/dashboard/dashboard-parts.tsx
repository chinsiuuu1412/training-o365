import Link from "next/link";
import { CalendarDays, ClipboardList, PlayCircle } from "lucide-react";
import type { AgendaDto, ClassDto, DashboardClassEntry, RouteRole } from "@/types/api";
import { formatVietnamDateTime } from "@/lib/date";
import { translateIncompleteReason } from "@/lib/quiz-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/management-ui";

export function AgendaSection({ role, agenda }: { role: RouteRole; agenda: AgendaDto }) {
  return (
    <div className="space-y-6">
      {role === "student" && agenda.active_attempts.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/60 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-navy">Bài đang làm dở</h2>
            <StatusBadge status="in_progress" />
          </div>
          <div className="mt-4 space-y-3">
            {agenda.active_attempts.map(({ attempt, quiz }) => (
              <div
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-100 bg-white p-4"
              >
                <div>
                  <p className="text-sm font-semibold">{quiz.title}</p>
                  <p className="tabular-nums mt-1 text-xs text-muted-foreground">
                    Lần làm #{attempt.attempt_number} · Thời điểm kết thúc tối đa:{" "}
                    {formatVietnamDateTime(attempt.effective_cutoff_at)}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/student/classes/${quiz.class_id}/quizzes/${quiz.id}`}>
                    <PlayCircle size={15} />
                    Tiếp tục làm bài
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card className="min-w-0 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Buổi học sắp diễn ra</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Chỉ hiển thị các buổi học đã được duyệt lịch thuộc lớp còn hiệu lực (UTC+7).
              </p>
            </div>
            {role === "student" && (
              <Button asChild variant="outline" size="sm">
                <Link href="/student/schedule">Xem lịch học</Link>
              </Button>
            )}
          </div>
          {agenda.upcoming_sessions.length === 0 ? (
            <EmptyState
              title="Chưa có buổi học sắp tới"
              description="Các buổi học đã được Admin duyệt sẽ xuất hiện tại đây."
            />
          ) : (
            <div className="mt-4 divide-y divide-border">
              {agenda.upcoming_sessions.map((session) => (
                <div key={session.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Buổi {session.session_number}: {session.title}
                    </p>
                    <p className="tabular-nums mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays size={14} />
                      {formatVietnamDateTime(session.starts_at)} – {formatVietnamDateTime(session.ends_at)}
                    </p>
                    {session.location && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Địa điểm: {session.location}</p>
                    )}
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/${role}/classes/${session.class_id}?tab=lessons`}>Mở lớp</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="min-w-0 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Bài kiểm tra & bài tập đang mở</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sắp xếp theo hạn nộp gần nhất (UTC+7).
            </p>
          </div>
          {agenda.quizzes.length === 0 ? (
            <EmptyState
              title="Chưa có bài kiểm tra sắp hạn"
              description="Các bài kiểm tra và bài tập đã xuất bản còn hạn sẽ hiển thị tại đây."
            />
          ) : (
            <div className="mt-4 divide-y divide-border">
              {agenda.quizzes.map((quiz) => (
                <div key={quiz.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <ClipboardList size={15} className="shrink-0 text-primary" />
                      {quiz.title}
                    </p>
                    <p className="tabular-nums mt-1 text-xs text-muted-foreground">
                      {quiz.quiz_type === "test" ? "Bài Test" : "Assignment"} · Điểm đạt {quiz.pass_score}% · Hạn nộp:{" "}
                      {formatVietnamDateTime(quiz.effective_deadline ?? quiz.deadline)}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={
                        role === "student"
                          ? `/student/classes/${quiz.class_id}/quizzes/${quiz.id}`
                          : `/${role}/classes/${quiz.class_id}?tab=quizzes`
                      }
                    >
                      {role === "student" ? "Mở bài" : "Xem chi tiết"}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function StaffCompletionTable({
  role,
  entries,
}: {
  role: "admin" | "manager";
  entries: DashboardClassEntry<ClassDto>[];
}) {
  const rows = entries.flatMap((entry) =>
    entry.enrollments.map((row) => ({
      course: entry.class,
      enrollment: row.enrollment,
      progress: row.progress,
    })),
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Tiến độ theo chu kỳ ghi danh</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Dữ liệu tổng hợp trực tiếp từ máy chủ cho từng lượt ghi danh trong các lớp.
        </p>
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Chưa có dữ liệu ghi danh"
            description="Khi học viên được duyệt ghi danh vào lớp, tiến độ sẽ hiển thị tại đây."
          />
        </Card>
      ) : (
        <DataTable
          caption="Bảng tiến độ hoàn thành theo chu kỳ ghi danh"
          columns={[
            "Lớp học",
            "Học viên / Chu kỳ",
            "Trạng thái",
            "Điểm danh",
            "Quiz đạt",
            "Hoàn thành",
            "Lý do chưa đạt",
          ]}
        >
          {rows.map(({ course, enrollment, progress }) => (
            <tr key={enrollment.id}>
              <td className="px-4 py-3 font-medium">
                <Link href={`/${role}/classes/${course.id}`} className="text-primary hover:underline">
                  {course.code} · {course.name}
                </Link>
              </td>
              <td className="tabular-nums px-4 py-3 text-xs text-muted-foreground">
                HV #{enrollment.student_id} · Chu kỳ #{enrollment.cycle_number} (ID #{enrollment.id})
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={enrollment.status} />
              </td>
              <td className="tabular-nums px-4 py-3">
                {progress.attendance_count}/{progress.total_sessions} ({progress.attendance_percent.toFixed(0)}%)
              </td>
              <td className="tabular-nums px-4 py-3">
                {progress.passed_quiz_count}/{progress.published_quiz_count} ({progress.quiz_percent.toFixed(0)}%)
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={progress.completed ? "completed" : "incomplete"} />
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {progress.incomplete_reasons.length === 0
                  ? "Đạt tất cả điều kiện"
                  : progress.incomplete_reasons.map(translateIncompleteReason).join("; ")}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}
