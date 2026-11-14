import type { LmsState, QuizAttempt } from "../../types/lms.ts";

export function getBestValidScore(attempts: QuizAttempt[]) {
  const scores = attempts.filter(attempt => attempt.valid && attempt.status !== "active" && attempt.status !== "paused").map(attempt => attempt.score);
  return scores.length ? Math.max(...scores) : null;
}

export function getProgressDetails(state: LmsState, classId: string, studentId: string) {
  const course = state.classes.find(item => item.id === classId);
  const lessonIds = new Set(state.lessons.filter(lesson => lesson.classId === classId).map(lesson => lesson.id));
  const attended = new Set(state.attendance.filter(record => record.studentId === studentId && record.recorded && lessonIds.has(record.lessonId)).map(record => record.lessonId)).size;
  const requiredQuizzes = [...new Map(state.quizzes.filter(quiz => quiz.classId === classId && quiz.status !== "draft").map(quiz => [quiz.id, quiz])).values()];
  const quizzes = requiredQuizzes.map(quiz => {
    const attempts = state.attempts.filter(attempt => attempt.quizId === quiz.id && attempt.studentId === studentId);
    const bestScore = getBestValidScore(attempts);
    const passed = bestScore !== null && bestScore >= quiz.passingScore;
    const result: "passed" | "failed" | "not-submitted" = passed ? "passed" : bestScore === null ? "not-submitted" : "failed";
    return {
      quizId: quiz.id, title: quiz.title, kind: quiz.kind, passingScore: quiz.passingScore, bestScore, result,
      submittedAttempts: attempts.filter(attempt => attempt.status !== "active" && attempt.status !== "paused").length,
      inProgress: attempts.some(attempt => attempt.status === "active" || attempt.status === "paused"),
    };
  });
  const requiredSessions = course?.totalLessons ?? 0;
  const passedQuizzes = quizzes.filter(quiz => quiz.result === "passed").length;
  return {
    classId, studentId, requiredSessions, attendedSessions: attended, requiredQuizzes: quizzes.length, passedQuizzes,
    attendancePercent: requiredSessions > 0 ? attended / requiredSessions * 100 : 0,
    quizPercent: quizzes.length > 0 ? passedQuizzes / quizzes.length * 100 : 0,
    quizzes,
  };
}

export type LearnerProgress = ReturnType<typeof getProgressDetails>;

export function getClassProgress(state: LmsState, classId: string) {
  const memberIds = new Set(state.enrollments.filter(enrollment => enrollment.classId === classId && enrollment.status === "approved").map(enrollment => enrollment.studentId));
  const students = state.users.filter(user => user.role === "student" && memberIds.has(user.id)).map(student => ({ student, progress: getProgressDetails(state, classId, student.id) }));
  const requiredSessions = state.classes.find(course => course.id === classId)?.totalLessons ?? 0;
  const requiredQuizzes = students[0]?.progress.requiredQuizzes ?? 0;
  return {
    classId, students,
    attendance: students.length && requiredSessions ? Math.round(students.reduce((sum, row) => sum + row.progress.attendedSessions, 0) * 100 / (students.length * requiredSessions)) : 0,
    quiz: students.length && requiredQuizzes ? Math.round(students.reduce((sum, row) => sum + row.progress.passedQuizzes, 0) * 100 / (students.length * requiredQuizzes)) : 0,
  };
}
