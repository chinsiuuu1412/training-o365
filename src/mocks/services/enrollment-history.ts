import type { LmsState } from '../../types/lms.ts';
import { getProgressDetails } from './progress.ts';
import { isClassExpired } from './class-policy.ts';

export function getEnrollmentHistory(state: LmsState, actorId: string, now: number, classId?: string) {
  const actor = state.users.find(user => user.id === actorId);
  if (!actor || actor.status === 'suspended') return [];
  return (state.enrollmentCycles ?? []).flatMap(cycle => {
    const course = state.classes.find(course => course.id === cycle.classId);
    if (!course || (classId && course.id !== classId) || (actor.role === 'student' && cycle.studentId !== actorId) || (actor.role === 'manager' && course.managerId !== actorId)) return [];
    const raw = getProgressDetails(state, course.id, cycle.studentId, cycle.id);
    const progress = { attendedSessions: raw.attendedSessions, requiredSessions: raw.requiredSessions, passedQuizzes: raw.passedQuizzes, requiredQuizzes: raw.requiredQuizzes, attendancePercent: raw.attendancePercent, quizPercent: raw.quizPercent };
    const attendanceThreshold = course.attendanceThreshold ?? 80, quizThreshold = course.quizThreshold ?? 70;
    const meetsCriteria = progress.attendancePercent >= attendanceThreshold && progress.quizPercent >= quizThreshold;
    const lessons = state.lessons.filter(lesson => lesson.classId === course.id);
    const allFinished = course.totalLessons > 0 && lessons.length === course.totalLessons && lessons.every(lesson => state.schedules.some(schedule => schedule.lessonId === lesson.id && ['approved', 'confirmed'].includes(schedule.status) && Date.parse(schedule.endsAt) <= now));
    const completed = allFinished && meetsCriteria;
    const reasons = [...(!allFinished ? ['Chưa kết thúc tất cả buổi bắt buộc đã được duyệt.'] : []), ...(progress.attendancePercent < attendanceThreshold ? ['Attendance chưa đạt ngưỡng.'] : []), ...(progress.quizPercent < quizThreshold ? ['Quiz chưa đạt ngưỡng.'] : [])];
    return [{ cycleId: cycle.id, classId: course.id, className: course.name, classCode: course.code, studentId: cycle.studentId, studentName: state.users.find(user => user.id === cycle.studentId)?.name ?? 'Học viên', approvedAt: cycle.approvedAt, endedAt: cycle.endedAt, endReason: cycle.endReason, legacy: !!cycle.legacy, ended: cycle.status === 'ended', expired: isClassExpired(course, now), progress, attendanceThreshold, quizThreshold, completed, meetsCriteria, reasons }];
  });
}
