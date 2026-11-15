import { ApiClient, ApiError } from './client.ts';
import { protocol, requiredText } from './accounts.ts';
import { object, text, positiveId, nullable, count, flag, items, pageOf, enrollmentId, type EnrollmentId } from './dto.ts';
import type { Role } from '../../types/lms.ts';

export interface Session {
    id: number;
    class_id: number;
    session_number: number;
    title: string;
    description: string;
    location: string;
    starts_at: string | null;
    ends_at: string | null;
    approved_proposal_id: number | null;
    attendance_code?: string;
}
export interface Proposal {
    id: number;
    session_id: number;
    proposed_by: number;
    starts_at: string;
    ends_at: string;
    status: 'draft' | 'pending' | 'approved' | 'rejected';
    reason: string | null;
    reviewed_by: number | null;
    created_at: string;
    reviewed_at: string | null;
}
export type PendingProposal = Proposal & { class_id: number; session_number: number; title: string };
export interface Attendance {
    id: number;
    enrollment_id: EnrollmentId;
    session_id: number;
    attended: boolean;
    wrong_count: number;
    overridden: boolean;
    updated_at: string;
}
export type AttendanceRow = Attendance & { student_id: number; cycle_number: number; enrollment_status: string };
export interface Absence {
    id: number;
    enrollment_id: EnrollmentId;
    session_id: number;
    reason: string;
    created_at: string;
    student_id?: number;
}
export interface Audit {
    id: number;
    actor_id: number;
    class_id: number | null;
    action: string;
    target_id: number;
    before_json: string;
    after_json: string;
    reason: string;
    created_at: string;
}
export function sessionFromDto(value: unknown): Session {
    const row = object(value);
    return {
        id: positiveId(row.id), class_id: positiveId(row.class_id), session_number: positiveId(row.session_number),
        title: text(row.title), description: text(row.description), location: text(row.location),
        starts_at: nullable(text)(row.starts_at), ends_at: nullable(text)(row.ends_at),
        approved_proposal_id: nullable(positiveId)(row.approved_proposal_id)
    };
}
function readSession(value: unknown, role: Role) {
    const session = sessionFromDto(value);
    return role === 'student' ? session : { ...session, attendance_code: text(object(value).attendance_code) };
}
export function proposalFromDto(value: unknown): Proposal {
    const row = object(value), status = text(row.status);
    if (!['draft', 'pending', 'approved', 'rejected'].includes(status)) throw new Error('Trạng thái đề xuất không hợp lệ.');
    return {
        id: positiveId(row.id), session_id: positiveId(row.session_id), proposed_by: positiveId(row.proposed_by),
        starts_at: text(row.starts_at), ends_at: text(row.ends_at), status: status as Proposal['status'],
        reason: nullable(text)(row.reason), reviewed_by: nullable(positiveId)(row.reviewed_by),
        created_at: text(row.created_at), reviewed_at: nullable(text)(row.reviewed_at)
    };
}
export function attendanceFromDto(value: unknown): Attendance {
    const row = object(value), wrong = count(row.wrong_count);
    if (wrong > 3) throw new Error('Số lần sai ngoài giới hạn.');
    return {
        id: positiveId(row.id), enrollment_id: enrollmentId(row.enrollment_id), session_id: positiveId(row.session_id),
        attended: flag(row.attended), wrong_count: wrong, overridden: flag(row.overridden), updated_at: text(row.updated_at)
    };
}
function absenceFromDto(value: unknown): Absence {
    const row = object(value);
    return {
        id: positiveId(row.id), enrollment_id: enrollmentId(row.enrollment_id), session_id: positiveId(row.session_id),
        reason: text(row.reason), created_at: text(row.created_at),
        ...(row.student_id === undefined ? {} : { student_id: positiveId(row.student_id) })
    };
}
function auditFromDto(value: unknown): Audit {
    const row = object(value), before = text(row.before_json), after = text(row.after_json);
    object(JSON.parse(before));
    object(JSON.parse(after));
    return {
        id: positiveId(row.id), actor_id: positiveId(row.actor_id), class_id: nullable(positiveId)(row.class_id),
        action: text(row.action), target_id: positiveId(row.target_id), before_json: before, after_json: after,
        reason: text(row.reason), created_at: text(row.created_at)
    };
}
export function validateSessionInput(input: Record<string, unknown>) {
    const description = text(input.description), location = text(input.location);
    if (Array.from(description).length > 10000 || Array.from(location).length > 2000) throw new Error('Mô tả hoặc địa điểm quá dài.');
    return {
        session_number: positiveId(input.session_number), title: requiredText(input.title, 'Tên buổi học'),
        description, location, attendance_code: requiredText(input.attendance_code, 'Mã điểm danh', 100)
    };
}
export function validateScheduleInput(input: Record<string, unknown>) {
    const starts_at = text(input.starts_at), ends_at = text(input.ends_at);
    const valid = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
    if (!valid(starts_at) || !valid(ends_at) || Date.parse(ends_at) <= Date.parse(starts_at)) throw new Error('Thời gian không hợp lệ, kết thúc phải sau bắt đầu.');
    return { starts_at, ends_at };
}
export function attendanceWindow(session: Session, now: number) {
    return !!session.approved_proposal_id && !!session.starts_at && !!session.ends_at && now >= Date.parse(session.starts_at) && now < Date.parse(session.ends_at);
}
export function remainingAttendanceAttempts(error: unknown): number | null {
    if (!(error instanceof ApiError) || error.status !== 422 || error.code !== 'wrong_attendance_code') return null;
    const value = error.details?.remaining_attempts;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2 ? value : null;
}
export class SessionsService {
    private client: ApiClient;
    constructor(client: ApiClient) { this.client = client; }
    private path(role: Role, classId: number) { return '/' + role + '/classes/' + positiveId(classId); }
    async all(role: Role, classId: number) {
        const first = await this.list(role, classId), rows = [...first.items];
        for (let page = 2; (page - 1) * first.pageSize < first.total; page++) rows.push(...(await this.list(role, classId, page)).items);
        return rows;
    }
    async list(role: Role, classId: number, page = 1) {
        const value = await this.client.request(this.path(role, classId) + '/sessions?page=' + page + '&page_size=20');
        return protocol(() => pageOf(value => readSession(value, role))(value));
    }
    async detail(role: Role, classId: number, sessionId: number) {
        const value = object(await this.client.request(this.path(role, classId) + '/sessions/' + positiveId(sessionId)));
        return protocol(() => ({ session: readSession(value.session, role), proposals: role === 'student' ? [] : items(value.proposals, proposalFromDto) }));
    }
    async create(classId: number, input: Record<string, unknown>) {
        const value = object(await this.client.request(this.path('manager', classId) + '/sessions', { method: 'POST', body: validateSessionInput(input) }));
        return protocol(() => readSession(value.session, 'manager'));
    }
    async saveDraft(classId: number, sessionId: number, input: Record<string, unknown>) {
        const value = object(await this.client.request(this.path('manager', classId) + '/sessions/' + positiveId(sessionId) + '/schedule-draft', { method: 'PUT', body: validateScheduleInput(input) }));
        return protocol(() => proposalFromDto(value.proposal));
    }
    async submit(classId: number, sessionId: number, proposalId: number) {
        const value = object(await this.client.request(this.path('manager', classId) + '/sessions/' + positiveId(sessionId) + '/schedule-proposals/' + positiveId(proposalId) + '/submit', { method: 'POST' }));
        return protocol(() => proposalFromDto(value.proposal));
    }
    async pending(page = 1) {
        const value = await this.client.request('/admin/schedule-proposals?page=' + page + '&page_size=20');
        return protocol(() => pageOf(value => {
            const row = object(value);
            return { ...proposalFromDto(row), class_id: positiveId(row.class_id), session_number: positiveId(row.session_number), title: text(row.title) };
        })(value));
    }
    async review(classId: number, sessionId: number, proposalId: number, decision: 'approve' | 'reject', reason = '') {
        const value = object(await this.client.request(this.path('admin', classId) + '/sessions/' + positiveId(sessionId) + '/schedule-proposals/' + positiveId(proposalId) + '/review', {
            method: 'POST', body: { decision, ...(decision === 'reject' ? { reason: requiredText(reason, 'Lý do', 2000) } : {}) }
        }));
        return protocol(() => ({ session: readSession(value.session, 'admin'), proposal: proposalFromDto(value.proposal) }));
    }
    async attendance(role: Role, classId: number, page = 1) {
        const value = await this.client.request(this.path(role, classId) + '/attendance?page=' + page + '&page_size=100');
        return protocol(() => pageOf(value => {
            const row = object(value);
            return { ...attendanceFromDto(row), student_id: positiveId(row.student_id), cycle_number: positiveId(row.cycle_number), enrollment_status: text(row.enrollment_status) };
        })(value));
    }
    async allAttendance(role: Role, classId: number) {
        const first = await this.attendance(role, classId), rows = [...first.items];
        for (let page = 2; (page - 1) * first.pageSize < first.total; page++) rows.push(...(await this.attendance(role, classId, page)).items);
        return rows;
    }
    async attend(classId: number, sessionId: number, cycle: EnrollmentId, code: string) {
        const value = object(await this.client.request(this.path('student', classId) + '/sessions/' + positiveId(sessionId) + '/attend', { method: 'POST', body: { enrollment_id: enrollmentId(cycle), code } }));
        return protocol(() => ({ attendance: attendanceFromDto(value.attendance), authoritative: value.authoritative_override === true }));
    }
    async absence(classId: number, sessionId: number, cycle: EnrollmentId, reason: string) {
        const value = object(await this.client.request(this.path('student', classId) + '/sessions/' + positiveId(sessionId) + '/absence', { method: 'POST', body: { enrollment_id: enrollmentId(cycle), reason: requiredText(reason, 'Lý do', 2000) } }));
        return protocol(() => {
            if (value.status !== 'approved') throw new Error('Trạng thái xin nghỉ không hợp lệ.');
            return absenceFromDto(value.absence);
        });
    }
    async override(classId: number, sessionId: number, cycle: EnrollmentId, attended: boolean, reason: string) {
        const value = object(await this.client.request(this.path('manager', classId) + '/sessions/' + positiveId(sessionId) + '/attendance/' + enrollmentId(cycle) + '/override', { method: 'POST', body: { attended, reason: requiredText(reason, 'Lý do', 2000) } }));
        return protocol(() => attendanceFromDto(value.attendance));
    }
    async absences(role: 'admin' | 'manager', classId: number, page = 1) {
        const value = await this.client.request(this.path(role, classId) + '/absences?page=' + page + '&page_size=20');
        return protocol(() => pageOf(absenceFromDto)(value));
    }
    async audit(role: 'admin' | 'manager', classId: number, page = 1) {
        const value = await this.client.request(this.path(role, classId) + '/audit?page=' + page + '&page_size=20');
        return protocol(() => pageOf(auditFromDto)(value));
    }
}
