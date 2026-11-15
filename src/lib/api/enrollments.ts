import { ApiClient } from './client.ts';
import { accountFromDto, requiredText, protocol, type Account } from './accounts.ts';
import { object, text, positiveId, nullable, pageOf, requestId, userId, enrollmentId, type RequestId, type UserId, type EnrollmentId } from './dto.ts';
import { summaryFromDto, progressFromDto, type ClassSummary, type Progress } from './classes.ts';
export interface EnrollmentRequest {
    id: RequestId;
    class_id: number;
    student_id: UserId;
    reason: string;
    status: 'pending' | 'approved' | 'declined' | 'cancelled';
    decision_reason: string | null;
    decided_by: UserId | null;
    created_at: string;
    decided_at: string | null;
    full_name?: string;
    student_number?: string;
}
export interface Enrollment {
    id: EnrollmentId;
    class_id: number;
    student_id: UserId;
    cycle_number: number;
    request_id: RequestId;
    status: 'enrolled' | 'removed';
    approved_at: string;
    removed_at: string | null;
    removal_reason: string | null;
}
export interface HistoryItem {
    enrollment: Enrollment;
    class: ClassSummary;
    progress: Progress;
}
export interface RosterItem {
    enrollment: Enrollment;
    student: Account;
    progress: Progress;
}
export function requestFromDto(value: unknown): EnrollmentRequest {
    const r = object(value);
    if (!['pending', 'approved', 'declined', 'cancelled'].includes(String(r.status)))
        throw new Error('Trạng thái request không hợp lệ.');
    return {
        id: requestId(r.id), class_id: positiveId(r.class_id), student_id: userId(r.student_id), reason: text(r.reason), status: r.status as EnrollmentRequest['status'], decision_reason: nullable(text)(r.decision_reason), decided_by: nullable(userId)(r.decided_by), created_at: text(r.created_at), decided_at: nullable(text)(r.decided_at), ...(r.full_name !== undefined ? {
            full_name: text(r.full_name), student_number: text(r.student_number)
        } : {})
    };
}
export function enrollmentFromDto(value: unknown): Enrollment {
    const r = object(value);
    if (!['enrolled', 'removed'].includes(String(r.status)))
        throw new Error('Trạng thái enrollment không hợp lệ.');
    return {
        id: enrollmentId(r.id), class_id: positiveId(r.class_id), student_id: userId(r.student_id), cycle_number: positiveId(r.cycle_number), request_id: requestId(r.request_id), status: r.status as Enrollment['status'], approved_at: text(r.approved_at), removed_at: nullable(text)(r.removed_at), removal_reason: nullable(text)(r.removal_reason)
    };
}
export function historyFromDto(value: unknown): HistoryItem {
    const r = object(value), enrollment = enrollmentFromDto(r.enrollment), progress = progressFromDto(r.progress);
    if (enrollment.id !== progress.enrollment_id)
        throw new Error('Tiến độ không cùng enrollment_id.');
    return {
        enrollment, class: summaryFromDto(r.class), progress
    };
}
export function enrollmentAvailability(requests: EnrollmentRequest[], classId: number, now: number) {
    const rows = requests.filter(r => r.class_id === classId).sort((a, b) => b.id - a.id), declined = rows.filter(r => r.status === 'declined'), lastDeclined = declined[0], latest = rows[0], retryAt = lastDeclined?.decided_at ? Date.parse(lastDeclined.decided_at) + 600000 : 0;
    return {
        latest, lastDeclined, declines: declined.length, retryAt, pending: rows.find(r => r.status === 'pending'), canRequest: !rows.some(r => r.status === 'pending') && declined.length < 3 && now >= retryAt
    };
}
export class EnrollmentService {
    client: ApiClient;
    constructor(client: ApiClient) {
        this.client = client;
    }
    async ownRequests(page = 1, pageSize = 20) {
        const value = await this.client.request('/student/enrollment-requests?page=' + page + '&page_size=' + pageSize);
        return protocol(() => pageOf(requestFromDto)(value));
    }
    async allOwnRequests() {
        const first = await this.ownRequests(1, 100), rows = [...first.items];
        for (let page = 2; rows.length < first.total; page++) {
            const next = await this.ownRequests(page, 100);
            if (!next.items.length)
                throw new Error('Lịch sử yêu cầu thay đổi; hãy tải lại.');
            rows.push(...next.items);
        }
        return rows;
    }
    async request(id: number, reason: string) {
        const value = await this.client.request('/student/classes/' + positiveId(id) + '/enrollment-requests', {
            method: 'POST', body: {
                reason: requiredText(reason, 'Lý do', 2000)
            }
        });
        return protocol(() => requestFromDto(object(value).request));
    }
    async cancel(classId: number, id: RequestId) {
        await this.client.request('/student/classes/' + positiveId(classId) + '/enrollment-requests/' + requestId(id) + '/cancel', {
            method: 'POST'
        });
    }
    async requests(role: 'admin' | 'manager', classId: number, page = 1) {
        const value = await this.client.request('/' + role + '/classes/' + positiveId(classId) + '/enrollment-requests?page=' + page + '&page_size=20');
        return protocol(() => pageOf(requestFromDto)(value));
    }
    async review(classId: number, id: RequestId, decision: 'approve' | 'decline', reason: string) {
        const body: Record<string, unknown> = {
            decision
        };
        if (decision === 'decline')
            body.reason = requiredText(reason, 'Lý do từ chối', 2000);
        const value = await this.client.request('/manager/classes/' + positiveId(classId) + '/enrollment-requests/' + requestId(id) + '/review', {
            method: 'POST', body
        });
        return protocol(() => requestFromDto(object(value).request));
    }
    async allRoster(role: 'admin' | 'manager', classId: number) {
        const first = await this.roster(role, classId), rows = [...first.items];
        for (let page = 2; (page - 1) * first.pageSize < first.total; page++) rows.push(...(await this.roster(role, classId, page)).items);
        return rows;
    }
    async roster(role: 'admin' | 'manager', classId: number, page = 1) {
        const value = await this.client.request('/' + role + '/classes/' + positiveId(classId) + '/enrollments?page=' + page + '&page_size=20');
        return protocol(() => pageOf(v => {
            const r = object(v), enrollment = enrollmentFromDto(r), student = accountFromDto(r.student), progress = progressFromDto(r.progress);
            if (student.userId !== enrollment.student_id || progress.enrollment_id !== enrollment.id)
                throw new Error('Roster sai quan hệ ID.');
            return {
                enrollment, student, progress
            };
        })(value));
    }
    async remove(role: 'admin' | 'manager', classId: number, id: EnrollmentId, reason: string) {
        await this.client.request('/' + role + '/classes/' + positiveId(classId) + '/enrollments/' + enrollmentId(id) + '/remove', {
            method: 'POST', body: {
                reason: requiredText(reason, 'Lý do', 2000)
            }
        });
    }
    async history(page = 1) {
        const value = await this.client.request('/student/enrollment-history?page=' + page + '&page_size=20');
        return protocol(() => pageOf(historyFromDto)(value));
    }
}
