import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/mocks/state.ts";
import { getBestValidScore, getClassProgress, getProgressDetails } from "../src/mocks/services/progress.ts";
import type { LmsState } from "../src/types/lms.ts";
import { completedClassFixture, completionClass, completionTime as now } from "./completion-fixture.ts";
import { execute } from "../src/mocks/services/management.ts";
import { executeCertificate, synchronizeCertificates } from "../src/mocks/services/certificates.ts";
import { getClassFinalization, getCompletionEligibility, getCurrentCertificate, getEnrollmentCycle, getProgressClasses, approvalWaitMs } from "../src/mocks/services/completion.ts";
import { isValidState } from "../src/mocks/state.ts";
import { syncDueQuizAttempts } from "../src/mocks/services/quizzes.ts";

function fixture(): LmsState {
  const state = createInitialState();
  state.classes = [{ ...state.classes[0], totalLessons: 3, attendanceThreshold: 67, quizThreshold: 67 }];
  state.lessons = [1, 2, 3].map(index => ({ id: `lesson-${index}`, classId: "giai-tich", name: `Buổi ${index}`, completed: true }));
  state.quizzes = [1, 2, 3, 4].map(index => ({ ...state.quizzes[0], id: `quiz-${index}`, status: index === 4 ? "draft" : "published", kind: index === 2 ? "assignment" : "test", passingScore: 60 }));
  state.attendance = [
    { studentId: "s1", lessonId: "lesson-1", recorded: true },
    { studentId: "s1", lessonId: "lesson-1", recorded: true },
    { studentId: "s1", lessonId: "lesson-2", recorded: true },
    { studentId: "s1", lessonId: "lesson-3", recorded: false, absenceReason: "Xin nghỉ" },
    { studentId: "s1", lessonId: "other-class-lesson", recorded: true },
  ];
  state.attempts = [
    { quizId: "quiz-1", studentId: "s1", score: 60, valid: true },
    { quizId: "quiz-1", studentId: "s1", score: 40, valid: true },
    { quizId: "quiz-1", studentId: "s1", score: 100, valid: false },
    { quizId: "quiz-2", studentId: "s1", score: 50, valid: true },
    { quizId: "quiz-2", studentId: "s1", score: 90, valid: true },
    { quizId: "quiz-2", studentId: "s1", score: 20, valid: true },
    { quizId: "quiz-3", studentId: "s1", score: 100, valid: false, status: "active" },
    { quizId: "quiz-4", studentId: "s1", score: 100, valid: true },
  ];
  state.enrollments = [
    { classId: "giai-tich", studentId: "s1", status: "approved" },
    { classId: "giai-tich", studentId: "s2", status: "approved" },
    { classId: "giai-tich", studentId: "s3", status: "pending" },
    { classId: "giai-tich", studentId: "s4", status: "removed" },
  ];
  return state;
}

test("deterministic progress excludes absence, foreign sessions, drafts and invalid attempts and counts each requirement once", () => {
  const state = fixture();
  const progress = getProgressDetails(state, "giai-tich", "s1");
  assert.equal(progress.attendedSessions, 2);
  assert.equal(progress.requiredSessions, 3);
  assert.equal(progress.passedQuizzes, 2);
  assert.equal(progress.requiredQuizzes, 3);
  assert.equal(progress.attendancePercent, 2 / 3 * 100);
  assert.equal(progress.quizPercent, 2 / 3 * 100);
  assert.deepEqual(progress.quizzes.map(quiz => quiz.result), ["passed", "passed", "not-submitted"]);
  assert.equal(progress.quizzes[0].bestScore, 60);
  assert.equal(progress.quizzes[1].bestScore, 90);
  assert(progress.quizzes[2].inProgress);
  state.attempts.push({ ...state.attempts[0] });
  assert.equal(getProgressDetails(state, "giai-tich", "s1").passedQuizzes, 2);
});

test("best valid score preserves a pass through lower retakes and treats valid zero as failed", () => {
  const state = fixture();
  assert.equal(getBestValidScore(state.attempts.filter(attempt => attempt.quizId === "quiz-2")), 90);
  state.attempts.push({ quizId: "quiz-3", studentId: "s1", score: 0, valid: true, status: "submitted" });
  const quiz = getProgressDetails(state, "giai-tich", "s1").quizzes[2];
  assert.equal(quiz.bestScore, 0);
  assert.equal(quiz.result, "failed");
});

test("class summaries derive from approved Student records and empty requirements avoid NaN", () => {
  const state = fixture();
  const summary = getClassProgress(state, "giai-tich");
  assert.deepEqual(summary.students.map(row => row.student.id), ["s1", "s2"]);
  assert.equal(summary.attendance, 33);
  assert.equal(summary.quiz, 33);
  state.classes[0].totalLessons = 0;
  state.quizzes = [];
  const progress = getProgressDetails(state, "giai-tich", "s1");
  assert.equal(progress.attendancePercent, 0);
  assert.equal(progress.quizPercent, 0);
  assert.equal(getProgressDetails(state, "missing", "s1").attendancePercent, 0);
});

function finalize(state = completedClassFixture()) {
  return execute(state, "t1", { type: "finalizeClassResults", classId: completionClass }, now);
}

function propose(state: LmsState, kind: "exception" | "revoke", actorId = "t1", studentId = "s2", certificateId?: string) {
  return execute(state, actorId, { type: "requestCompletion", classId: completionClass, studentId, kind, reason: "Xem xét hồ sơ và hoàn cảnh thực tế", certificateId }, now);
}

test("eligibility uses exact fractions and configured thresholds instead of rounded display values", () => {
  const state = fixture();
  const result = getCompletionEligibility(state, completionClass, "s1", now);
  assert.equal(Math.round(result.progress.attendancePercent), 67);
  assert(!result.attendanceMet);
  assert(!result.quizMet);
  assert(!result.meetsCriteria);
  state.classes[0].attendanceThreshold = 66;
  state.classes[0].quizThreshold = 66;
  assert(getCompletionEligibility(state, completionClass, "s1", now).meetsCriteria);
});

test("ordinary issuance waits for class results finalization and creates one immutable snapshot and simulated email", () => {
  const original = completedClassFixture();
  assert(isValidState(original));
  assert.equal(synchronizeCertificates(original, now), original);
  const state = finalize(original);
  const certificate = getCurrentCertificate(state, completionClass, "s1")!;
  assert.equal(certificate.status, "issued");
  assert.equal(certificate.basis, "criteria");
  assert.equal(certificate.snapshot.attendancePercent, 100);
  assert.equal(state.classFinalizations![0].snapshots!.find(row => row.studentId === "s2")!.snapshot.quizPercent, 0);
  assert.equal(certificate.deliveries[0].status, "simulated");
  assert.equal(certificate.deliveries[0].email, "s1@hocviet.example");
  assert.equal(synchronizeCertificates(state, now + 1000), state);
  assert.equal(finalize(state).certificates!.length, 1);
  assert.equal(original.certificates, undefined);
  assert(isValidState(state));
});

test("finalization rejects unfinished sessions, active/paused attempts and pending grade or retake requests", () => {
  const state = completedClassFixture();
  state.lessons.find(item => item.id === "giai-tich-l2")!.completed = false;
  assert.throws(() => finalize(state));
  state.lessons.find(item => item.id === "giai-tich-l2")!.completed = true;
  Object.assign(state.attempts.find(item => item.id === "fixture-attempt-0")!, {
    status: "active", valid: false, startedAt: new Date(now).toISOString(), lastResumedAt: new Date(now).toISOString(),
    dueAt: new Date(now + 3600000).toISOString(), remainingMs: 60000, answers: {},
    questions: state.quizzes.find(item => item.id === "giai-tich-q1")!.questions,
  });
  assert.throws(() => finalize(state));
  state.attempts.find(item => item.id === "fixture-attempt-0")!.status = "paused";
  assert.throws(() => finalize(state));
  state.attempts.find(item => item.id === "fixture-attempt-0")!.status = "submitted";
  state.requests.push({ id: "retake-blocker", classId: completionClass, senderId: "s1", title: "Làm lại", description: "Lý do", kind: "test-retake", quizId: "giai-tich-q1", status: "waiting", createdAt: new Date(now).toISOString() });
  assert.throws(() => finalize(state));
  state.requests[0].kind = "attendance-correction";
  assert.throws(() => finalize(state));
});

test("grade changes invalidate finalization, preserve issued snapshot and trigger review once without auto-creating revocation", () => {
  const state = finalize();
  for (const attempt of state.attempts.filter(item => item.studentId === "s1" && item.quizId.startsWith("giai-tich"))) attempt.score = 0;
  assert(!getClassFinalization(state, completionClass, now).finalized);
  const reviewed = synchronizeCertificates(state, now + 1);
  const certificate = getCurrentCertificate(reviewed, completionClass, "s1")!;
  assert.equal(certificate.status, "under-review");
  assert.equal(certificate.snapshot.quizPercent, 100);
  assert.equal(reviewed.completionRequests?.length ?? 0, 0);
  assert.equal(synchronizeCertificates(reviewed, now + 2), reviewed);
});

test("recovery restores ordinary certificate and cancels pending revocation across roles", () => {
  let state = finalize();
  for (const attempt of state.attempts.filter(item => item.studentId === "s1" && item.quizId.startsWith("giai-tich"))) attempt.score = 0;
  state = synchronizeCertificates(state, now);
  const certificate = getCurrentCertificate(state, completionClass, "s1")!;
  state = propose(state, "revoke", "t1", "s1", certificate.id);
  state.attempts.find(item => item.id === "fixture-attempt-0")!.score = 100;
  state = synchronizeCertificates(state, now + 1);
  assert.equal(getCurrentCertificate(state, completionClass, "s1")!.status, "issued");
  assert.equal(state.completionRequests!.at(-1)!.status, "cancelled");
});

test("Teacher exceptions require Admin cross-approval, preserve real progress and stay effective after later point reductions", () => {
  let state = completedClassFixture();
  state.attendance.push({ studentId: "s2", lessonId: "giai-tich-l1", recorded: true });
  state = finalize(state);
  state = propose(state, "exception");
  const id = state.completionRequests!.at(-1)!.id;
  assert.throws(() => execute(state, "t1", { type: "decideCompletion", requestId: id, approved: true, reason: "" }, now));
  assert.throws(() => execute(state, "t3", { type: "decideCompletion", requestId: id, approved: true, reason: "" }, now));
  state = execute(state, "a1", { type: "decideCompletion", requestId: id, approved: true, reason: "Đồng ý ngoại lệ" }, now);
  assert.equal(getProgressDetails(state, completionClass, "s2").quizPercent, 0);
  assert.equal(getCurrentCertificate(state, completionClass, "s2")!.basis, "exception");
  state.attendance.find(item => item.studentId === "s2" && item.lessonId === "giai-tich-l1")!.recorded = false;
  state = synchronizeCertificates(state, now + 1);
  assert.equal(getCurrentCertificate(state, completionClass, "s2")!.status, "issued");
});

test("Admin proposals require the currently assigned Teacher and exceptions still wait for finalized results", () => {
  let state = propose(completedClassFixture(), "exception", "a1");
  const id = state.completionRequests!.at(-1)!.id;
  assert.throws(() => execute(state, "a1", { type: "decideCompletion", requestId: id, approved: true, reason: "" }, now));
  assert.throws(() => execute(state, "t3", { type: "decideCompletion", requestId: id, approved: true, reason: "" }, now));
  state = execute(state, "t1", { type: "decideCompletion", requestId: id, approved: true, reason: "" }, now);
  assert.equal(state.certificates?.length ?? 0, 0);
  state = finalize(state);
  assert.equal(getCurrentCertificate(state, completionClass, "s2")!.status, "issued");
});

test("self-decision is explicit, belongs to initiator and is allowed at the exact 24-hour boundary", () => {
  let state = propose(finalize(), "exception");
  const requestId = state.completionRequests!.at(-1)!.id;
  const command = { type: "decideCompletion" as const, requestId, approved: true, reason: "Tự quyết theo quy định 24 giờ", useTimeout: true };
  assert.throws(() => execute(state, "t1", command, now + approvalWaitMs - 1));
  assert.throws(() => execute(state, "a1", command, now + approvalWaitMs));
  state = execute(state, "t1", command, now + approvalWaitMs);
  assert.equal(state.completionRequests!.at(-1)!.decisionMode, "timeout");
  assert.equal(getCurrentCertificate(state, completionClass, "s2")!.status, "issued");
  assert.throws(() => execute(state, "t1", command, now + approvalWaitMs + 1));
});

test("revocation requires cross-approval, never auto-reissues, and approved reissue creates a separate certificate", () => {
  let state = finalize();
  const first = getCurrentCertificate(state, completionClass, "s1")!;
  state = propose(state, "revoke", "t1", "s1", first.id);
  const revokeId = state.completionRequests!.at(-1)!.id;
  assert.equal(getCurrentCertificate(state, completionClass, "s1")!.status, "under-review");
  state = execute(state, "a1", { type: "decideCompletion", requestId: revokeId, approved: true, reason: "Đã kiểm tra đề xuất" }, now);
  assert.equal(getCurrentCertificate(state, completionClass, "s1")!.status, "revoked");
  assert.equal(synchronizeCertificates(state, now + 1), state);
  state = propose(state, "exception", "a1", "s1");
  state = execute(state, "t1", { type: "decideCompletion", requestId: state.completionRequests!.at(-1)!.id, approved: true, reason: "Duyệt cấp lại" }, now + 2);
  assert.equal(state.certificates!.length, 2);
  assert.notEqual(getCurrentCertificate(state, completionClass, "s1")!.id, first.id);
  assert.equal(state.certificates![0].status, "revoked");
});

test("rejected revocation keeps Issued and does not loop into automatic review for unchanged evidence", () => {
  let state = finalize();
  for (const attempt of state.attempts.filter(item => item.quizId.startsWith("giai-tich"))) attempt.score = 0;
  state = synchronizeCertificates(state, now);
  state = propose(state, "revoke", "a1", "s1", state.certificates![0].id);
  const requestId = state.completionRequests!.at(-1)!.id;
  assert.throws(() => execute(state, "t1", { type: "decideCompletion", requestId, approved: false, reason: "" }, now));
  state = execute(state, "t1", { type: "decideCompletion", requestId, approved: false, reason: "Giữ nguyên chứng chỉ" }, now);
  assert.equal(state.certificates![0].status, "issued");
  assert.equal(synchronizeCertificates(state, now + 1), state);
});

test("appeals go through Teacher acceptance and Admin review; expired enrolled Students retain this right", () => {
  let state = finalize();
  state.classes.find(item => item.id === completionClass)!.expiresAt = "2026-11-21";
  state = execute(state, "s2", { type: "appealCompletion", classId: completionClass, reason: "Xin xem xét hoàn cảnh" }, now);
  const appealId = state.completionAppeals![0].id;
  assert.throws(() => execute(state, "s2", { type: "appealCompletion", classId: completionClass, reason: "Gửi trùng" }, now));
  assert.throws(() => execute(state, "a1", { type: "reviewCompletionAppeal", appealId, forward: true, reason: "" }, now));
  state = execute(state, "t1", { type: "reviewCompletionAppeal", appealId, forward: true, reason: "Tiếp nhận khiếu nại" }, now);
  assert.equal(state.completionAppeals![0].status, "forwarded");
  state = execute(state, "a1", { type: "decideCompletion", requestId: state.completionRequests!.at(-1)!.id, approved: true, reason: "Chấp thuận" }, now);
  assert.equal(state.completionAppeals![0].status, "approved");
  assert.equal(getCurrentCertificate(state, completionClass, "s2")!.basis, "exception");
});

test("re-enrollment creates a new cycle and zero progress while preserving prior certificate and snapshot", () => {
  let state = finalize();
  const oldCycle = getEnrollmentCycle(state, completionClass, "s1");
  const oldCertificate = state.certificates![0];
  state = execute(state, "t1", { type: "removeStudent", classId: completionClass, studentId: "s1", reason: "Kết thúc lần học" }, now);
  assert.throws(() => execute(state, "s1", { type: "appealCompletion", classId: completionClass, reason: "Không còn enrollment" }, now));
  state = execute(state, "s1", { type: "requestEnrollment", classId: completionClass, reason: "Đăng ký lần học mới" }, now);
  state = execute(state, "t1", { type: "decideEnrollment", requestId: state.requests.at(-1)!.id, decision: "approved", reason: "" }, now);
  state = synchronizeCertificates(state, now);
  assert.notEqual(getEnrollmentCycle(state, completionClass, "s1"), oldCycle);
  assert.equal(getProgressDetails(state, completionClass, "s1").quizPercent, 0);
  assert.equal(getCurrentCertificate(state, completionClass, "s1"), undefined);
  assert.equal(state.certificates![0].status, "issued");
  assert.deepEqual(state.certificates![0].snapshot, oldCertificate.snapshot);
});

test("authorization, stale enrollment cancellation and malformed certificate snapshots are enforced", () => {
  const original = completedClassFixture();
  for (const actorId of ["s1", "t3"]) assert.throws(() => execute(original, actorId, { type: "finalizeClassResults", classId: completionClass }, now));
  const suspended = structuredClone(original);
  suspended.users.find(item => item.id === "t1")!.status = "suspended";
  assert.throws(() => executeCertificate(suspended, "t1", { type: "finalizeClassResults", classId: completionClass }, now));
  let state = propose(finalize(original), "exception");
  state = execute(state, "t1", { type: "removeStudent", classId: completionClass, studentId: "s2", reason: "Rời lớp" }, now);
  state = synchronizeCertificates(state, now);
  assert.equal(state.completionRequests![0].status, "cancelled");
  assert(isValidState(state));
  const corrupt = structuredClone(state);
  corrupt.certificates![0].snapshot.attendancePercent = Number.NaN;
  assert(!isValidState(corrupt));
});

test("removed ineligible Student retains access to finalized snapshot without any certificate or appeal", () => {
  let state = finalize();
  assert(!state.certificates!.some(item => item.studentId === "s2"));
  assert.equal(state.completionAppeals?.length ?? 0, 0);
  state = execute(state, "t1", { type: "removeStudent", classId: completionClass, studentId: "s2", reason: "Rời lớp" }, now);
  assert(getProgressClasses(state, "s2").some(item => item.id === completionClass));
  assert.equal(state.classFinalizations![0].snapshots!.find(item => item.studentId === "s2")!.snapshot.quizPercent, 0);
});

test("passing automatic submission restores eligibility before a stale revocation approval can execute", () => {
  let state = completedClassFixture();
  state.classes.find(item => item.id === completionClass)!.quizThreshold = 100;
  state = finalize(state);
  const certificateId = state.certificates![0].id;
  const template = state.quizzes.find(item => item.classId === completionClass && item.kind === "assignment")!;
  const quiz = { ...template, id: "race-assignment", opensAt: new Date(now - 1000).toISOString(), dueAt: new Date(now + 3600000).toISOString(), timeLimitMinutes: 1 };
  state.quizzes.push(quiz);
  state = synchronizeCertificates(state, now);
  state = propose(state, "revoke", "t1", "s1", certificateId);
  const requestId = state.completionRequests!.at(-1)!.id;
  state = execute(state, "s1", { type: "startQuiz", quizId: quiz.id }, now);
  const attemptId = state.attempts.at(-1)!.id!;
  for (const question of quiz.questions!) state = execute(state, "s1", { type: "answerQuiz", attemptId, questionId: question.id, optionId: question.correctOptionId }, now);
  const submitted = syncDueQuizAttempts(state, now + 60000);
  assert(getCompletionEligibility(submitted, completionClass, "s1", now + 60000).meetsCriteria);
  assert.throws(() => execute(submitted, "a1", { type: "decideCompletion", requestId, approved: true, reason: "Quyết định từ màn hình cũ" }, now + 60000), /không còn chờ duyệt/);
  const recovered = synchronizeCertificates(submitted, now + 60000);
  assert.equal(recovered.certificates![0].status, "issued");
  assert.equal(recovered.completionRequests![0].status, "cancelled");
});
