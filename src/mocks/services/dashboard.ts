import { baseState } from "../state.ts";
import type { LmsState } from "../../types/lms.ts";
import { dateInBangkok } from "./management.ts";
import { getAttemptRemaining, getQuizAvailability } from "./quizzes.ts";
import { getLessonStatus } from "./lessons.ts";
import { getClassProgress, getProgressDetails } from "./progress.ts";

export function getStudentProgress(classId: string, studentId: string, state: LmsState = baseState) {
  const progress = getProgressDetails(state, classId, studentId);
  return { attendance: Math.round(progress.attendancePercent), quiz: Math.round(progress.quizPercent) };
}
export function getDashboard(state: LmsState = baseState) {
  const { classes, lessons, users, requests, notifications, referenceTime } = state;
  const classRows = classes.map(c => {
    const progress = getClassProgress(state, c.id);
    return { ...c, teacher: users.find(u => u.id === c.teacherId)!, students: progress.students.length, completedLessons: lessons.filter(l => l.classId === c.id && getLessonStatus(state,l.id,Date.parse(referenceTime)) === "completed").length, attendance: progress.attendance, quiz: progress.quiz };
  });
  return {
    referenceTime,
    stats: { students: users.filter(u => u.role === "student").length, teachers: users.filter(u => u.role === "teacher").length, classes: classes.length, pending: requests.filter(r => r.kind === "schedule" && r.status === "waiting").length },
    classes: classRows,
    requests: requests.filter(r => r.kind === "schedule").map(r => enrichRequest(r, state)),
    activities: notifications.filter(n => n.recipientId === "a1"),
  };
}
export type DashboardData = ReturnType<typeof getDashboard>;
export type ClassRow = DashboardData["classes"][number];

function enrichRequest(request: LmsState["requests"][number], state: LmsState = baseState) {
  const { classes, users, quizzes } = state;
  return { ...request, course: classes.find(c => c.id === request.classId)!, sender: users.find(u => u.id === request.senderId)!, quiz: quizzes.find(q => q.id === request.quizId) };
}

function getUpcomingLessons(classIds: Set<string>, state: LmsState = baseState) {
  const { schedules, lessons, classes, referenceTime } = state;
  return schedules.flatMap(schedule => {
    const lesson = lessons.find(l => l.id === schedule.lessonId);
    const course = classes.find(c => c.id === lesson?.classId);
    if (!lesson || !course || lesson.completed || !classIds.has(course.id) || !["confirmed", "approved"].includes(schedule.status) || Date.parse(schedule.startsAt) <= Date.parse(referenceTime) || course.expiresAt < dateInBangkok(Date.parse(referenceTime))) return [];
    return [{ ...schedule, classId: course.id, lesson, course }];
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export function getTeacherDashboard(teacherId: string, state: LmsState = baseState) {
  const { users, requests, notifications, referenceTime } = state;
  const ownedClasses = getDashboard(state).classes.filter(c => c.teacherId === teacherId && users.some(u => u.id === teacherId && u.role === "teacher"));
  const classIds = new Set(ownedClasses.map(c => c.id));
  const pending = requests.filter(r => classIds.has(r.classId) && r.status === "waiting").map(r => enrichRequest(r, state));
  return {
    referenceTime, classes: ownedClasses,
    enrollmentRequests: pending.filter(r => r.kind === "enrollment"),
    retakeRequests: pending.filter(r => r.kind === "test-retake" && r.quiz?.kind === "test"),
    upcomingLessons: getUpcomingLessons(classIds, state),
    notifications: notifications.filter(n => n.recipientId === teacherId),
  };
}

export function getStudentDashboard(studentId: string, state: LmsState = baseState) {
  const { enrollments, users, referenceTime, quizzes, assignmentDrafts, notifications } = state;
  const registered = new Set(enrollments.filter(e => e.studentId === studentId && e.status === "approved" && users.some(u => u.id === studentId && u.role === "student")).map(e => e.classId));
  const day = new Date(Date.parse(referenceTime) + 7 * 3600000).toISOString().slice(0, 10);
  const registeredClasses = getDashboard(state).classes.filter(c => registered.has(c.id) && c.expiresAt >= day).map(c => ({ ...c, progress: getStudentProgress(c.id, studentId, state) }));
  const classIds = new Set(registeredClasses.map(c => c.id));
  const deadlines = quizzes.map(q => ({ ...q, dueAt: getQuizAvailability(state, q.id, studentId, Date.parse(referenceTime)).effectiveDueAt })).filter(q => q.status !== "draft" && classIds.has(q.classId) && q.kind === "assignment" && Date.parse(q.opensAt) <= Date.parse(referenceTime) && Date.parse(q.dueAt) > Date.parse(referenceTime)).map(q => ({ ...q, course: registeredClasses.find(c => c.id === q.classId)! })).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const activeDrafts = state.attempts.filter(a => a.studentId === studentId && (a.status === "active" || a.status === "paused")).flatMap(a => {
    const quiz = deadlines.find(q => q.id === a.quizId);
    return quiz ? [{ studentId, quizId: quiz.id, answeredQuestions: Object.keys(a.answers ?? {}).length, totalQuestions: a.questions?.length ?? 0, remainingMinutes: Math.ceil(getAttemptRemaining(a, Date.parse(referenceTime)) / 60000), updatedAt: a.lastResumedAt ?? a.startedAt ?? referenceTime, quiz, course: quiz.course }] : [];
  });
  const drafts = [...activeDrafts, ...assignmentDrafts.filter(d => d.studentId === studentId).flatMap(draft => {
    const quiz = deadlines.find(q => q.id === draft.quizId);
    return quiz ? [{ ...draft, quiz, course: quiz.course }] : [];
  })].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return {
    referenceTime, classes: registeredClasses, deadlines,
    continueLearning: drafts[0] ?? null,
    upcomingLessons: getUpcomingLessons(classIds, state),
    notifications: notifications.filter(n => n.recipientId === studentId),
  };
}
export type TeacherDashboardData = ReturnType<typeof getTeacherDashboard>;
export type StudentDashboardData = ReturnType<typeof getStudentDashboard>;
export type RequestRow = ReturnType<typeof enrichRequest>;
export type UpcomingLesson = ReturnType<typeof getUpcomingLessons>[number];
