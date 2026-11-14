import type { CompletionRequest, CompletionSnapshot, LmsState } from "../../types/lms.ts";
import { getLessonStatus } from "./lessons.ts";
import { getClassProgress, getProgressDetails } from "./progress.ts";

export const approvalWaitMs = 24 * 60 * 60 * 1000;

export function getEnrollmentCycle(state: LmsState, classId: string, studentId: string) {
  return state.enrollments.find(item => item.classId === classId && item.studentId === studentId)?.cycleId ?? "initial";
}

export function getClassResultFingerprint(state: LmsState, classId: string) {
  const course = state.classes.find(item => item.id === classId);
  const lessonIds = new Set(state.lessons.filter(item => item.classId === classId).map(item => item.id));
  const quizzes = state.quizzes.filter(item => item.classId === classId && item.status !== "draft");
  const quizIds = new Set(quizzes.map(item => item.id));
  return JSON.stringify({
    requirements: [course?.totalLessons, course?.attendanceThreshold ?? 80, course?.quizThreshold ?? 70],
    members: state.enrollments.filter(item => item.classId === classId && item.status === "approved").map(item => [item.studentId, item.cycleId ?? "initial"]),
    attendance: state.attendance.filter(item => lessonIds.has(item.lessonId)).map(item => [item.studentId, item.lessonId, item.recorded]),
    quizzes: quizzes.map(item => [item.id, item.passingScore, item.opensAt, item.dueAt, item.attemptLimit, item.grants]),
    attempts: state.attempts.filter(item => quizIds.has(item.quizId)).map((item, index) => [item.id ?? index, item.studentId, item.quizId, item.status, item.score, item.valid]),
  });
}

export function getClassFinalization(state: LmsState, classId: string, now: number) {
  const course = state.classes.find(item => item.id === classId);
  const lessons = state.lessons.filter(item => item.classId === classId);
  const finishedLessons = lessons.filter(lesson => getLessonStatus(state, lesson.id, now) === "completed").length;
  const classFinished = !!course && course.totalLessons > 0 && lessons.length === course.totalLessons && finishedLessons === course.totalLessons;
  const quizIds = new Set(state.quizzes.filter(item => item.classId === classId && item.status !== "draft").map(item => item.id));
  const activeAttempts = state.attempts.filter(item => quizIds.has(item.quizId) && (item.status === "active" || item.status === "paused")).length;
  const pendingGradeRequests = state.requests.filter(item => item.classId === classId && item.status === "waiting" && ["attendance-correction", "test-retake"].includes(item.kind)).length;
  const record = state.classFinalizations?.filter(item => item.classId === classId).at(-1);
  const fingerprint = getClassResultFingerprint(state, classId);
  const blockers: string[] = [];
  if (!classFinished) blockers.push("Chưa kết thúc tất cả buổi học bắt buộc.");
  if (activeAttempts) blockers.push(`Còn ${activeAttempts} lượt Quiz đang làm hoặc tạm dừng.`);
  if (pendingGradeRequests) blockers.push(`Còn ${pendingGradeRequests} yêu cầu sửa điểm / làm lại Test đang chờ.`);
  const finalized = !!record && record.fingerprint === fingerprint && blockers.length === 0;
  return { classFinished, finishedLessons, activeAttempts, pendingGradeRequests, record, finalized, blockers, fingerprint };
}

export function getCompletionEligibility(state: LmsState, classId: string, studentId: string, now: number) {
  const course = state.classes.find(item => item.id === classId);
  const progress = getProgressDetails(state, classId, studentId);
  const attendanceThreshold = course?.attendanceThreshold ?? 80;
  const quizThreshold = course?.quizThreshold ?? 70;
  const attendanceMet = progress.requiredSessions > 0 && progress.attendedSessions * 100 >= progress.requiredSessions * attendanceThreshold;
  const quizMet = progress.requiredQuizzes > 0 ? progress.passedQuizzes * 100 >= progress.requiredQuizzes * quizThreshold : quizThreshold === 0;
  const meetsCriteria = !!course && attendanceMet && quizMet;
  const enrolled = state.enrollments.some(item => item.classId === classId && item.studentId === studentId && item.status === "approved");
  const finalization = getClassFinalization(state, classId, now);
  const reasons: string[] = [];
  if (!attendanceMet) reasons.push(`Attendance chưa đạt ngưỡng ${attendanceThreshold}%.`);
  if (!quizMet) reasons.push(`Quiz chưa đạt ngưỡng ${quizThreshold}%.`);
  if (!enrolled) reasons.push("Không có enrollment đã duyệt cho lần học hiện tại.");
  return {
    progress, attendanceThreshold, quizThreshold, attendanceMet, quizMet, meetsCriteria, enrolled, finalization, reasons,
    eligibleToIssue: enrolled && meetsCriteria && finalization.finalized,
    enrollmentCycle: getEnrollmentCycle(state, classId, studentId),
  };
}

export function getCompletionSnapshot(state: LmsState, classId: string, studentId: string, now: number): CompletionSnapshot {
  const course = state.classes.find(item => item.id === classId)!;
  const student = state.users.find(item => item.id === studentId)!;
  const progress = getProgressDetails(state, classId, studentId);
  return {
    className: course.name, classCode: course.code, studentName: student.name, email: student.email ?? "",
    capturedAt: new Date(now).toISOString(), attendedSessions: progress.attendedSessions, requiredSessions: progress.requiredSessions,
    passedQuizzes: progress.passedQuizzes, requiredQuizzes: progress.requiredQuizzes,
    attendancePercent: progress.attendancePercent, quizPercent: progress.quizPercent,
    attendanceThreshold: course.attendanceThreshold ?? 80, quizThreshold: course.quizThreshold ?? 70,
  };
}

export function getCurrentCertificate(state: LmsState, classId: string, studentId: string) {
  const cycle = getEnrollmentCycle(state, classId, studentId);
  return state.certificates?.filter(item => item.classId === classId && item.studentId === studentId && item.enrollmentCycle === cycle).at(-1);
}

export function getUnissuedCompletionApproval(state: LmsState, classId: string, studentId: string) {
  const cycle = getEnrollmentCycle(state, classId, studentId);
  const certificate = getCurrentCertificate(state, classId, studentId);
  const revocation = certificate?.status === "revoked" ? certificate.history.filter(event => event.status === "revoked").at(-1) : undefined;
  const requests = state.completionRequests ?? [];
  const revocationIndex = revocation?.requestId ? requests.findIndex(request => request.id === revocation.requestId) : -1;
  return requests.filter((request, index) => index > revocationIndex && request.kind === "exception" && request.status === "approved" && request.classId === classId && request.studentId === studentId && request.enrollmentCycle === cycle && !state.certificates?.some(item => item.exceptionRequestId === request.id)).at(-1);
}

export function getClassCompletion(state: LmsState, classId: string, now: number) {
  const summary = getClassProgress(state, classId);
  const students = summary.students.map(row => ({ ...row, eligibility: getCompletionEligibility(state, classId, row.student.id, now), certificate: getCurrentCertificate(state, classId, row.student.id) }));
  const certificates = (state.certificates ?? []).filter(item => item.classId === classId);
  return {
    ...summary, students, certificates, finalization: getClassFinalization(state, classId, now),
    eligible: students.filter(row => row.eligibility.meetsCriteria).length,
    ineligible: students.filter(row => !row.eligibility.meetsCriteria).length,
    issued: certificates.filter(item => item.status === "issued").length,
    underReview: certificates.filter(item => item.status === "under-review").length,
    revoked: certificates.filter(item => item.status === "revoked").length,
  };
}

export function getProgressClasses(state: LmsState, actorId: string) {
  const actor = state.users.find(item => item.id === actorId);
  if (!actor || actor.status === "suspended") return [];
  return state.classes.filter(course => {
    if (actor.role === "admin") return true;
    if (actor.role === "teacher") return course.teacherId === actorId;
    return state.enrollments.some(item => item.classId === course.id && item.studentId === actorId && item.status === "approved")
      || state.certificates?.some(item => item.classId === course.id && item.studentId === actorId)
      || state.completionAppeals?.some(item => item.classId === course.id && item.studentId === actorId)
      || state.classFinalizations?.some(item => item.classId === course.id && item.snapshots?.some(row => row.studentId === actorId));
  });
}

export function getCompletionApprovers(state: LmsState, request: CompletionRequest) {
  const sender = state.users.find(item => item.id === request.senderId);
  if (sender?.role === "teacher") return state.users.filter(item => item.role === "admin").map(item => item.id);
  const course = state.classes.find(item => item.id === request.classId);
  return course ? [course.teacherId] : [];
}

export function getCompletionDecisionAccess(state: LmsState, actorId: string, request: CompletionRequest, now: number) {
  const actor = state.users.find(item => item.id === actorId);
  const course = state.classes.find(item => item.id === request.classId);
  const manages = actor?.role === "admin" || (actor?.role === "teacher" && course?.teacherId === actor.id);
  const available = !!actor && actor.status !== "suspended" && manages && request.status === "waiting";
  return {
    crossApproval: available && request.senderId !== actorId && getCompletionApprovers(state, request).includes(actorId),
    timeout: available && request.senderId === actorId && now >= Date.parse(request.createdAt) + approvalWaitMs,
    availableAt: Date.parse(request.createdAt) + approvalWaitMs,
  };
}
