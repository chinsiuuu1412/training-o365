import { ApiClient } from './client.ts';
import { accountFromDto, requiredText, protocol, type Account } from './accounts.ts';
import { object, text, positiveId, nullable, numeric, count, bool, items, pageOf, enrollmentId, type EnrollmentId } from './dto.ts';
import type { Role } from '../../types/lms.ts';
export interface ClassSummary {
    id: number;
    code: string;
    name: string;
    end_date: string;
}
export interface ApiClass extends ClassSummary {
    description: string;
    manager_id: number;
    capacity: number;
    expires_at: string;
    total_sessions: number | null;
    min_attendance_percent: number;
    min_quiz_percent: number;
    is_expired: boolean;
    manager: Account;
    enrolled_count: number;
    ended_sessions: number;
    is_enrolled?: boolean;
}
export function isApiClass(course: ClassSummary): course is ApiClass {
    return 'manager_id' in course;
}
export interface Progress {
    enrollment_id: EnrollmentId;
    attendance_count: number;
    total_sessions: number;
    attendance_percent: number;
    passed_quiz_count: number;
    published_quiz_count: number;
    quiz_percent: number;
    ended_sessions: number;
    completed: boolean;
    incomplete_reasons: string[];
}
export function classCardData(course: ApiClass) {
    return {
        id: String(course.id), name: course.name, code: course.code, color: 'blue', manager: {
            name: course.manager.name
        }, students: course.enrolled_count, capacity: course.capacity, completedLessons: course.ended_sessions, totalLessons: course.total_sessions ?? 0, expiresAt: course.end_date, description: course.description
    };
}
export function summaryFromDto(value: unknown): ClassSummary {
    const r = object(value);
    return {
        id: positiveId(r.id), code: text(r.code), name: text(r.name), end_date: text(r.end_date)
    };
}
export function classFromDto(value: unknown): ApiClass {
    const r = object(value);
    return {
        ...summaryFromDto(r), description: text(r.description), manager_id: positiveId(r.manager_id), capacity: positiveId(r.capacity), expires_at: text(r.expires_at), total_sessions: nullable(positiveId)(r.total_sessions), min_attendance_percent: numeric(r.min_attendance_percent), min_quiz_percent: numeric(r.min_quiz_percent), is_expired: bool(r.is_expired), manager: accountFromDto(r.manager), enrolled_count: count(r.enrolled_count), ended_sessions: count(r.ended_sessions), ...(r.is_enrolled !== undefined ? {
            is_enrolled: bool(r.is_enrolled)
        } : {})
    };
}
export function progressFromDto(value: unknown): Progress {
    const r = object(value);
    return {
        enrollment_id: enrollmentId(r.enrollment_id), attendance_count: count(r.attendance_count), total_sessions: count(r.total_sessions), attendance_percent: numeric(r.attendance_percent), passed_quiz_count: count(r.passed_quiz_count), published_quiz_count: count(r.published_quiz_count), quiz_percent: numeric(r.quiz_percent), ended_sessions: count(r.ended_sessions), completed: bool(r.completed), incomplete_reasons: items(r.incomplete_reasons, text)
    };
}
export function validateClassInput(input: Record<string, unknown>) {
    const end = requiredText(input.end_date, 'Ngày hết hạn');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || new Date(end + 'T00:00:00Z').toISOString().slice(0, 10) !== end)
        throw new Error('Ngày hết hạn không hợp lệ.');
    const body: Record<string, unknown> = {
        code: requiredText(input.code, 'Mã lớp', 60).toUpperCase(), name: requiredText(input.name, 'Tên lớp'), description: text(input.description), manager_id: positiveId(input.manager_id), capacity: positiveId(input.capacity), end_date: end, min_attendance_percent: numeric(input.min_attendance_percent), min_quiz_percent: numeric(input.min_quiz_percent)
    };
    if (Array.from(body.description as string).length > 10000 || [body.min_attendance_percent, body.min_quiz_percent].some(v => (v as number) < 0 || (v as number) > 100))
        throw new Error('Mô tả hoặc ngưỡng lớp không hợp lệ.');
    if (input.reassignment_reason !== undefined)
        body.reassignment_reason = requiredText(input.reassignment_reason, 'Lý do đổi Manager', 2000);
    if (input.confirm_reassignment !== undefined)
        body.confirm_reassignment = bool(input.confirm_reassignment);
    return body;
}
export class ClassesService {
    client: ApiClient;
    constructor(client: ApiClient) {
        this.client = client;
    }
    async all(role: Role) {
        const first = await this.list(role), rows = [...first.items];
        for (let page = 2; (page - 1) * first.pageSize < first.total; page++) rows.push(...(await this.list(role, { page })).items);
        return rows;
    }
    async list(role: Role, options: {
        search?: string;
        discover?: boolean;
        page?: number;
        pageSize?: number;
    } = {}) {
        const q = new URLSearchParams({
            page: String(options.page ?? 1), page_size: String(options.pageSize ?? 20)
        });
        if (options.search)
            q.set('search', options.search);
        const value = await this.client.request('/' + role + (options.discover ? '/discover' : '') + '/classes?' + q);
        return protocol(() => pageOf(classFromDto)(value));
    }
    async detail(role: Role, id: number) {
        const value = await this.client.request('/' + role + '/classes/' + positiveId(id));
        return protocol(() => classFromDto(object(value).class));
    }
    async preview(id: number) {
        const value = object(await this.client.request('/student/classes/' + positiveId(id) + '/preview'));
        return protocol(() => ({
            class: classFromDto(value.class), upcoming_sessions: items(value.upcoming_sessions, v => {
                const r = object(v);
                return {
                    id: positiveId(r.id), session_number: positiveId(r.session_number), title: text(r.title), starts_at: nullable(text)(r.starts_at), ends_at: nullable(text)(r.ends_at)
                };
            })
        }));
    }
    async save(input: Record<string, unknown>, id?: number) {
        if (id) {
            const current = await this.detail('admin', id);
            if (current.manager_id !== input.manager_id && (!input.reassignment_reason || input.confirm_reassignment !== true))
                throw new Error('Đổi Manager cần lý do và xác nhận.');
        }
        const value = await this.client.request('/admin/classes' + (id ? '/' + positiveId(id) : ''), {
            method: id ? 'PUT' : 'POST', body: validateClassInput(input)
        });
        return protocol(() => classFromDto(object(value).class));
    }
    async setTotal(id: number, total: number) {
        const count = positiveId(total);
        if (count > 10000)
            throw new Error('Tổng số buổi tối đa 10000.');
        const value = await this.client.request('/manager/classes/' + positiveId(id) + '/total-sessions', {
            method: 'PUT', body: {
                total_sessions: count
            }
        });
        return protocol(() => classFromDto(object(value).class));
    }
}
