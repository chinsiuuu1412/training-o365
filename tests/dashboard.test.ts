import { test } from "node:test";
import assert from "node:assert/strict";
import { getDashboard, getStudentProgress } from "../src/mocks/services/dashboard.ts";
import * as service from "../src/mocks/services/dashboard.ts";
import { users, classes, enrollments, lessons, attendance, quizzes, attempts, requests, schedules, assignmentDrafts, notifications } from "../src/mocks/seed.ts";
test("seed references point to real entities", () => {
  for (const c of classes) assert(users.some(u => u.id === c.teacherId && u.role === "teacher"));
  for (const e of enrollments) { assert(classes.some(c => c.id === e.classId)); assert(users.some(u => u.id === e.studentId && u.role === "student")); }
  for (const a of attendance) assert(lessons.some(l => l.id === a.lessonId));
  for (const a of attempts) assert(quizzes.some(q => q.id === a.quizId));
  for (const r of requests) { assert(classes.some(c => c.id === r.classId)); assert(users.some(u => u.id === r.senderId)); }
  for (const q of quizzes) assert(classes.some(c => c.id === q.classId));
  for (const s of schedules) { assert(lessons.some(l => l.id === s.lessonId)); assert(Date.parse(s.endsAt) > Date.parse(s.startsAt)); }
  for (const n of notifications) assert(users.some(u => u.id === n.recipientId));
  for (const d of assignmentDrafts) { assert(quizzes.some(q => q.id === d.quizId && q.kind === "assignment")); assert(d.answeredQuestions <= d.totalQuestions); }
  for (const r of requests.filter(r => r.kind === "enrollment")) assert(enrollments.some(e => e.classId === r.classId && e.studentId === r.senderId && e.status === "pending"));
  for (const r of requests.filter(r => r.kind === "schedule")) assert.equal(classes.find(c => c.id === r.classId)!.teacherId, r.senderId);
  for (const r of requests.filter(r => r.kind === "test-retake")) {
    const quiz = quizzes.find(q => q.id === r.quizId)!;
    assert.equal(quiz.kind, "test");
    assert.equal(quiz.classId, r.classId);
    assert(attempts.some(a => a.studentId === r.senderId && a.quizId === quiz.id && a.score < quiz.passingScore));
  }
});
test("progress follows Workflow 8 and deduplicates attempts and attendance", () => {
  const baseline = getStudentProgress("giai-tich", "s1");
  assert.deepEqual(baseline, { attendance: 50, quiz: 50 });
  attendance.push({ ...attendance[1] }); attempts.push({ ...attempts[1] });
  try { assert.deepEqual(getStudentProgress("giai-tich", "s1"), baseline); }
  finally { attendance.pop(); attempts.pop(); }
});
test("unknown class and zero denominators are safe", () => {
  assert.deepEqual(getStudentProgress("missing", "s1"), { attendance: 0, quiz: 0 });
  classes.push({ ...classes[0], id: "empty", totalLessons: 0 });
  try { assert.deepEqual(getStudentProgress("empty", "s1"), { attendance: 0, quiz: 0 }); } finally { classes.pop(); }
});
test("dashboard totals are derived and memberships are not unique student counts", () => {
  const data = getDashboard();
  assert.deepEqual(data.stats, { students: 12, teachers: 3, classes: 3, pending: 3 });
  assert.equal(data.classes.reduce((n, c) => n + c.students, 0), enrollments.filter(e => e.status === "approved").length);
});

test("teacher sees only assigned classes, their pending requests and recipients", () => {
  assert.equal(typeof service.getTeacherDashboard, "function");
  const data = service.getTeacherDashboard("t1");
  assert.deepEqual(data.classes.map(c => c.id), ["giai-tich", "dai-so"]);
  assert.equal(data.enrollmentRequests.length, 1);
  assert.equal(data.retakeRequests.length, 2);
  assert(data.enrollmentRequests.every(r => r.status === "waiting" && r.course.teacherId === "t1"));
  assert(data.retakeRequests.every(r => r.status === "waiting" && r.quiz?.kind === "test"));
  assert(data.notifications.every(n => n.recipientId === "t1"));
  assert(!data.upcomingLessons.some(l => l.classId === "nhap-mon-cntt"));
});

test("student uses shared records, confirmed future lessons and Assignment draft continuation", () => {
  assert.equal(typeof service.getStudentDashboard, "function");
  const data = service.getStudentDashboard("s1");
  assert.equal(data.classes.length, 3);
  const math = data.classes.find(c => c.id === "giai-tich")!;
  assert.equal(math.teacher.id, "t1");
  assert.deepEqual(math.progress, { attendance: 50, quiz: 50 });
  assert.equal(data.continueLearning?.quiz.id, "giai-tich-q6");
  assert.equal(data.continueLearning?.quiz.kind, "assignment");
  assert.equal(data.continueLearning?.answeredQuestions, 4);
  assert(data.upcomingLessons.length > 0);
  assert(data.upcomingLessons.every(l => l.status === "confirmed" && Date.parse(l.startsAt) > Date.parse(data.referenceTime)));
  assert(data.deadlines.every(q => q.kind === "assignment" && Date.parse(q.dueAt) > Date.parse(data.referenceTime)));
  assert.deepEqual(data.deadlines.map(q => q.id), ["giai-tich-q6", "dai-so-q6", "nhap-mon-cntt-q6"]);
  assert(data.notifications.every(n => n.recipientId === "s1"));
});

test("unknown/unassigned roles and pending-only membership return empty scoped data", () => {
  assert.equal(typeof service.getStudentDashboard, "function");
  assert.equal(typeof service.getTeacherDashboard, "function");
  assert.equal(service.getTeacherDashboard("t2").classes.length, 0);
  assert.equal(service.getTeacherDashboard("s1").classes.length, 0);
  assert.equal(service.getStudentDashboard("missing").classes.length, 0);
  const data = service.getStudentDashboard("s3");
  assert(!data.classes.some(c => c.id === "dai-so"));
  assert(!data.deadlines.some(q => q.classId === "dai-so"));
  assert.equal(service.getStudentDashboard("missing").continueLearning, null);
});

test("class statistics average the same student progress shown on student dashboard", () => {
  assert.equal(typeof service.getStudentDashboard, "function");
  const admin = getDashboard();
  for (const row of admin.classes) {
    const members = enrollments.filter(e => e.classId === row.id && e.status === "approved");
    const tracks = members.map(e => service.getStudentDashboard(e.studentId).classes.find(c => c.id === row.id)!.progress);
    assert.equal(row.attendance, Math.round(tracks.reduce((sum, p) => sum + p.attendance, 0) / members.length));
    assert.equal(row.quiz, Math.round(tracks.reduce((sum, p) => sum + p.quiz, 0) / members.length));
  }
});

test("resolved requests, expired classes and past schedules do not appear as pending tasks", () => {
  const request = requests.find(r => r.id === "r4")!;
  const schedule = schedules[0];
  const course = classes[0];
  const prior = { status: request.status, startsAt: schedule.startsAt, expiresAt: course.expiresAt };
  try {
    request.status = "approved";
    assert.equal(service.getTeacherDashboard("t1").enrollmentRequests.length, 0);
    schedule.startsAt = "2026-11-13T18:00:00+07:00";
    assert(!service.getStudentDashboard("s1").upcomingLessons.some(l => l.id === schedule.id));
    course.expiresAt = "2026-11-13";
    const student = service.getStudentDashboard("s1");
    assert(!student.classes.some(c => c.id === course.id));
    assert(!student.deadlines.some(q => q.classId === course.id));
    assert.equal(student.continueLearning, null);
  } finally {
    request.status = prior.status;
    schedule.startsAt = prior.startsAt;
    course.expiresAt = prior.expiresAt;
  }
});
