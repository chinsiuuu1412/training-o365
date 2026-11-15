"use client";

import { useLms } from "@/state/lms-provider";
import { ConfirmAction } from "@/components/shared/management-ui";

export function AttemptCorrection({ attemptId, role }: { attemptId?: string; role: "admin" | "manager" }) {
  const { state, run, account } = useLms();
  const attempt = state.attempts.find(item => item.id === attemptId);
  if (!attempt || attempt.status === "active" || attempt.status === "paused") return null;
  if (!attempt.valid) return attempt.invalidationReason ? <p className="mt-2 text-sm text-red-800">Đã vô hiệu hóa · {attempt.invalidationReason}</p> : null;
  const pending = state.requests.some(item => item.kind === "quiz-correction" && item.attemptId === attemptId && item.status === "waiting");
  return <div className="mt-3 space-y-2">{pending && <p className="text-xs text-amber-800">Yêu cầu xóa kết quả đang chờ Admin duyệt.</p>}{(role === "admin" || !pending) && <ConfirmAction title={role === "admin" ? "Vô hiệu hóa lượt làm Quiz?" : "Đề nghị xóa kết quả lượt Quiz?"} trigger={role === "admin" ? "Vô hiệu hóa lượt này" : "Đề nghị xóa kết quả lượt này"} description={role === "admin" ? "Giữ lịch sử và điểm gốc của lượt làm, tính lại điểm cao nhất từ các lượt còn hợp lệ. Tiến độ có thể giảm và chứng chỉ được xem xét theo workflow." : "Kết quả hiện tại được giữ nguyên cho đến khi Admin duyệt. Phải nêu lý do đã xác minh."} onConfirm={async reason => { await run(account(role).id, { type: role === "admin" ? "removeQuizAttempt" : "requestQuizCorrection", attemptId: attempt.id!, reason }); }} />}</div>;
}
