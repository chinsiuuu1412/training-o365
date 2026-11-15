import { ApiClient } from './client.ts';
import { object, text, positiveId, nullable, pageOf } from './dto.ts';
import { protocol, requiredText } from './accounts.ts';
import { timestamp } from './quizzes.ts';
import type { Role } from '../../types/lms.ts';
export interface ApiMaterial {
    id: number; class_id: number; session_id: number | null; title: string; description: string;
    material_type: 'document' | 'video'; url: string; expires_at: string | null; created_by: number;
    deleted_at: string | null; deletion_reason: string | null; created_at: string; updated_at: string;
}
const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com']);
export function httpsMaterialUrl(value: unknown) {
    const raw = text(value), url = raw.trim();
    if (!/^https:\/\//i.test(url) || /[\r\n]/.test(raw) || new TextEncoder().encode(url).length > 4000) throw new Error('Link phải là HTTPS, tối đa 4000 byte và không chứa xuống dòng.');
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error('Link HTTPS không hợp lệ.'); }
    if (!parsed.hostname || parsed.username || parsed.password) throw new Error('Link cần hostname và không chứa thông tin đăng nhập.');
    return url;
}
export function youtubeExpiryExempt(material: Pick<ApiMaterial, 'material_type' | 'url'>) {
    return material.material_type === 'video' && youtubeHosts.has(new URL(httpsMaterialUrl(material.url)).hostname.toLowerCase());
}
export function materialStatus(material: ApiMaterial, classExpires: string, now: number) {
    if (material.deleted_at) return 'removed';
    if (now >= Date.parse(classExpires)) return 'class-expired';
    if (!youtubeExpiryExempt(material) && material.expires_at && now >= Date.parse(material.expires_at)) return 'expired';
    return 'available';
}
export function validateMaterialInput(input: Record<string, unknown>) {
    const type = text(input.material_type), description = text(input.description);
    if (!['document', 'video'].includes(type) || Array.from(description).length > 10000) throw new Error('Loại tài liệu hoặc mô tả không hợp lệ.');
    return { title: requiredText(input.title, 'Tên tài liệu'), description, material_type: type as ApiMaterial['material_type'], url: httpsMaterialUrl(input.url),
        session_id: input.session_id == null ? null : positiveId(input.session_id), expires_at: input.expires_at == null ? null : timestamp(input.expires_at) };
}
export function materialFromDto(value: unknown): ApiMaterial {
    const row = object(value), input = validateMaterialInput(row);
    return { ...input, id: positiveId(row.id), class_id: positiveId(row.class_id), created_by: positiveId(row.created_by), deleted_at: nullable(timestamp)(row.deleted_at), deletion_reason: nullable(text)(row.deletion_reason), created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at) };
}
export class MaterialsService {
    private client: ApiClient;
    constructor(client: ApiClient) { this.client = client; }
    private path(role: Role, classId: number) { return '/' + role + '/classes/' + positiveId(classId) + '/materials'; }
    async list(role: Role, classId: number, options: { page?: number; search?: string; type?: 'document' | 'video'; sessionId?: number } = {}) {
        const query = new URLSearchParams({ page: String(options.page ?? 1), page_size: '20' });
        if (options.search) query.set('search', options.search);
        if (options.type) query.set('material_type', options.type);
        if (options.sessionId) query.set('session_id', String(positiveId(options.sessionId)));
        const value = await this.client.request(this.path(role, classId) + '?' + query);
        return protocol(() => pageOf(materialFromDto)(value));
    }
    async detail(role: Role, classId: number, id: number) {
        const value = await this.client.request(this.path(role, classId) + '/' + positiveId(id));
        return protocol(() => materialFromDto(object(value).material));
    }
    async save(classId: number, input: Record<string, unknown>, id?: number) {
        const value = await this.client.request(this.path('manager', classId) + (id ? '/' + positiveId(id) : ''), { method: id ? 'PUT' : 'POST', body: validateMaterialInput(input) });
        return protocol(() => materialFromDto(object(value).material));
    }
    async remove(role: 'admin' | 'manager', classId: number, id: number, reason: string) {
        await this.client.request(this.path(role, classId) + '/' + positiveId(id), { method: 'DELETE', body: { reason: requiredText(reason, 'Lý do gỡ', 2000) } });
    }
}
