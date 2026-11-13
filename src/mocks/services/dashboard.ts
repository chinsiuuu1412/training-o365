import { baseState } from "../state.ts";
import type { LmsState } from "../../types/lms.ts";
import { dateInBangkok } from "./management.ts";
import { getLessonStatus } from "./lessons.ts";

export function getStudentProgress(classId: string, studentId: string, state: LmsState = baseState) {
  const { classes, lessons, attendance, quizzes, attempts } = state;
  const course = classes.find(c => c.id === classId);
  if (!course) return { attendance: 0, quiz: 0 };
  const lessonIds = new Set(lessons.filter(l => l.classId === classId).map(l => l.id));
  const recorded = new Set(attendance.filter(a => a.studentId === studentId && a.recorded && lessonIds.has(a.lessonId)).map(a => a.lessonId));
  const classQuizzes = quizzes.filter(q => q.classId === classId);
  const passed = classQuizzes.filter(q => attempts.some(a => a.quizId === q.id && a.studentId === studentId && a.valid && a.score >= q.passingScore)).length;
  return { attendance: course.totalLessons ? Math.round(recorded.size / course.totalLessons * 100) : 0, quiz: classQuizzes.length ? Math.round(passed / classQuizzes.length * 100) : 0 };
}
export function getDashboard(state: LmsState = baseState) {
  const { classes, enrollments, lessons, users, requests, notifications, referenceTime } = state;
  const classRows = classes.map(c => {
    const members = enrollments.filter(e => e.classId === c.id && e.status === "approved");
    const progress = members.map(e => getStudentProgress(c.id, e.studentId, state));
    const average = (key: "attendance" | "quiz") => progress.length ? Math.round(progress.reduce((sum, p) => sum + p[key], 0) / progress.length) : 0;
    return { ...c, teacher: users.find(u => u.id === c.teacherId)!, students: members.length, completedLessons: lessons.filter(l => l.classId === c.id && getLessonStatus(state,l.id,Date.parse(referenceTime)) === "completed").length, attendance: average("attendance"), quiz: average("quiz") };
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
  const deadlines = quizzes.filter(q => classIds.has(q.classId) && q.kind === "assignment" && Date.parse(q.opensAt) <= Date.parse(referenceTime) && Date.parse(q.dueAt) > Date.parse(referenceTime)).map(q => ({ ...q, course: registeredClasses.find(c => c.id === q.classId)! })).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const drafts = assignmentDrafts.filter(d => d.studentId === studentId).flatMap(draft => {
    const quiz = deadlines.find(q => q.id === draft.quizId);
    return quiz ? [{ ...draft, quiz, course: quiz.course }] : [];
  }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
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
