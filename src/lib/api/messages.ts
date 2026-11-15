import { ApiClient } from './client.ts';
import { accountFromDto, protocol, requiredText } from './accounts.ts';
import { ClassesService } from './classes.ts';
import { EnrollmentService } from './enrollments.ts';
import { object, text, positiveId, nullable, flag, pageOf, count, userId, type UserId } from './dto.ts';
import { timestamp } from './quizzes.ts';

export interface Announcement {
    id: number;
    sender_id: number | null;
    class_id: number | null;
    title: string;
    content: string;
    automated: boolean;
    created_at: string;
    is_read: boolean;
}
export function announcementFromDto(value: unknown): Announcement {
    const row = object(value);
    return { id: positiveId(row.id), sender_id: nullable(positiveId)(row.sender_id), class_id: nullable(positiveId)(row.class_id), title: text(row.title), content: text(row.content), automated: flag(row.automated), created_at: timestamp(row.created_at), is_read: flag(row.is_read) };
}
export function validateAnnouncement(input: { recipient_ids: UserId[]; title: string; content: string }) {
    const recipient_ids = [...new Set(input.recipient_ids.map(userId))];
    if (!recipient_ids.length || recipient_ids.length > 10000) throw new Error('Chọn 1–10000 người nhận cụ thể.');
    return { recipient_ids, title: requiredText(input.title, 'Tiêu đề'), content: requiredText(input.content, 'Nội dung', 20000) };
}
export class MessagesService {
    private client: ApiClient;
    constructor(client: ApiClient) { this.client = client; }
    async inbox(page = 1, read?: boolean, pageSize = 20) {
        const value = await this.client.request('/announcements?page=' + page + '&page_size=' + pageSize + (read === undefined ? '' : '&is_read=' + read));
        return protocol(() => pageOf(announcementFromDto)(value));
    }
    async unreadCount() { return (await this.inbox(1, false, 1)).total; }
    async detail(id: number) {
        const value = await this.client.request('/announcements/' + positiveId(id));
        return protocol(() => announcementFromDto(object(value).announcement));
    }
    async read(id: number, isRead: boolean) {
        await this.client.request('/announcements/' + positiveId(id) + '/read', { method: 'PATCH', body: { is_read: isRead } });
    }
    async recipients(role: 'admin' | 'manager', page = 1, pageSize = 20) {
        const value = await this.client.request('/' + role + '/recipients?page=' + page + '&page_size=' + pageSize);
        return protocol(() => pageOf(accountFromDto)(value));
    }
    async allRecipients(role: 'admin' | 'manager') {
        const first = await this.recipients(role, 1, 100), rows = [...first.items];
        for (let page = 2; (page - 1) * first.pageSize < first.total; page++) {
            const next = await this.recipients(role, page, 100);
            if (next.total !== first.total) throw new Error('Danh sách người nhận vừa thay đổi. Chọn lại tất cả.');
            rows.push(...next.items);
        }
        const unique = [...new Map(rows.map(row => [row.userId, row])).values()];
        if (unique.length !== first.total) throw new Error('Danh sách người nhận vừa thay đổi. Chọn lại tất cả.');
        return unique;
    }
    async audienceClasses(role: 'admin' | 'manager') {
        const rows = await new ClassesService(this.client).all(role);
        return role === 'manager' ? rows.filter(row => !row.is_expired) : rows;
    }
    async classAudience(role: 'admin' | 'manager', classIds: number[], includeManagers: boolean) {
        const allowed = await this.allRecipients(role), allowedIds = new Set(allowed.map(row => row.userId));
        const classes = new ClassesService(this.client), enrollments = new EnrollmentService(this.client), ids = new Set<UserId>();
        for (const id of new Set(classIds.map(positiveId))) {
            const course = await classes.detail(role, id);
            const roster = await enrollments.allRoster(role, id);
            for (const row of roster) if (row.enrollment.status === 'enrolled' && allowedIds.has(row.student.userId)) ids.add(row.student.userId);
            if (role === 'admin' && includeManagers && allowedIds.has(userId(course.manager_id))) ids.add(userId(course.manager_id));
        }
        return allowed.filter(row => ids.has(row.userId));
    }
    async send(role: 'admin' | 'manager', input: { recipient_ids: UserId[]; title: string; content: string }) {
        const value = await this.client.request('/' + role + '/announcements', { method: 'POST', body: validateAnnouncement(input) });
        return protocol(() => { const row = object(value); return { announcement_id: positiveId(row.announcement_id), recipient_count: count(row.recipient_count) }; });
    }
}
