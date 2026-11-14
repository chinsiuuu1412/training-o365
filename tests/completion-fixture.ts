import { createInitialState } from "../src/mocks/state.ts";

export const completionTime = Date.parse("2026-11-22T02:00:00Z");
export const completionClass = "giai-tich";

export function completedClassFixture() {
  const state = createInitialState();
  const course = state.classes.find(item => item.id === completionClass)!;
  course.totalLessons = 2;
  course.attendanceThreshold = 50;
  course.quizThreshold = 50;
  const oldLessonIds = new Set(state.lessons.filter(item => item.classId === course.id).map(item => item.id));
  const oldQuizIds = new Set(state.quizzes.filter(item => item.classId === course.id).map(item => item.id));
  state.lessons = state.lessons.filter(item => item.classId !== course.id);
  state.lessons.push(
    { id: "giai-tich-l1", classId: course.id, name: "Buổi 1", completed: true, materialIds: [] },
    { id: "giai-tich-l2", classId: course.id, name: "Buổi 2", completed: true, materialIds: [] },
  );
  const requiredQuizzes = state.quizzes.filter(item => item.classId === course.id).slice(0, 2);
  state.quizzes = state.quizzes.filter(item => item.classId !== course.id);
  state.quizzes.push(...requiredQuizzes);
  state.schedules = state.schedules.filter(item => !oldLessonIds.has(item.lessonId));
  state.requests = state.requests.filter(item => item.classId !== course.id);
  state.assignmentDrafts = state.assignmentDrafts.filter(item => !oldQuizIds.has(item.quizId));
  state.attendance = state.attendance.filter(item => !oldLessonIds.has(item.lessonId));
  state.attendance.push(
    { studentId: "s1", lessonId: "giai-tich-l1", recorded: true },
    { studentId: "s1", lessonId: "giai-tich-l2", recorded: true },
  );
  state.attempts = state.attempts.filter(item => !oldQuizIds.has(item.quizId));
  state.attempts.push(...requiredQuizzes.map((quiz, index) => ({ id: `fixture-attempt-${index}`, quizId: quiz.id, studentId: "s1", score: 100, valid: true, status: "submitted" as const })));
  state.referenceTime = new Date(completionTime).toISOString();
  return state;
}
