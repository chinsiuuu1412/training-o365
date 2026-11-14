import type { ApprovalRequest, GeneralRequest, LmsState, User } from "../../types/lms.ts";
import { getCompletionApprovers } from "./completion.ts";

export type NotificationAudience =
  | { type: "people"; recipientIds: string[] }
  | { type: "classes"; classIds: string[]; includeTeachers: boolean; studentIds: string[] };

export type CommunicationCommand =
  | { type: "sendNotification"; title: string; description: string; audience: NotificationAudience }
  | { type: "markNotificationRead"; notificationId: string; read: boolean }
  | { type: "sendGeneralRequest"; recipientId: string; classId?: string; title: string; description: string }
  | { type: "decideGeneralRequest"; requestId: string; approved: boolean; reason: string }
  | { type: "markRequestRead"; requestId: string; source: "workflow" | "general" | "completion" | "appeal"; read: boolean };

export const communicationCommandTypes = ["sendNotification", "markNotificationRead", "sendGeneralRequest", "decideGeneralRequest", "markRequestRead"];

function requireRule(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

export function getMessageClasses(state: LmsState, actorId: string) {
  const actor = state.users.find(user => user.id === actorId);
  if (!actor || actor.status === "suspended") return [];
  return state.classes.filter(course => actor.role === "admin" || course.teacherId === actorId || state.enrollments.some(enrollment => enrollment.classId === course.id && enrollment.studentId === actorId && enrollment.status === "approved"));
}

export function getDirectRecipients(state: LmsState, actorId: string): User[] {
  const actor = state.users.find(user => user.id === actorId);
  if (!actor || actor.status === "suspended") return [];
  const classes = getMessageClasses(state, actorId);
  const studentIds = new Set(state.enrollments.filter(enrollment => enrollment.status === "approved" && classes.some(course => course.id === enrollment.classId)).map(enrollment => enrollment.studentId));
  return state.users.filter(user => {
    if (user.id === actorId) return false;
    if (actor.role === "admin") return user.role === "teacher" || user.role === "student";
    if (actor.role === "teacher") return user.role === "admin" || (user.role === "student" && studentIds.has(user.id));
    return user.role === "teacher" && classes.some(course => course.teacherId === user.id);
  });
}

export function getAudienceRecipients(state: LmsState, actorId: string, audience: NotificationAudience) {
  const actor = state.users.find(user => user.id === actorId);
  requireRule(actor && actor.status !== "suspended", "Tài khoản không khả dụng.");
  if (audience.type === "people") {
    const allowed = getDirectRecipients(state, actorId);
    requireRule(audience.recipientIds.length > 0 && audience.recipientIds.every(id => allowed.some(user => user.id === id)), "Chọn người nhận thuộc phạm vi được phép.");
    return [...new Set(audience.recipientIds)];
  }
  requireRule(actor.role !== "student", "Học viên chỉ gửi cho giảng viên lớp đã đăng ký.");
  const classes = getMessageClasses(state, actorId);
  requireRule(audience.classIds.length > 0 && audience.classIds.every(id => classes.some(course => course.id === id)), "Lớp nhận thông báo không thuộc phạm vi quản lý.");
  requireRule(!audience.includeTeachers || actor.role === "admin", "Chỉ Admin được chọn gửi theo lớp cho giảng viên.");
  const students = state.enrollments.filter(enrollment => enrollment.status === "approved" && audience.classIds.includes(enrollment.classId)).map(enrollment => enrollment.studentId);
  requireRule(audience.studentIds.every(id => students.includes(id)), "Học viên không còn thuộc các lớp đã chọn.");
  const teachers = audience.includeTeachers ? classes.filter(course => audience.classIds.includes(course.id)).map(course => course.teacherId) : [];
  const recipients = [...new Set([...audience.studentIds, ...teachers])].filter(id => id !== actorId);
  requireRule(recipients.length, "Chọn ít nhất một người nhận.");
  return recipients;
}

export interface RequestItem {
  id: string;
  source: "workflow" | "general" | "completion" | "appeal";
  title: string;
  description: string;
  senderId: string;
  recipientIds: string[];
  classId?: string;
  createdAt: string;
  status: ApprovalRequest["status"];
  resolutionReason?: string;
  resolvedAt?: string;
  kindLabel: string;
  href?: string;
}

const kindLabels: Record<ApprovalRequest["kind"], string> = {
  schedule: "Lịch học", enrollment: "Đăng ký lớp", "test-retake": "Làm lại Test",
  "teacher-leave": "Giảng viên xin nghỉ", "attendance-correction": "Điều chỉnh điểm danh", absence: "Học viên xin nghỉ",
};

export function getRequestItems(state: LmsState, actorId: string): RequestItem[] {
  const actor = state.users.find(user => user.id === actorId);
  if (!actor || actor.status === "suspended") return [];
  const workflow: RequestItem[] = state.requests.map(request => {
    const adminRequest = ["schedule", "teacher-leave", "attendance-correction"].includes(request.kind);
    const course = state.classes.find(item => item.id === request.classId);
    const recipientIds = adminRequest ? state.users.filter(user => user.role === "admin").map(user => user.id) : course ? [course.teacherId] : [];
    let href: string;
    if (actor.role === "admin" && adminRequest) href = "/admin/schedule-approvals";
    else {
      const tab = request.kind === "test-retake" ? "quizzes" : request.kind === "enrollment" ? (actor.role === "teacher" ? "requests" : "overview") : "lessons";
      href = `/${actor.role}/classes/${request.classId}?tab=${tab}`;
    }
    return { ...request, source: "workflow", recipientIds, kindLabel: kindLabels[request.kind], href };
  });
  const general: RequestItem[] = (state.generalRequests ?? []).map(request => ({ ...request, source: "general", recipientIds: [request.recipientId], kindLabel: "Yêu cầu tự do" }));
  const completion: RequestItem[] = (state.completionRequests ?? []).map(request => ({
    ...request, source: "completion", title: `${request.kind === "exception" ? "Đề xuất hoàn thành / cấp lại" : "Đề xuất thu hồi chứng chỉ"} · ${state.users.find(user => user.id === request.studentId)?.name ?? "Học viên"}`,
    description: request.reason, recipientIds: getCompletionApprovers(state, request), kindLabel: "Hoàn thành · Duyệt chéo",
    href: `/${actor.role}/certificates?classId=${request.classId}`,
  }));
  const appeals: RequestItem[] = (state.completionAppeals ?? []).map(appeal => ({
    ...appeal, source: "appeal", title: `Khiếu nại hoàn thành · ${appeal.snapshot.studentName}`, description: appeal.reason,
    senderId: appeal.studentId, recipientIds: state.classes.filter(course => course.id === appeal.classId).map(course => course.teacherId),
    status: appeal.status === "forwarded" ? "waiting" : appeal.status, kindLabel: appeal.status === "forwarded" ? "Khiếu nại · Đã chuyển duyệt chéo" : "Khiếu nại hoàn thành",
    href: `/${actor.role}/certificates?classId=${appeal.classId}`,
  }));
  return [...workflow, ...general, ...completion, ...appeals].filter(request => {
    if (request.senderId === actorId || request.recipientIds.includes(actorId)) return true;
    return request.source === "completion" && (actor.role === "admin" || (actor.role === "teacher" && state.classes.some(course => course.id === request.classId && course.teacherId === actorId)));
  }).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function getRequestRevision(request: RequestItem) {
  return `${request.status}|${request.resolvedAt ?? request.createdAt}|${request.resolutionReason ?? ""}`;
}

export function isRequestUnread(state: LmsState, actorId: string, request: RequestItem) {
  const receipt = (state.requestReceipts ?? []).find(item => item.userId === actorId && item.requestId === request.id && item.source === request.source);
  // A sender's own pending request has no incoming update until marked unread.
  if (!receipt && request.senderId === actorId && request.status === "waiting" && !request.resolutionReason) return false;
  return receipt?.revision !== getRequestRevision(request);
}

export function getUnreadCounts(state: LmsState, actorId: string) {
  return {
    notifications: state.notifications.filter(item => item.recipientId === actorId && !item.read).length,
    requests: getRequestItems(state, actorId).filter(request => isRequestUnread(state, actorId, request)).length,
  };
}

export function executeCommunication(original: LmsState, actorId: string, command: CommunicationCommand, now: number): LmsState {
  const state = structuredClone(original);
  const actor = state.users.find(user => user.id === actorId);
  requireRule(actor && actor.status !== "suspended", "Tài khoản không khả dụng.");
  const createdAt = new Date(now).toISOString();
  const id = `message-${now}-${state.notifications.length}-${state.generalRequests?.length ?? 0}`;
  if (command.type === "markNotificationRead") {
    const notification = state.notifications.find(item => item.id === command.notificationId && item.recipientId === actorId);
    requireRule(notification, "Không tìm thấy thông báo của bạn.");
    notification.read = command.read;
  } else if (command.type === "markRequestRead") {
    const request = getRequestItems(state, actorId).find(item => item.id === command.requestId && item.source === command.source);
    requireRule(request, "Bạn không có quyền xem yêu cầu này.");
    state.requestReceipts = (state.requestReceipts ?? []).filter(receipt => !(receipt.userId === actorId && receipt.requestId === request.id && receipt.source === request.source));
    state.requestReceipts.push({ userId: actorId, requestId: request.id, source: request.source, revision: command.read ? getRequestRevision(request) : "" });
  } else if (command.type === "decideGeneralRequest") {
    const request = state.generalRequests?.find(item => item.id === command.requestId);
    requireRule(request && request.recipientId === actorId, "Chỉ người nhận được xử lý yêu cầu tự do.");
    requireRule(request.status === "waiting", "Yêu cầu đã được xử lý.");
    requireRule(command.reason.trim() && command.reason.length <= 2000, "Nhập phản hồi từ 1 đến 2000 ký tự.");
    Object.assign(request, { status: command.approved ? "approved" : "declined", resolvedAt: createdAt, resolutionReason: command.reason.trim() });
    const resolved = getRequestItems(state, actorId).find(item => item.source === "general" && item.id === request.id)!;
    state.requestReceipts = (state.requestReceipts ?? []).filter(receipt => !(receipt.source === "general" && receipt.requestId === request.id && receipt.userId === actorId));
    state.requestReceipts.push({ source: "general", requestId: request.id, userId: actorId, revision: getRequestRevision(resolved) });
    state.notifications.push({ id, recipientId: request.senderId, senderId: actorId, classId: request.classId, title: command.approved ? "Yêu cầu được chấp thuận" : "Yêu cầu bị từ chối", description: `${request.title} · ${command.reason.trim()}`, createdAt, href: `/${state.users.find(user => user.id === request.senderId)!.role}/requests` });
  } else {
    requireRule(command.title.trim() && command.title.trim().length <= 150, "Tiêu đề bắt buộc và tối đa 150 ký tự.");
    requireRule(command.description.trim() && command.description.trim().length <= 4000, "Nội dung bắt buộc và tối đa 4000 ký tự.");
    if (command.type === "sendNotification") {
      const recipients = getAudienceRecipients(state, actorId, command.audience);
      const classId = command.audience.type === "classes" && command.audience.classIds.length === 1 ? command.audience.classIds[0] : undefined;
      for (const recipientId of recipients) state.notifications.push({
        id: `${id}-${recipientId}`, messageId: id, recipientId, senderId: actorId, classId,
        title: command.title.trim(), description: command.description.trim(), createdAt, read: false,
        href: `/${state.users.find(user => user.id === recipientId)!.role}/notifications`,
      });
    } else {
      const recipient = getDirectRecipients(state, actorId).find(user => user.id === command.recipientId);
      requireRule((actor.role === "teacher" && recipient?.role === "admin") || (actor.role === "student" && recipient?.role === "teacher"), "Teacher chỉ gửi yêu cầu tự do đến Admin, Student chỉ gửi đến giảng viên lớp đã đăng ký.");
      if (command.classId) {
        const course = getMessageClasses(state, actorId).find(item => item.id === command.classId);
        requireRule(course && (actor.role !== "student" || course.teacherId === recipient.id), "Lớp không phù hợp với người nhận.");
      }
      const request: GeneralRequest = { id, senderId: actorId, recipientId: recipient.id, classId: command.classId, title: command.title.trim(), description: command.description.trim(), createdAt, status: "waiting" };
      state.generalRequests ??= [];
      state.generalRequests.push(request);
      state.notifications.push({ id: `${id}-notice`, recipientId: recipient.id, senderId: actorId, classId: request.classId, title: "Có yêu cầu mới", description: request.title, createdAt, href: `/${recipient.role}/requests` });
    }
  }
  return state;
}
