import type { Certificate, CompletionRequest, LmsState } from "../../types/lms.ts";
import { syncDueQuizAttempts } from "./quizzes.ts";
import { getCompletionApprovers, getCompletionDecisionAccess, getCompletionEligibility, getCompletionSnapshot, getCurrentCertificate, getEnrollmentCycle, getClassFinalization, getUnissuedCompletionApproval } from "./completion.ts";

export type CertificateCommand =
  | { type: "finalizeClassResults"; classId: string }
  | { type: "appealCompletion"; classId: string; reason: string }
  | { type: "reviewCompletionAppeal"; appealId: string; forward: boolean; reason: string }
  | { type: "requestCompletion"; classId: string; studentId: string; kind: "exception" | "revoke"; certificateId?: string; reason: string }
  | { type: "decideCompletion"; requestId: string; approved: boolean; reason: string; useTimeout?: boolean };

export const certificateCommandTypes = ["finalizeClassResults", "appealCompletion", "reviewCompletionAppeal", "requestCompletion", "decideCompletion"];

function requireRule(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function requireReason(reason: string) {
  requireRule(reason.trim() && reason.length <= 2000, "Nhập lý do từ 1 đến 2000 ký tự.");
  return reason.trim();
}

function notify(state: LmsState, recipientIds: string[], classId: string, title: string, description: string, now: number, senderId?: string) {
  for (const recipientId of new Set(recipientIds)) {
    const user = state.users.find(item => item.id === recipientId);
    if (!user) continue;
    state.notifications.push({ id: `completion-notice-${now}-${state.notifications.length}`, recipientId, senderId, classId, title, description, createdAt: new Date(now).toISOString(), href: `/${user.role}/certificates` });
  }
}

function stakeholders(state: LmsState, classId: string, studentId: string) {
  const course = state.classes.find(item => item.id === classId);
  return [studentId, ...(course ? [course.teacherId] : []), ...state.users.filter(item => item.role === "admin").map(item => item.id)];
}

function progressFingerprint(state: LmsState, certificate: Certificate, now: number) {
  const value = getCompletionEligibility(state, certificate.classId, certificate.studentId, now);
  return JSON.stringify([value.progress.attendedSessions, value.progress.requiredSessions, value.progress.passedQuizzes, value.progress.requiredQuizzes, value.attendanceThreshold, value.quizThreshold]);
}

function changeCertificateStatus(state: LmsState, certificate: Certificate, status: Certificate["status"], reason: string, now: number, actorId?: string, requestId?: string) {
  certificate.status = status;
  certificate.history.push({ status, reason, at: new Date(now).toISOString(), actorId, requestId });
  const title = status === "under-review" ? "Chứng chỉ mô phỏng đang được xem xét" : status === "revoked" ? "Chứng chỉ mô phỏng đã bị thu hồi" : "Chứng chỉ mô phỏng được giữ hiệu lực";
  notify(state, stakeholders(state, certificate.classId, certificate.studentId), certificate.classId, title, reason, now, actorId);
}

export function synchronizeCertificates(original: LmsState, now: number): LmsState {
  let state = original;
  function writable() {
    if (state === original) state = structuredClone(original);
    return state;
  }
  const issuedAt = new Date(now).toISOString();
  for (const request of original.completionRequests ?? []) {
    if (request.kind !== "exception" || request.status !== "waiting") continue;
    const enrollment = state.enrollments.find(item => item.classId === request.classId && item.studentId === request.studentId);
    const certificate = getCurrentCertificate(state, request.classId, request.studentId);
    const stale = enrollment?.status !== "approved" || getEnrollmentCycle(state, request.classId, request.studentId) !== request.enrollmentCycle;
    if (!stale && (!certificate || certificate.status === "revoked")) continue;
    writable();
    const current = state.completionRequests!.find(item => item.id === request.id)!;
    const reason = stale ? "Lần ghi danh không còn hiện hành." : "Lần học này đã có chứng chỉ còn hiệu lực.";
    Object.assign(current, { status: "cancelled", resolvedAt: issuedAt, resolutionReason: reason });
    const appeal = state.completionAppeals?.find(item => item.id === request.appealId);
    if (appeal) Object.assign(appeal, { status: "cancelled", resolvedAt: issuedAt, resolutionReason: reason });
    notify(state, [request.senderId, request.studentId], request.classId, "Đề xuất hoàn thành đã đóng", reason, now);
  }
  for (const appeal of original.completionAppeals ?? []) {
    if (!["waiting", "forwarded"].includes(appeal.status)) continue;
    const enrollment = state.enrollments.find(item => item.classId === appeal.classId && item.studentId === appeal.studentId);
    if (enrollment?.status === "approved" && getEnrollmentCycle(state, appeal.classId, appeal.studentId) === appeal.enrollmentCycle) continue;
    writable();
    const current = state.completionAppeals!.find(item => item.id === appeal.id)!;
    Object.assign(current, { status: "cancelled", resolvedAt: issuedAt, resolutionReason: "Lần ghi danh không còn hiện hành." });
  }
  for (const prior of original.certificates ?? []) {
    if (prior.status === "revoked" || prior.basis === "exception") continue;
    const eligibility = getCompletionEligibility(state, prior.classId, prior.studentId, now);
    if (!eligibility.enrolled || eligibility.enrollmentCycle !== prior.enrollmentCycle) continue;
    const fingerprint = progressFingerprint(state, prior, now);
    if (prior.status === "issued" && !eligibility.meetsCriteria && fingerprint !== prior.acknowledgedReview) {
      writable();
      const certificate = state.certificates!.find(item => item.id === prior.id)!;
      certificate.reviewCause = "progress";
      changeCertificateStatus(state, certificate, "under-review", eligibility.reasons.join(" "), now);
    } else if (prior.status === "under-review" && prior.reviewCause === "progress" && eligibility.meetsCriteria) {
      writable();
      const certificate = state.certificates!.find(item => item.id === prior.id)!;
      delete certificate.reviewCause;
      delete certificate.acknowledgedReview;
      changeCertificateStatus(state, certificate, "issued", "Tiến độ đã phục hồi đủ hai ngưỡng. Hủy các đề xuất thu hồi đang chờ.", now);
      for (const request of state.completionRequests ?? []) {
        if (request.kind === "revoke" && request.certificateId === certificate.id && request.status === "waiting") Object.assign(request, { status: "cancelled", resolvedAt: issuedAt, resolutionReason: "Tiến độ đã phục hồi đủ điều kiện." });
      }
    }
  }
  for (const enrollment of state.enrollments) {
    if (enrollment.status !== "approved" || !state.users.some(item => item.id === enrollment.studentId && item.role === "student")) continue;
    if (!state.classFinalizations?.some(item => item.classId === enrollment.classId)) continue;
    const eligibility = getCompletionEligibility(state, enrollment.classId, enrollment.studentId, now);
    if (!eligibility.finalization.finalized) continue;
    const certificate = getCurrentCertificate(state, enrollment.classId, enrollment.studentId);
    if (certificate && certificate.status !== "revoked") continue;
    const approval = getUnissuedCompletionApproval(state, enrollment.classId, enrollment.studentId);
    if (!approval && (certificate?.status === "revoked" || !eligibility.meetsCriteria)) continue;
    writable();
    const snapshot = getCompletionSnapshot(state, enrollment.classId, enrollment.studentId, now);
    const id = `DEMO-CERT-${now}-${state.certificates?.length ?? 0}`;
    const reason = approval ? `Hoàn thành theo ngoại lệ đã duyệt: ${approval.reason}` : "Đã chốt kết quả và đạt cả hai ngưỡng của lớp.";
    const created: Certificate = {
      id, classId: enrollment.classId, studentId: enrollment.studentId, enrollmentCycle: eligibility.enrollmentCycle,
      status: "issued", basis: approval ? "exception" : "criteria", issuedAt, exceptionRequestId: approval?.id, snapshot,
      history: [{ status: "issued", at: issuedAt, reason, requestId: approval?.id, actorId: approval?.resolvedBy }],
      deliveries: [{ id: `${id}-email-1`, email: snapshot.email, at: issuedAt, kind: "issuance", status: "simulated" }],
    };
    state.certificates ??= [];
    state.certificates.push(created);
    notify(state, stakeholders(state, enrollment.classId, enrollment.studentId), enrollment.classId, "Chứng chỉ mô phỏng đã được cấp", `${snapshot.className}: ${reason} Email chỉ được ghi log mô phỏng.`, now);
  }
  return state;
}

export function executeCertificate(original: LmsState, actorId: string, command: CertificateCommand, now: number): LmsState {
  const state = structuredClone(synchronizeCertificates(syncDueQuizAttempts(original, now), now));
  const actor = state.users.find(item => item.id === actorId);
  requireRule(actor && actor.status !== "suspended", "Tài khoản không khả dụng.");
  const isoNow = new Date(now).toISOString();
  function manage(classId: string) {
    const course = state.classes.find(item => item.id === classId);
    requireRule(course && (actor!.role === "admin" || (actor!.role === "teacher" && course.teacherId === actorId)), "Bạn không có quyền xử lý hoàn thành của lớp.");
    return course;
  }
  function propose(classId: string, studentId: string, kind: CompletionRequest["kind"], reason: string, certificateId?: string, appealId?: string) {
    manage(classId);
    requireRule(state.users.some(item => item.id === studentId && item.role === "student"), "Không tìm thấy học viên.");
    const eligibility = getCompletionEligibility(state, classId, studentId, now);
    const currentCertificate = getCurrentCertificate(state, classId, studentId);
    const target = kind === "revoke" ? state.certificates?.find(item => item.id === certificateId && item.classId === classId && item.studentId === studentId) : undefined;
    if (kind === "exception") {
      requireRule(eligibility.enrolled && (!currentCertificate || currentCertificate.status === "revoked"), "Lần học không hiện hành hoặc đã có chứng chỉ còn hiệu lực.");
      requireRule(!eligibility.meetsCriteria || currentCertificate?.status === "revoked", "Học viên đã đủ ngưỡng. Chốt kết quả lớp để cấp thông thường.");
      requireRule(!getUnissuedCompletionApproval(state, classId, studentId), "Ngoại lệ đã được duyệt và đang chờ chốt kết quả để cấp.");
    } else requireRule(target && target.status !== "revoked", "Chứng chỉ không tồn tại hoặc đã thu hồi.");
    const cycle = target?.enrollmentCycle ?? eligibility.enrollmentCycle;
    requireRule(!(state.completionRequests ?? []).some(item => item.classId === classId && item.studentId === studentId && item.enrollmentCycle === cycle && item.kind === kind && item.status === "waiting" && (kind !== "revoke" || item.certificateId === target?.id)), "Đã có đề xuất cùng loại đang chờ duyệt.");
    const request: CompletionRequest = {
      id: `completion-request-${now}-${state.completionRequests?.length ?? 0}`, classId, studentId, enrollmentCycle: cycle,
      kind, certificateId: target?.id, appealId, senderId: actorId, reason: requireReason(reason), createdAt: isoNow, status: "waiting",
    };
    state.completionRequests ??= [];
    state.completionRequests.push(request);
    if (kind === "revoke" && target) {
      target.reviewCause = target.reviewCause ?? "request";
      changeCertificateStatus(state, target, "under-review", `Đề xuất thu hồi: ${request.reason}`, now, actorId, request.id);
    }
    notify(state, getCompletionApprovers(state, request), classId, kind === "exception" ? "Có đề xuất hoàn thành / cấp lại cần duyệt chéo" : "Có đề xuất thu hồi cần duyệt chéo", request.reason, now, actorId);
    return request;
  }

  if (command.type === "finalizeClassResults") {
    manage(command.classId);
    const result = getClassFinalization(state, command.classId, now);
    requireRule(!result.blockers.length, result.blockers.join(" "));
    if (!result.finalized) {
      state.classFinalizations ??= [];
      const snapshots = state.enrollments.filter(item => item.classId === command.classId && item.status === "approved").map(item => ({ studentId: item.studentId, enrollmentCycle: getEnrollmentCycle(state, command.classId, item.studentId), snapshot: getCompletionSnapshot(state, command.classId, item.studentId, now) }));
      state.classFinalizations.push({ id: `finalization-${now}-${state.classFinalizations.length}`, classId: command.classId, finalizedAt: isoNow, finalizedBy: actorId, fingerprint: result.fingerprint, snapshots });
    }
  } else if (command.type === "appealCompletion") {
    requireRule(actor.role === "student", "Chỉ học viên gửi khiếu nại hoàn thành.");
    const course = state.classes.find(item => item.id === command.classId);
    const eligibility = getCompletionEligibility(state, command.classId, actorId, now);
    const certificate = getCurrentCertificate(state, command.classId, actorId);
    requireRule(course && eligibility.enrolled, "Chỉ học viên còn enrollment đã duyệt được khiếu nại.");
    requireRule((!certificate || certificate.status === "revoked") && (!eligibility.meetsCriteria || certificate?.status === "revoked"), "Bạn đã đủ ngưỡng hoặc đang có chứng chỉ còn hiệu lực.");
    requireRule(!(state.completionAppeals ?? []).some(item => item.classId === course.id && item.studentId === actorId && item.enrollmentCycle === eligibility.enrollmentCycle && ["waiting", "forwarded"].includes(item.status)), "Khiếu nại hiện tại đang được xử lý.");
    const appeal = { id: `completion-appeal-${now}-${state.completionAppeals?.length ?? 0}`, classId: course.id, studentId: actorId, enrollmentCycle: eligibility.enrollmentCycle, reason: requireReason(command.reason), createdAt: isoNow, status: "waiting" as const, snapshot: getCompletionSnapshot(state, course.id, actorId, now) };
    state.completionAppeals ??= [];
    state.completionAppeals.push(appeal);
    notify(state, [course.teacherId], course.id, "Học viên gửi khiếu nại hoàn thành", appeal.reason, now, actorId);
  } else if (command.type === "reviewCompletionAppeal") {
    const appeal = state.completionAppeals?.find(item => item.id === command.appealId);
    requireRule(appeal && appeal.status === "waiting", "Khiếu nại không còn chờ xử lý.");
    manage(appeal.classId);
    requireRule(actor.role === "teacher", "Giảng viên phụ trách tiếp nhận khiếu nại học viên.");
    requireRule(getEnrollmentCycle(state, appeal.classId, appeal.studentId) === appeal.enrollmentCycle && state.enrollments.some(item => item.classId === appeal.classId && item.studentId === appeal.studentId && item.status === "approved"), "Lần ghi danh đã thay đổi.");
    if (command.forward) {
      const request = propose(appeal.classId, appeal.studentId, "exception", command.reason.trim() || appeal.reason, undefined, appeal.id);
      Object.assign(appeal, { status: "forwarded", requestId: request.id, resolutionReason: "Giảng viên đã tiếp nhận và gửi đề xuất duyệt chéo." });
    } else Object.assign(appeal, { status: "declined", resolvedAt: isoNow, resolutionReason: requireReason(command.reason) });
    notify(state, [appeal.studentId], appeal.classId, command.forward ? "Khiếu nại đã được chuyển để duyệt chéo" : "Giảng viên từ chối khiếu nại", appeal.resolutionReason!, now, actorId);
  } else if (command.type === "requestCompletion") {
    propose(command.classId, command.studentId, command.kind, command.reason, command.certificateId);
  } else {
    const request = state.completionRequests?.find(item => item.id === command.requestId);
    requireRule(request?.status === "waiting", "Đề xuất không còn chờ duyệt.");
    const access = getCompletionDecisionAccess(state, actorId, request, now);
    requireRule(command.useTimeout ? access.timeout : access.crossApproval, "Cần bên còn lại duyệt chéo. Người đề xuất chỉ được tự quyết sau đủ 24 giờ.");
    requireRule(command.reason.length <= 2000, "Phản hồi tối đa 2000 ký tự.");
    const reason = command.approved ? command.reason.trim() || "Đã chấp thuận đề xuất." : requireReason(command.reason);
    const target = state.certificates?.find(item => item.id === request.certificateId);
    if (request.kind === "exception") {
      requireRule(getEnrollmentCycle(state, request.classId, request.studentId) === request.enrollmentCycle && state.enrollments.some(item => item.classId === request.classId && item.studentId === request.studentId && item.status === "approved"), "Lần ghi danh không còn hiện hành.");
      const current = getCurrentCertificate(state, request.classId, request.studentId);
      requireRule(!current || current.status === "revoked", "Đã có chứng chỉ còn hiệu lực.");
    } else {
      requireRule(target && target.status !== "revoked", "Chứng chỉ đã bị thu hồi hoặc không tồn tại.");
      if (command.approved) {
        delete target.reviewCause;
        changeCertificateStatus(state, target, "revoked", reason, now, actorId, request.id);
        target.deliveries.push({ id: `${target.id}-email-${target.deliveries.length + 1}`, email: target.snapshot.email, at: isoNow, kind: "revocation", status: "simulated" });
      } else {
        delete target.reviewCause;
        target.acknowledgedReview = progressFingerprint(state, target, now);
        changeCertificateStatus(state, target, "issued", `Từ chối thu hồi: ${reason}`, now, actorId, request.id);
      }
    }
    Object.assign(request, { status: command.approved ? "approved" : "declined", resolvedAt: isoNow, resolvedBy: actorId, resolutionReason: reason, decisionMode: command.useTimeout ? "timeout" : "cross-approval" });
    const appeal = state.completionAppeals?.find(item => item.id === request.appealId);
    if (appeal) Object.assign(appeal, { status: request.status, resolutionReason: reason, resolvedAt: isoNow });
    notify(state, [request.senderId, request.studentId], request.classId, command.approved ? "Đề xuất hoàn thành / thu hồi được duyệt" : "Đề xuất hoàn thành / thu hồi bị từ chối", `${reason}${command.approved && request.kind === "exception" ? " Chứng chỉ chỉ được cấp sau khi lớp đã chốt hết điểm." : ""}`, now, actorId);
  }
  return synchronizeCertificates(state, now);
}
