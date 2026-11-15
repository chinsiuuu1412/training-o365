import { positiveId } from '../lib/api/dto.ts';
import { validateAnnouncement } from '../lib/api/messages.ts';
import { validateMaterialInput, materialStatus, type ApiMaterial } from '../lib/api/materials.ts';
import { requiredText } from '../lib/api/accounts.ts';
interface WireAnnouncement { id: number; sender_id: number | null; class_id: number | null; title: string; content: string; automated: 0 | 1; created_at: string }
interface Delivery { announcement_id: number; recipient_id: number; is_read: 0 | 1 }
export interface CommunicationsFixture { announcements: WireAnnouncement[]; deliveries: Delivery[]; materials: ApiMaterial[] }
export class CommunicationsError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
function rule(condition: unknown, status: number, code: string, message: string): asserts condition {
    if (!condition) throw new CommunicationsError(status, code, message);
}
const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map(row => row.id)) + 1;
export function addAnnouncement(state: CommunicationsFixture, ids: number[], title: string, content: string, now: number, sender: number | null = null, classId: number | null = null) {
    const recipients = [...new Set(ids)];
    const announcement: WireAnnouncement = { id: nextId(state.announcements), sender_id: sender, class_id: classId, title, content, automated: sender === null ? 1 : 0, created_at: new Date(now).toISOString() };
    state.announcements.push(announcement);
    state.deliveries.push(...recipients.map(recipient_id => ({ announcement_id: announcement.id, recipient_id, is_read: 0 as const })));
    return { announcement_id: announcement.id, recipient_count: recipients.length };
}
export function inboxRows(state: CommunicationsFixture, actorId: number) {
    return state.deliveries.filter(row => row.recipient_id === actorId).map(delivery => ({ ...state.announcements.find(row => row.id === delivery.announcement_id)!, is_read: delivery.is_read })).sort((a, b) => b.id - a.id);
}
export function createCommunicationsFixture(userIds: number[], notices: { recipient_id: number; title: string; created_at: string }[] = []): CommunicationsFixture {
    const created = '2026-11-01T00:00:00Z', materials: ApiMaterial[] = [
        { id: 1, class_id: 1, session_id: null, title: 'Hướng dẫn Word', description: 'Link Document tổng hợp', material_type: 'document', url: 'https://example.test/word.pdf', expires_at: null },
        { id: 2, class_id: 1, session_id: 11, title: 'Video thực hành Word', description: 'Link YouTube tổng hợp, miễn hạn riêng', material_type: 'video', url: 'https://www.youtube.com/watch?v=synthetic01', expires_at: '2026-11-01T00:00:00Z' },
        { id: 3, class_id: 1, session_id: null, title: 'Tài liệu đã hết hạn', description: 'Tình huống thử hạn riêng', material_type: 'document', url: 'https://example.test/expired.pdf', expires_at: '2026-11-15T02:00:00Z' },
        { id: 4, class_id: 2, session_id: 21, title: 'Bài tập Excel', description: 'Link lớp Excel', material_type: 'document', url: 'https://example.test/excel.pdf', expires_at: null },
        { id: 5, class_id: 3, session_id: null, title: 'Tài liệu lịch sử', description: 'Lớp đã hết hạn', material_type: 'document', url: 'https://example.test/history.pdf', expires_at: null }
    ].map(row => ({ ...row, material_type: row.material_type as ApiMaterial['material_type'], created_by: row.class_id === 3 ? 3 : 2, deleted_at: null, deletion_reason: null, created_at: created, updated_at: created }));
    const state: CommunicationsFixture = { announcements: [], deliveries: [], materials };
    addAnnouncement(state, userIds, 'Chào mừng đến khóa học', 'Chế độ mô phỏng · Thông báo và dữ liệu tổng hợp trong LMS.', Date.parse(created));
    for (const notice of notices) addAnnouncement(state, [notice.recipient_id], notice.title, notice.title, Date.parse(notice.created_at));
    return state;
}
export function handleInbox(state: CommunicationsFixture, actorId: number, parts: string[], method: string, query: URLSearchParams, body: Record<string, unknown>): { data?: unknown; page?: unknown[] } {
    const rows = inboxRows(state, actorId);
    if (parts.length === 1 && method === 'GET') {
        const read = query.get('is_read');
        rule(read === null || read === 'true' || read === 'false', 400, 'invalid_request', 'Trạng thái đọc không hợp lệ.');
        return { page: rows.filter(row => read === null || (row.is_read === 1) === (read === 'true')) };
    }
    const announcement = rows.find(row => row.id === Number(parts[1]));
    rule(announcement, 404, 'not_found', 'Thông báo không thuộc hộp thư của bạn.');
    if (parts.length === 2 && method === 'GET') return { data: { announcement } };
    rule(parts.length === 3 && parts[2] === 'read' && method === 'PATCH', 404, 'not_found', 'Không có thao tác hộp thư này.');
    rule(typeof body.is_read === 'boolean', 400, 'invalid_request', 'Cần is_read boolean.');
    state.deliveries.find(row => row.announcement_id === announcement.id && row.recipient_id === actorId)!.is_read = body.is_read ? 1 : 0;
    return { data: {} };
}
export function sendManual(state: CommunicationsFixture, actorId: number, allowed: number[], body: Record<string, unknown>, now: number) {
    const rawIds = Array.isArray(body.recipient_ids) ? body.recipient_ids.map(positiveId) : [];
    const input = validateAnnouncement({ recipient_ids: rawIds as Parameters<typeof validateAnnouncement>[0]['recipient_ids'], title: body.title as string, content: body.content as string });
    rule(input.recipient_ids.every(id => allowed.includes(id)), 422, 'invalid_recipients', 'Có người nhận ngoài phạm vi hoặc đã bị vô hiệu hóa. Chọn lại danh sách.');
    return addAnnouncement(state, input.recipient_ids, input.title, input.content, now, actorId);
}
export function handleMaterials(state: CommunicationsFixture, ctx: {
    classId: number; managerId: number; classExpires: string; actor: { id: number; role: string }; sessionIds: number[];
    now: number; parts: string[]; method: string; query: URLSearchParams; body: Record<string, unknown>;
    audit: (material: ApiMaterial, before: ApiMaterial, reason: string) => void;
}): { data?: unknown; page?: ApiMaterial[]; status?: number } {
    const { actor, classId, method, parts, query, body, now } = ctx, student = actor.role === 'student';
    if (parts.length === 4 && method === 'GET') {
        const type = query.get('material_type'), sessionId = query.get('session_id'), search = (query.get('search') ?? '').toLowerCase();
        rule(type === null || type === 'document' || type === 'video', 400, 'invalid_request', 'Loại tài liệu không hợp lệ.');
        rule(sessionId === null || Number.isSafeInteger(Number(sessionId)) && Number(sessionId) > 0 && Number(sessionId) <= 1000000000, 400, 'invalid_request', 'Buổi lọc không hợp lệ.');
        return { page: state.materials.filter(row => row.class_id === classId && (!student || materialStatus(row, ctx.classExpires, now) === 'available') && (!type || row.material_type === type) && (!sessionId || row.session_id === Number(sessionId)) && (row.title + ' ' + row.description).toLowerCase().includes(search)).sort((a, b) => a.id - b.id) };
    }
    const material = state.materials.find(row => row.class_id === classId && row.id === Number(parts[4]));
    if (parts.length === 5 && method === 'GET') {
        rule(material, 404, 'not_found', 'Không tìm thấy tài liệu trong lớp.');
        rule(!student || materialStatus(material, ctx.classExpires, now) === 'available', 403, 'material_expired', 'Link đã hết hạn hoặc đã được gỡ.');
        return { data: { material } };
    }
    rule(!student, 403, 'forbidden', 'Student chỉ xem link được phép.');
    if (parts.length === 5 && method === 'DELETE') {
        rule(material && !material.deleted_at, 404, 'not_found', 'Link đã gỡ hoặc không tồn tại.');
        const reason = requiredText(body.reason, 'Lý do gỡ', 2000), before = { ...material };
        material.deleted_at = new Date(now).toISOString();
        material.deletion_reason = reason;
        material.updated_at = material.deleted_at;
        ctx.audit(material, before, reason);
        if (actor.role === 'admin') addAnnouncement(state, [ctx.managerId], 'Admin đã gỡ link ' + material.title, reason, now, null, classId);
        return { data: {} };
    }
    rule(actor.role === 'class_manager', 403, 'forbidden', 'Chỉ Manager được tạo hoặc sửa link.');
    rule(parts.length === 4 && method === 'POST' || parts.length === 5 && method === 'PUT', 404, 'not_found', 'Không có thao tác Library này.');
    if (method === 'PUT') rule(material && !material.deleted_at, 404, 'not_found', 'Link không còn chỉnh sửa được.');
    const input = validateMaterialInput(body);
    rule(input.session_id === null || ctx.sessionIds.includes(input.session_id), 400, 'invalid_request', 'Buổi đính kèm phải thuộc cùng lớp.');
    if (material) { Object.assign(material, input, { updated_at: new Date(now).toISOString() }); return { data: { material } }; }
    const created: ApiMaterial = { ...input, id: nextId(state.materials), class_id: classId, created_by: actor.id, deleted_at: null, deletion_reason: null, created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() };
    state.materials.push(created);
    return { data: { material: created }, status: 201 };
}
