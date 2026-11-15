import { executeLesson, lessonCommandTypes, type LessonCommand } from "./lessons.ts";
import { executeQuiz, quizCommandTypes, type QuizCommand } from "./quizzes.ts";
import { executeLibrary, libraryCommandTypes, type LibraryCommand } from "./library.ts";
import { executeCommunication, communicationCommandTypes, type CommunicationCommand } from "./communications.ts";
import { executeCertificate, certificateCommandTypes, type CertificateCommand } from "./certificates.ts";
import { executeQuizCorrection, quizCorrectionCommandTypes, type QuizCorrectionCommand } from "./quiz-corrections.ts";
import type { Class, EnrollmentContext, LmsState, Role, User } from "../../types/lms.ts";
import { validateAccount, type AccountInput } from "./accounts.ts";
import { executeAccountSecurity, type SecurityCommand } from "./authentication.ts";
import { assertEnrollmentContext, currentCycleId, migrateEnrollmentCycles } from "./enrollment-cycles.ts";
import { dateInVietnam, isClassExpired, validClassDate } from "./class-policy.ts";

type DomainCommand = LessonCommand | QuizCommand | QuizCorrectionCommand | LibraryCommand | CommunicationCommand | CertificateCommand | SecurityCommand
  | ({ type: "saveAccount" } & AccountInput)
  | { type: "setAccountStatus"; userId: string; suspended: boolean; reason: string }
  | { type: "saveClass"; course: Class; reason: string }
  | { type: "setLessonCount"; classId: string; count: number }
  | { type: "requestEnrollment"; classId: string; reason: string }
  | { type: "cancelEnrollment"; classId: string }
  | { type: "decideEnrollment"; requestId: string; decision: "approved" | "declined"; reason: string }
  | { type: "removeStudent"; classId: string; studentId: string; reason: string };

export type Command = DomainCommand & { enrollmentContext?: EnrollmentContext[]; expectedRequestId?: string };

function requireRule(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export { dateInVietnam };
export const dateInBangkok = dateInVietnam;
export const isExpired = isClassExpired;
export function memberCount(state: LmsState, classId: string) { return state.enrollments.filter(e => e.classId === classId && e.status === "approved").length; }
export function canAccessClass(state: LmsState, actorId: string, classId: string) {
  const actor = state.users.find(u => u.id === actorId);
  const course = state.classes.find(c => c.id === classId);
  if (!actor || actor.status === "suspended" || !course) return false;
  return actor.role === "admin" || (actor.role === "manager" ? course.managerId === actorId : !isExpired(course, Date.parse(state.referenceTime)) && state.enrollments.some(e => e.classId === classId && e.studentId === actorId && e.status === "approved"));
}
export function getEnrollmentState(state: LmsState, classId: string, studentId: string, now: number) {
  const enrollment = state.enrollments.find(e => e.classId === classId && e.studentId === studentId);
  const course = state.classes.find(c => c.id === classId);
  const status = enrollment?.status ?? "available";
  const declineCount = enrollment?.declineCount ?? 0;
  const retryAt = enrollment?.retryAt ? Date.parse(enrollment.retryAt) : 0;
  const full = !!course && memberCount(state, classId) >= course.capacity;
  const expired = !course || isExpired(course, now);
  return { ...enrollment, status, declineCount, retryAt, full, expired, canRequest: !expired && !full && status !== "approved" && status !== "pending" && declineCount < 3 && now >= retryAt };
}

export function execute(original: LmsState, actorId: string, command: Command, now: number): LmsState {
  assertEnrollmentContext(original, command);
  if (command.type === 'resetDemoPassword' || command.type === 'changeDemoPassword') return executeAccountSecurity(original, actorId, command);
  if (quizCorrectionCommandTypes.includes(command.type)) return executeQuizCorrection(original, actorId, command as QuizCorrectionCommand, now);
  if (certificateCommandTypes.includes(command.type)) return executeCertificate(original, actorId, command as CertificateCommand, now);
  if (libraryCommandTypes.includes(command.type)) return executeLibrary(original, actorId, command as LibraryCommand, now);
  if (communicationCommandTypes.includes(command.type)) return executeCommunication(original, actorId, command as CommunicationCommand, now);
  if (quizCommandTypes.includes(command.type)) return executeQuiz(original, actorId, command as QuizCommand, now);
  if (lessonCommandTypes.includes(command.type)) return executeLesson(original, actorId, command as LessonCommand, now);
  const state = structuredClone(migrateEnrollmentCycles(original));
  const actor = state.users.find(u => u.id === actorId);
  requireRule(actor && actor.status !== "suspended", "Tài khoản đang bị vô hiệu hóa hoặc không tồn tại.");
  const isoNow = new Date(now).toISOString();
  const id = (prefix: string) => `${prefix}-${now}-${state.requests.length}-${state.notifications.length}-${state.users.length}-${state.classes.length}`;
  const mustBe = (roles: Role[]) => requireRule(roles.includes(actor.role), "Bạn không có quyền thực hiện thao tác này.");
  const courseFor = (classId: string) => { const course = state.classes.find(c => c.id === classId); requireRule(course, "Lớp học không tồn tại."); return course; };
  const manage = (course: Class) => requireRule(actor.role === "admin" || (actor.role === "manager" && course.managerId === actor.id), "Bạn không phụ trách lớp học này.");
  const reason = (value: string) => { requireRule(value.trim().length > 0, "Vui lòng nhập lý do."); return value.trim(); };
  const notify = (recipientId: string, classId: string | undefined, title: string, description: string) => state.notifications.unshift({ id: id("notice"), recipientId, classId, title, description, createdAt: isoNow, href: `/${state.users.find(u => u.id === recipientId)?.role ?? "student"}/classes${classId ? `/${classId}` : ""}` });

  switch (command.type) {
    case "saveAccount": {
      mustBe(["admin"]);
      const details = validateAccount(state, command);
      const { name } = details;
      const current = command.userId ? state.users.find(u => u.id === command.userId) : undefined;
      requireRule(!command.userId || (current && current.role === command.role), "Không tìm thấy tài khoản phù hợp.");
      const info = { ...details, initials: name.split(/\s+/).slice(-2).map(word => word[0]).join("") };
      if (current) Object.assign(current, info);
      else state.users.push({ id: id("user"), role: command.role, status: "active", credentialVersion: 1, sessionVersion: 1, ...info });
      break;
    }
    case "setAccountStatus": {
      mustBe(["admin"]);
      const user = state.users.find(u => u.id === command.userId);
      requireRule(user && user.role !== "admin", "Chỉ quản lý trạng thái tài khoản học viên hoặc quản lý lớp.");
      user.statusReason = reason(command.reason);
      user.status = command.suspended ? "suspended" : "active";
      user.sessionVersion = (user.sessionVersion ?? 1) + 1;
      notify(user.id, undefined, command.suspended ? "Tài khoản bị vô hiệu hóa" : "Tài khoản đã khôi phục", user.statusReason);
      break;
    }
    case "saveClass": {
      mustBe(["admin"]);
      const input = command.course;
      const current = state.classes.find(c => c.id === input.id);
      requireRule(!current || !isExpired(current, now), "Lớp đã hết hạn; chỉ được xem lịch sử trong đợt này.");
      const manager = state.users.find(u => u.id === input.managerId && u.role === "manager");
      requireRule(manager && (manager.status !== "suspended" || current?.managerId === manager.id), "Chọn quản lý lớp đang hoạt động.");
      requireRule(input.name.trim() && input.description?.trim() && input.code.trim(), "Nhập tên, mã và mô tả lớp học.");
      requireRule(!state.classes.some(c => c.id !== current?.id && c.code.toLowerCase() === input.code.trim().toLowerCase()), "Mã lớp đã tồn tại.");
      requireRule(Number.isInteger(input.capacity) && input.capacity >= Math.max(1, memberCount(state, input.id)), "Sĩ số phải là số nguyên dương và không thấp hơn số học viên đã đăng ký.");
      requireRule(validClassDate(input.expiresAt) && input.expiresAt >= dateInVietnam(now), "Ngày hết hạn phải từ ngày hiện tại trở đi.");
      for (const threshold of [input.attendanceThreshold, input.quizThreshold]) requireRule(typeof threshold === "number" && Number.isFinite(threshold) && threshold >= 0 && threshold <= 100, "Tiêu chí hoàn thành phải từ 0 đến 100%.");
      if (current && current.managerId !== input.managerId) {
        const explanation = reason(command.reason);
        notify(current.managerId, current.id, "Đã thay đổi quản lý lớp phụ trách", explanation);
        notify(input.managerId, current.id, "Bạn được phân công lớp học", `${current.name}. ${explanation}. Các yêu cầu đang chờ của lớp chuyển sang bạn.`);
      }
      const saved = { ...input, id: current?.id ?? id("class"), name: input.name.trim(), code: input.code.trim(), description: input.description!.trim(), totalLessons: current?.totalLessons ?? 0 };
      if (current) Object.assign(current, saved); else state.classes.push(saved);
      break;
    }
    case "setLessonCount": {
      mustBe(["manager"]); const course = courseFor(command.classId); manage(course);
      requireRule(!isExpired(course, now), "Lớp đã hết hạn.");
      requireRule(course.totalLessons === 0, "Số buổi đã được cố định; không thể thay đổi trong phạm vi này.");
      requireRule(Number.isInteger(command.count) && command.count > 0 && command.count <= 500, "Số buổi phải là số nguyên từ 1 đến 500.");
      course.totalLessons = command.count;
      state.lessons.push(...Array.from({ length: command.count }, (_, index) => ({ id: `${course.id}-l${index + 1}`, classId: course.id, name: `Buổi ${index + 1}`, completed: false })));
      break;
    }
    case "requestEnrollment": {
      mustBe(["student"]); const course = courseFor(command.classId);
      const eligibility = getEnrollmentState(state, course.id, actor.id, now);
      requireRule(eligibility.canRequest, eligibility.expired ? "Lớp đã hết hạn." : eligibility.full ? "Lớp đã đủ sĩ số." : eligibility.declineCount >= 3 ? "Đã hết 3 lượt bị từ chối." : eligibility.retryAt > now ? "Cần chờ đủ 10 phút sau khi bị từ chối." : "Bạn đã đăng ký hoặc đang chờ duyệt.");
      const explanation = reason(command.reason);
      requireRule(!eligibility.lastDeclinedReason || eligibility.lastDeclinedReason.toLocaleLowerCase("vi") !== explanation.toLocaleLowerCase("vi"), "Vui lòng nhập lý do mới khác lần bị từ chối.");
      let enrollment = state.enrollments.find(e => e.classId === course.id && e.studentId === actor.id);
      if (!enrollment) { enrollment = { classId: course.id, studentId: actor.id, status: "pending", declineCount: 0 }; state.enrollments.push(enrollment); }
      Object.assign(enrollment, { status: "pending", lastReason: explanation });
      enrollment.pendingRequestId = id("enroll");
      state.requests.push({ id: enrollment.pendingRequestId, kind: "enrollment", classId: course.id, senderId: actor.id, title: `Đăng ký lớp ${course.name}`, description: explanation, createdAt: isoNow, status: "waiting" });
      notify(course.managerId, course.id, "Có yêu cầu đăng ký lớp", `${actor.name}: ${explanation}`);
      break;
    }
    case "cancelEnrollment": {
      mustBe(["student"]);
      const enrollment = state.enrollments.find(e => e.classId === command.classId && e.studentId === actor.id);
      const request = state.requests.find(r => r.classId === command.classId && r.senderId === actor.id && r.kind === "enrollment" && r.status === "waiting");
      requireRule(enrollment?.status === "pending" && request, "Không có yêu cầu đang chờ để hủy.");
      requireRule(!command.expectedRequestId || command.expectedRequestId === request.id, "Yêu cầu đã thay đổi; không thể hủy yêu cầu mới.");
      delete enrollment.pendingRequestId;
      enrollment.status = "cancelled"; request.status = "cancelled"; request.resolvedAt = isoNow;
      notify(courseFor(command.classId).managerId, command.classId, "Học viên đã hủy đăng ký", actor.name);
      break;
    }
    case "decideEnrollment": {
      mustBe(["manager"]);
      const request = state.requests.find(r => r.id === command.requestId && r.kind === "enrollment");
      requireRule(request && request.status === "waiting", "Yêu cầu không còn chờ duyệt.");
      const course = courseFor(request.classId); manage(course);
      requireRule(!isExpired(course, now), "Lớp đã hết hạn, không thể xử lý đăng ký.");
      const enrollment = state.enrollments.find(e => e.classId === course.id && e.studentId === request.senderId);
      requireRule(enrollment?.status === "pending" && (!enrollment.pendingRequestId || enrollment.pendingRequestId === request.id), "Trạng thái đăng ký không hợp lệ.");
      requireRule(["approved", "declined"].includes(command.decision), "Quyết định không hợp lệ.");
      if (command.decision === "approved") {
        requireRule(state.users.some(user => user.id === request.senderId && user.role === 'student' && user.status !== 'suspended'), "Học viên không tồn tại hoặc đang bị vô hiệu hóa.");
        requireRule(memberCount(state, course.id) < course.capacity, "Lớp đã đủ sĩ số.");
        // Each approval creates a separate learning cycle; academic records stay in place.
        enrollment.cycleId = `enrollment-cycle-${course.id}-${request.senderId}-${now}-${state.enrollmentCycles!.length}`;
        state.enrollmentCycles!.push({ id: enrollment.cycleId, classId: course.id, studentId: request.senderId, status: "active", approvedAt: isoNow });
      } else {
        enrollment.declineCount = (enrollment.declineCount ?? 0) + 1;
        enrollment.declineReason = reason(command.reason);
        enrollment.lastDeclinedReason = request.description;
        enrollment.retryAt = new Date(now + 600000).toISOString();
      }
      delete enrollment.pendingRequestId;
      enrollment.status = command.decision; request.status = command.decision;
      request.resolutionReason = command.reason.trim(); request.resolvedAt = isoNow;
      notify(request.senderId, course.id, command.decision === "approved" ? "Đăng ký lớp đã được duyệt" : "Đăng ký lớp bị từ chối", command.decision === "approved" ? `Bạn đã tham gia ${course.name}. Attendance và Quiz bắt đầu từ 0.` : `${course.name}: ${enrollment.declineReason}`);
      break;
    }
    case "removeStudent": {
      const course = courseFor(command.classId); manage(course);
      requireRule(!isExpired(course, now), "Lớp đã hết hạn; chỉ xem lịch sử.");
      const enrollment = state.enrollments.find(e => e.classId === course.id && e.studentId === command.studentId && e.status === "approved");
      requireRule(enrollment, "Học viên không còn trong lớp.");
      const explanation = reason(command.reason);
      const cycleId = currentCycleId(state, course.id, command.studentId);
      const cycle = state.enrollmentCycles!.find(cycle => cycle.id === cycleId);
      requireRule(cycle, "Không tìm thấy lần ghi danh hiện hành.");
      Object.assign(cycle, { status: "ended", endedAt: isoNow, endReason: explanation });
      for (const pending of state.requests.filter(request => request.classId === course.id && request.status === "waiting" && (request.studentId === command.studentId || (["test-retake", "absence"].includes(request.kind) && request.senderId === command.studentId)))) Object.assign(pending, { status: "cancelled", resolvedAt: isoNow, resolutionReason: "Lần ghi danh cũ đã kết thúc." });
      enrollment.status = "removed";
      notify(command.studentId, course.id, "Bạn đã được xóa khỏi lớp", `${course.name}: ${reason(command.reason)}`);
      break;
    }
  }
  state.referenceTime = isoNow;
  return state;
}

export function accountFor(state: LmsState, role: Role, selected?: string): User {
  return state.users.find(u => u.id === selected && u.role === role) ?? state.users.find(u => u.role === role)!;
}

export function getEnrollmentRequests(state: LmsState, actorId: string, classId: string) {
  const actor = state.users.find(user => user.id === actorId);
  const course = state.classes.find(course => course.id === classId);
  if (!actor || actor.status === "suspended" || !course || (actor.role !== "admin" && !(actor.role === "manager" && course.managerId === actorId))) return [];
  return state.requests.filter(request => request.classId === classId && request.kind === "enrollment");
}


