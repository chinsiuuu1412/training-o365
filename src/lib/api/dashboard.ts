import { ApiClient } from './client.ts';
import { protocol } from './accounts.ts';
import { object, text, positiveId, count, items } from './dto.ts';
import { classFromDto, summaryFromDto, progressFromDto } from './classes.ts';
import { enrollmentFromDto } from './enrollments.ts';
import type { Role } from '../../types/lms.ts';
import { sessionFromDto } from './sessions.ts';
export { sessionFromDto } from './sessions.ts';
function quizSummary(value: unknown) {
    const r = object(value);
    return {
        id: positiveId(r.id), class_id: positiveId(r.class_id), title: text(r.title), quiz_type: text(r.quiz_type), open_at: text(r.open_at), deadline: text(r.effective_deadline ?? r.deadline)
    };
}
export function dashboardFromDto(value: unknown, role: Role) {
    const r = object(value), a = object(r.agenda);
    return {
        classes: items(r.classes, value => {
            const row = object(value);
            return {
                class: role === 'student' ? summaryFromDto(row.class) : classFromDto(row.class), enrollments: items(row.enrollments, value => {
                    const entry = object(value), enrollment = enrollmentFromDto(entry.enrollment), progress = progressFromDto(entry.progress);
                    if (progress.enrollment_id !== enrollment.id)
                        throw new Error('Dashboard sai cycle.');
                    return {
                        enrollment, progress
                    };
                })
            };
        }), enrolled_count: count(r.enrolled_count), unread_count: count(r.unread_count), ...(role === 'admin' ? {
            student_count: count(r.student_count), manager_count: count(r.manager_count), pending_schedules: count(r.pending_schedules)
        } : {}), agenda: {
            upcoming_sessions: items(a.upcoming_sessions, sessionFromDto), quizzes: items(a.quizzes, quizSummary), active_attempts: items(a.active_attempts, value => {
                const item = object(value), attempt = object(item.attempt);
                return {
                    attempt_id: positiveId(attempt.id), enrollment_id: positiveId(attempt.enrollment_id), quiz: quizSummary(item.quiz)
                };
            }), pending_enrollment_requests: count(a.pending_enrollment_requests)
        }
    };
}
export class DashboardService {
    client: ApiClient;
    constructor(client: ApiClient) {
        this.client = client;
    }
    async get(role: Role) {
        const value = await this.client.request('/' + role + '/dashboard');
        return protocol(() => dashboardFromDto(value, role));
    }
}
