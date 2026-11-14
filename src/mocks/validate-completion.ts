import type { CompletionSnapshot, LmsState } from "../types/lms.ts";

export function isValidCompletionState(state: LmsState) {
  const text = (value: unknown) => typeof value === "string";
  const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value as string));
  const user = (id: string) => state.users.some(item => item.id === id);
  const student = (id: string) => state.users.some(item => item.id === id && item.role === "student");
  const staff = (id: string) => state.users.some(item => item.id === id && ["admin", "teacher"].includes(item.role));
  const optionalDate = (value: unknown) => value === undefined || date(value);
  const optionalText = (value: unknown) => value === undefined || text(value);
  function snapshot(value: CompletionSnapshot) {
    return value && typeof value === "object"
      && [value.className, value.classCode, value.studentName, value.email].every(text) && date(value.capturedAt)
      && [value.attendedSessions, value.requiredSessions, value.passedQuizzes, value.requiredQuizzes].every(item => Number.isSafeInteger(item) && item >= 0)
      && [value.attendancePercent, value.quizPercent].every(item => Number.isFinite(item) && item >= 0)
      && [value.attendanceThreshold, value.quizThreshold].every(item => Number.isFinite(item) && item >= 0 && item <= 100);
  }
  if (!state.enrollments.every(item => optionalText(item.cycleId))) return false;
  if (state.certificates !== undefined && (!Array.isArray(state.certificates) || !state.certificates.every(item => item
    && text(item.id) && text(item.classId) && student(item.studentId) && text(item.enrollmentCycle)
    && ["issued", "under-review", "revoked"].includes(item.status) && ["criteria", "exception"].includes(item.basis)
    && date(item.issuedAt) && snapshot(item.snapshot) && optionalText(item.exceptionRequestId) && optionalText(item.acknowledgedReview)
    && (item.reviewCause === undefined || ["progress", "request"].includes(item.reviewCause))
    && Array.isArray(item.history) && item.history.length > 0 && item.history.every(event => event && ["issued", "under-review", "revoked"].includes(event.status) && date(event.at) && text(event.reason) && (event.actorId === undefined || user(event.actorId)) && optionalText(event.requestId))
    && Array.isArray(item.deliveries) && item.deliveries.every(delivery => delivery && text(delivery.id) && text(delivery.email) && date(delivery.at) && delivery.status === "simulated" && ["issuance", "revocation"].includes(delivery.kind))))) return false;
  if (state.completionRequests !== undefined && (!Array.isArray(state.completionRequests) || !state.completionRequests.every(item => item
    && text(item.id) && text(item.classId) && student(item.studentId) && staff(item.senderId) && text(item.enrollmentCycle)
    && ["exception", "revoke"].includes(item.kind) && text(item.reason) && date(item.createdAt)
    && ["waiting", "approved", "declined", "cancelled"].includes(item.status)
    && optionalDate(item.resolvedAt) && optionalText(item.resolutionReason) && optionalText(item.appealId)
    && (item.resolvedBy === undefined || staff(item.resolvedBy))
    && (item.decisionMode === undefined || ["cross-approval", "timeout"].includes(item.decisionMode))
    && (item.kind !== "revoke" || state.certificates?.some(certificate => certificate.id === item.certificateId && certificate.classId === item.classId && certificate.studentId === item.studentId && certificate.enrollmentCycle === item.enrollmentCycle))))) return false;
  if (state.completionAppeals !== undefined && (!Array.isArray(state.completionAppeals) || !state.completionAppeals.every(item => item
    && text(item.id) && text(item.classId) && student(item.studentId) && text(item.enrollmentCycle) && text(item.reason) && date(item.createdAt)
    && ["waiting", "forwarded", "approved", "declined", "cancelled"].includes(item.status)
    && optionalDate(item.resolvedAt) && optionalText(item.resolutionReason) && optionalText(item.requestId) && snapshot(item.snapshot)))) return false;
  return state.classFinalizations === undefined || (Array.isArray(state.classFinalizations) && state.classFinalizations.every(item => item && text(item.id) && text(item.classId) && date(item.finalizedAt) && staff(item.finalizedBy) && text(item.fingerprint)
    && (item.snapshots === undefined || (Array.isArray(item.snapshots) && item.snapshots.every(row => row && student(row.studentId) && text(row.enrollmentCycle) && snapshot(row.snapshot))))));
}
