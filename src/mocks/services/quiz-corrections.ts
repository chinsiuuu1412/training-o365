import type { LmsState } from "../../types/lms.ts";

export type QuizCorrectionCommand =
  | { type: "requestQuizCorrection" | "removeQuizAttempt"; attemptId: string; reason: string }
  | { type: "decideQuizCorrection"; requestId: string; approved: boolean; reason: string };

export const quizCorrectionCommandTypes = ["requestQuizCorrection", "removeQuizAttempt", "decideQuizCorrection"];

function rule(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export function executeQuizCorrection(original: LmsState, actorId: string, command: QuizCorrectionCommand, now: number): LmsState {
  const state = structuredClone(original);
  const actor = state.users.find(user => user.id === actorId);
  rule(actor && actor.status !== "suspended", "Tài khoản không khả dụng.");
  const iso = new Date(now).toISOString();
  const request = command.type === "decideQuizCorrection" ? state.requests.find(item => item.id === command.requestId && item.kind === "quiz-correction") : undefined;
  if (command.type === "decideQuizCorrection") rule(actor.role === "admin" && request?.status === "waiting", "Chỉ Admin được xử lý yêu cầu Quiz đang chờ duyệt.");
  const attemptId = "attemptId" in command ? command.attemptId : request?.attemptId;
  const attempt = state.attempts.find(item => item.id === attemptId);
  const quiz = state.quizzes.find(item => item.id === attempt?.quizId);
  const course = state.classes.find(item => item.id === quiz?.classId);
  rule(attempt && quiz && course && attempt.valid && attempt.status !== "active" && attempt.status !== "paused", "Lượt làm không tồn tại, chưa nộp hoặc đã bị vô hiệu hóa.");
  rule(actor.role === "admin" || (actor.role === "manager" && course.managerId === actorId), "Bạn không phụ trách lớp học này.");
  const reason = command.reason.trim();
  rule(reason.length <= 2000, "Lý do tối đa 2000 ký tự.");
  const notify = (recipientId: string, title: string, description: string) => {
    const user = state.users.find(item => item.id === recipientId);
    if (user) state.notifications.push({ id: `quiz-correction-notice-${now}-${state.notifications.length}`, recipientId, senderId: actorId, classId: course.id, title, description, createdAt: iso, href: user.role === "student" ? `/student/classes/${course.id}?tab=quizzes` : `/${user.role}/classes/${course.id}?tab=quizzes` });
  };
  if (command.type === "requestQuizCorrection") {
    rule(actor.role === "manager", "Chỉ quản lý lớp phụ trách gửi đề nghị xóa kết quả Quiz.");
    rule(reason, "Vui lòng nhập lý do.");
    rule(!state.requests.some(item => item.kind === "quiz-correction" && item.attemptId === attemptId && item.status === "waiting"), "Yêu cầu đang chờ duyệt.");
    state.requests.push({ id: `quiz-correction-${now}-${state.requests.length}`, kind: "quiz-correction", classId: course.id, quizId: quiz.id, attemptId, attemptScore: attempt.score, attemptNumber: state.attempts.filter(item => item.quizId === quiz.id && item.studentId === attempt.studentId).findIndex(item => item.id === attemptId) + 1, studentId: attempt.studentId, senderId: actorId, title: `Xóa kết quả lượt Quiz · ${quiz.title}`, description: reason, createdAt: iso, status: "waiting" });
    for (const admin of state.users.filter(user => user.role === "admin")) notify(admin.id, "Có đề nghị xóa kết quả Quiz", `${quiz.title}: ${reason}`);
  } else {
    rule(actor.role === "admin", "Chỉ Admin được vô hiệu hóa kết quả Quiz.");
    const approved = command.type === "removeQuizAttempt" || ("approved" in command && command.approved);
    rule(approved && request || reason, "Vui lòng nhập lý do.");
    if (approved) {
      const explanation = command.type === "removeQuizAttempt" ? reason : request!.description;
      Object.assign(attempt, { valid: false, invalidatedAt: iso, invalidatedBy: actorId, invalidationReason: explanation });
      notify(attempt.studentId, "Kết quả Quiz đã bị vô hiệu hóa", `${quiz.title} · ${explanation}. Giữ lịch sử lượt làm; điểm cao nhất được tính lại từ các lượt còn hợp lệ.`);
      for (const pending of state.requests.filter(item => item.kind === "quiz-correction" && item.attemptId === attemptId && item.status === "waiting" && item.id !== request?.id)) Object.assign(pending, { status: "cancelled", resolvedAt: iso, resolutionReason: "Admin đã trực tiếp vô hiệu hóa lượt làm này." });
    }
    if (request) Object.assign(request, { status: approved ? "approved" : "declined", resolvedAt: iso, resolutionReason: reason || request.description });
    notify(course.managerId, approved ? "Đã vô hiệu hóa kết quả Quiz" : "Đề nghị xóa kết quả Quiz bị từ chối", `${quiz.title} · ${reason || request?.description}`);
  }
  return state;
}
