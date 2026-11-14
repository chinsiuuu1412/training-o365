import type { getCompletionEligibility } from "@/mocks/services/completion";
import type { CompletionSnapshot } from "@/types/lms";
import { ProgressCard } from "@/components/shared/progress-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/management-ui";
import { EmptyState } from "@/components/shared/states";

export function displayPercent(value: number) {
  return Math.round(value * 10) / 10;
}

export function SnapshotProgress({ snapshot }: { snapshot: CompletionSnapshot }) {
  return <ProgressCard title="Tiến độ tại thời điểm ghi nhận" description="Snapshot lưu riêng, không thay đổi theo tiến độ hiện tại." metrics={[
    { label: "Attendance", value: displayPercent(snapshot.attendancePercent), detail: `${snapshot.attendedSessions}/${snapshot.requiredSessions} buổi · Ngưỡng ${snapshot.attendanceThreshold}%` },
    { label: "Quiz", value: displayPercent(snapshot.quizPercent), detail: `${snapshot.passedQuizzes}/${snapshot.requiredQuizzes} bài đạt · Ngưỡng ${snapshot.quizThreshold}%`, color: "teal" },
  ]} />;
}

export function LearnerProgress({ eligibility, showQuizzes = true }: { eligibility: ReturnType<typeof getCompletionEligibility>; showQuizzes?: boolean }) {
  const { progress, attendanceThreshold, quizThreshold } = eligibility;
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <ProgressCard title="Attendance" description="Buổi được điểm danh hợp lệ / tổng số buổi bắt buộc." metrics={[
        { label: `${progress.attendedSessions}/${progress.requiredSessions} buổi`, value: displayPercent(progress.attendancePercent), detail: `Ngưỡng ${attendanceThreshold}% · ${eligibility.attendanceMet ? "Đã đạt" : "Chưa đạt"}` },
      ]} />
      <ProgressCard title="Quiz · Test & Assignment" description="Mỗi bài đạt chỉ đóng góp một lần, dùng điểm cao nhất hợp lệ." metrics={[
        { label: `${progress.passedQuizzes}/${progress.requiredQuizzes} bài đạt`, value: displayPercent(progress.quizPercent), detail: `Ngưỡng ${quizThreshold}% · ${eligibility.quizMet ? "Đã đạt" : "Chưa đạt"}`, color: "teal" },
      ]} />
    </div>
    <div className="space-y-2 text-sm leading-6">
      <StatusBadge status={eligibility.meetsCriteria ? "eligible" : "ineligible"} />
      {eligibility.meetsCriteria ? <p>{eligibility.finalization.finalized ? "Đã đủ tiêu chí thông thường và đã chốt kết quả lớp." : "Dự kiến đủ điều kiện. Chứng chỉ chỉ được cấp sau buổi cuối và khi đã chốt hết điểm."}</p> : <ul className="list-inside list-disc text-slate-600">{eligibility.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      <p className="text-xs text-muted-foreground">Phần trăm hiển thị làm tròn một chữ số. Việc xét ngưỡng dùng số liệu gốc.</p>
    </div>
    {showQuizzes && (progress.quizzes.length ? <DataTable caption="Kết quả từng Quiz" columns={["Bài Quiz", "Loại", "Điểm cao nhất hợp lệ", "Điểm đạt", "Kết quả"]}>
      {progress.quizzes.map(quiz => <tr key={quiz.quizId}>
        <th scope="row" className="px-4 py-4 font-medium">{quiz.title}</th>
        <td className="px-4 py-4">{quiz.kind === "test" ? "Test" : "Assignment"}</td>
        <td className="px-4 py-4">{quiz.bestScore === null ? "Chưa có kết quả" : `${quiz.bestScore}/100`}</td>
        <td className="px-4 py-4">{quiz.passingScore}/100</td>
        <td className="space-y-2 px-4 py-4">{quiz.result === "not-submitted" ? <span className="text-muted-foreground">Chưa nộp hợp lệ</span> : <StatusBadge status={quiz.result} />}{quiz.inProgress && <p className="text-xs text-primary">Có lượt đang làm / tạm dừng</p>}</td>
      </tr>)}
    </DataTable> : <EmptyState title="Chưa có Quiz bắt buộc đã phát hành" description="Bản nháp không được tính vào tiến độ." />)}
  </div>;
}
