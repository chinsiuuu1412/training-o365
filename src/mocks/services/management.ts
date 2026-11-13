import { executeLesson, lessonCommandTypes, type LessonCommand } from "./lessons.ts";
import type { Class, LmsState, Role, User } from "../../types/lms.ts";

export type Command = LessonCommand
  | { type: "saveAccount"; userId?: string; role: "student" | "teacher"; name: string; email: string; phone: string }
  | { type: "setAccountStatus"; userId: string; suspended: boolean; reason: string }
  | { type: "saveClass"; course: Class; reason: string }
  | { type: "setLessonCount"; classId: string; count: number }
  | { type: "requestEnrollment"; classId: string; reason: string }
  | { type: "cancelEnrollment"; classId: string }
  | { type: "decideEnrollment"; requestId: string; decision: "approved" | "declined"; reason: string }
  | { type: "removeStudent"; classId: string; studentId: string; reason: string };

function requireRule(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export function dateInBangkok(now: number) { return new Date(now + 7 * 3600000).toISOString().slice(0, 10); }
export function isExpired(course: Class, now: number) { return course.expiresAt < dateInBangkok(now); }
export function memberCount(state: LmsState, classId: string) { return state.enrollments.filter(e => e.classId === classId && e.status === "approved").length; }
export function canAccessClass(state: LmsState, actorId: string, classId: string) {
  const actor = state.users.find(u => u.id === actorId);
  const course = state.classes.find(c => c.id === classId);
  if (!actor || actor.status === "suspended" || !course) return false;
  return actor.role === "admin" || (actor.role === "teacher" ? course.teacherId === actorId : !isExpired(course, Date.parse(state.referenceTime)) && state.enrollments.some(e => e.classId === classId && e.studentId === actorId && e.status === "approved"));
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
  if (lessonCommandTypes.includes(command.type)) return executeLesson(original, actorId, command as LessonCommand, now);
  const state = structuredClone(original);
  const actor = state.users.find(u => u.id === actorId);
  requireRule(actor && actor.status !== "suspended", "Tài khoản đang bị vô hiệu hóa hoặc không tồn tại.");
  const isoNow = new Date(now).toISOString();
  const id = (prefix: string) => `${prefix}-${now}-${state.requests.length}-${state.notifications.length}-${state.users.length}-${state.classes.length}`;
  const mustBe = (roles: Role[]) => requireRule(roles.includes(actor.role), "Bạn không có quyền thực hiện thao tác này.");
  const courseFor = (classId: string) => { const course = state.classes.find(c => c.id === classId); requireRule(course, "Lớp học không tồn tại."); return course; };
  const manage = (course: Class) => requireRule(actor.role === "admin" || (actor.role === "teacher" && course.teacherId === actor.id), "Bạn không phụ trách lớp học này.");
  const reason = (value: string) => { requireRule(value.trim().length > 0, "Vui lòng nhập lý do."); return value.trim(); };
  const notify = (recipientId: string, classId: string | undefined, title: string, description: string) => state.notifications.unshift({ id: id("notice"), recipientId, classId, title, description, createdAt: isoNow, href: `/${state.users.find(u => u.id === recipientId)?.role ?? "student"}/classes${classId ? `/${classId}` : ""}` });

  switch (command.type) {
    case "saveAccount": {
      mustBe(["admin"]);
      const name = command.name.trim(), email = command.email.trim().toLowerCase(), phone = command.phone.trim();
      requireRule(name.length > 0, "Vui lòng nhập họ tên.");
      requireRule(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Email không hợp lệ.");
      requireRule(!phone || /^[+\d][\d\s().-]{5,19}$/.test(phone), "Số điện thoại không hợp lệ.");
      requireRule(!state.users.some(u => u.id !== command.userId && u.email?.toLowerCase() === email), "Tài khoản đã tồn tại");
      const current = command.userId ? state.users.find(u => u.id === command.userId) : undefined;
      requireRule(!command.userId || (current && current.role === command.role), "Không tìm thấy tài khoản phù hợp.");
      const info = { name, email, phone, initials: name.split(/\s+/).slice(-2).map(word => word[0]).join("") };
      if (current) Object.assign(current, info);
      else state.users.push({ id: id("user"), role: command.role, status: "active", ...info });
      break;
    }
    case "setAccountStatus": {
      mustBe(["admin"]);
      const user = state.users.find(u => u.id === command.userId);
      requireRule(user && user.role !== "admin", "Chỉ quản lý trạng thái tài khoản học viên hoặc giảng viên.");
      user.statusReason = reason(command.reason);
      user.status = command.suspended ? "suspended" : "active";
      notify(user.id, undefined, command.suspended ? "Tài khoản bị vô hiệu hóa" : "Tài khoản đã khôi phục", user.statusReason);
      break;
    }
    case "saveClass": {
      mustBe(["admin"]);
      const input = command.course;
      const current = state.classes.find(c => c.id === input.id);
      const teacher = state.users.find(u => u.id === input.teacherId && u.role === "teacher");
      requireRule(teacher && (teacher.status !== "suspended" || current?.teacherId === teacher.id), "Chọn giảng viên đang hoạt động.");
      requireRule(input.name.trim() && input.description?.trim() && input.code.trim(), "Nhập tên, mã và mô tả lớp học.");
      requireRule(!state.classes.some(c => c.id !== current?.id && c.code.toLowerCase() === input.code.trim().toLowerCase()), "Mã lớp đã tồn tại.");
      requireRule(Number.isInteger(input.capacity) && input.capacity >= Math.max(1, memberCount(state, input.id)), "Sĩ số phải là số nguyên dương và không thấp hơn số học viên đã đăng ký.");
      requireRule(/^\d{4}-\d{2}-\d{2}$/.test(input.expiresAt) && !Number.isNaN(Date.parse(input.expiresAt)) && input.expiresAt >= dateInBangkok(now), "Ngày hết hạn phải từ ngày hiện tại trở đi.");
      for (const threshold of [input.attendanceThreshold, input.quizThreshold]) requireRule(typeof threshold === "number" && Number.isFinite(threshold) && threshold >= 0 && threshold <= 100, "Tiêu chí hoàn thành phải từ 0 đến 100%.");
      if (current && current.teacherId !== input.teacherId) {
        const explanation = reason(command.reason);
        notify(current.teacherId, current.id, "Đã thay đổi giảng viên phụ trách", explanation);
        notify(input.teacherId, current.id, "Bạn được phân công lớp học", `${current.name}. ${explanation}. Các yêu cầu đang chờ của lớp chuyển sang bạn.`);
      }
      const saved = { ...input, id: current?.id ?? id("class"), name: input.name.trim(), code: input.code.trim(), description: input.description!.trim(), totalLessons: current?.totalLessons ?? 0 };
      if (current) Object.assign(current, saved); else state.classes.push(saved);
      break;
    }
    case "setLessonCount": {
      mustBe(["teacher"]); const course = courseFor(command.classId); manage(course);
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
      requireRule(!eligibility.lastReason || eligibility.status !== "declined" || eligibility.lastReason.toLocaleLowerCase() !== explanation.toLocaleLowerCase(), "Vui lòng nhập lý do mới khác lần bị từ chối.");
      let enrollment = state.enrollments.find(e => e.classId === course.id && e.studentId === actor.id);
      if (!enrollment) { enrollment = { classId: course.id, studentId: actor.id, status: "pending", declineCount: 0 }; state.enrollments.push(enrollment); }
      Object.assign(enrollment, { status: "pending", lastReason: explanation });
      state.requests.push({ id: id("enroll"), kind: "enrollment", classId: course.id, senderId: actor.id, title: `Đăng ký lớp ${course.name}`, description: explanation, createdAt: isoNow, status: "waiting" });
      notify(course.teacherId, course.id, "Có yêu cầu đăng ký lớp", `${actor.name}: ${explanation}`);
      break;
    }
    case "cancelEnrollment": {
      mustBe(["student"]);
      const enrollment = state.enrollments.find(e => e.classId === command.classId && e.studentId === actor.id);
      const request = state.requests.find(r => r.classId === command.classId && r.senderId === actor.id && r.kind === "enrollment" && r.status === "waiting");
      requireRule(enrollment?.status === "pending" && request, "Không có yêu cầu đang chờ để hủy.");
      enrollment.status = "cancelled"; request.status = "cancelled"; request.resolvedAt = isoNow;
      notify(courseFor(command.classId).teacherId, command.classId, "Học viên đã hủy đăng ký", actor.name);
      break;
    }
    case "decideEnrollment": {
      mustBe(["teacher"]);
      const request = state.requests.find(r => r.id === command.requestId && r.kind === "enrollment");
      requireRule(request && request.status === "waiting", "Yêu cầu không còn chờ duyệt.");
      const course = courseFor(request.classId); manage(course);
      requireRule(!isExpired(course, now), "Lớp đã hết hạn, không thể xử lý đăng ký.");
      const enrollment = state.enrollments.find(e => e.classId === course.id && e.studentId === request.senderId);
      requireRule(enrollment?.status === "pending", "Trạng thái đăng ký không hợp lệ.");
      if (command.decision === "approved") {
        requireRule(state.users.find(u => u.id === request.senderId)?.status !== "suspended", "Học viên đang bị vô hiệu hóa.");
        requireRule(memberCount(state, course.id) < course.capacity, "Lớp đã đủ sĩ số.");
        // A fresh enrollment starts at zero, including a student returning after removal.
        const lessonIds = new Set(state.lessons.filter(l => l.classId === course.id).map(l => l.id));
        const quizIds = new Set(state.quizzes.filter(q => q.classId === course.id).map(q => q.id));
        state.attendance = state.attendance.filter(a => a.studentId !== request.senderId || !lessonIds.has(a.lessonId));
        state.attempts = state.attempts.filter(a => a.studentId !== request.senderId || !quizIds.has(a.quizId));
        state.assignmentDrafts = state.assignmentDrafts.filter(d => d.studentId !== request.senderId || !quizIds.has(d.quizId));
      } else {
        enrollment.declineCount = (enrollment.declineCount ?? 0) + 1;
        enrollment.declineReason = reason(command.reason);
        enrollment.retryAt = new Date(now + 600000).toISOString();
      }
      enrollment.status = command.decision; request.status = command.decision;
      request.resolutionReason = command.reason.trim(); request.resolvedAt = isoNow;
      notify(request.senderId, course.id, command.decision === "approved" ? "Đăng ký lớp đã được duyệt" : "Đăng ký lớp bị từ chối", command.decision === "approved" ? `Bạn đã tham gia ${course.name}. Attendance và Quiz bắt đầu từ 0.` : `${course.name}: ${enrollment.declineReason}`);
      break;
    }
    case "removeStudent": {
      const course = courseFor(command.classId); manage(course);
      const enrollment = state.enrollments.find(e => e.classId === course.id && e.studentId === command.studentId && e.status === "approved");
      requireRule(enrollment, "Học viên không còn trong lớp.");
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


