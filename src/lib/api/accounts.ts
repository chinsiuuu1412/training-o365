import { ApiClient, ApiError } from './client.ts';
import { object, pageOf, userFromDto, userId, type UserId } from './dto.ts';
import type { User } from '../../types/lms.ts';
export type Account = User & {
    userId: UserId;
};
export function accountFromDto(value: unknown): Account {
    return {
        ...userFromDto(value), userId: userId(object(value).id)
    };
}
export function requiredText(value: unknown, label: string, max = 200) {
    if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > max)
        throw new Error(label + ': bắt buộc, tối đa ' + max + ' ký tự.');
    return value.trim();
}
export function passwordInput(value: unknown) {
    if (typeof value !== 'string' || new TextEncoder().encode(value).length < 12 || new TextEncoder().encode(value).length > 72)
        throw new Error('Mật khẩu phải dài 12–72 byte UTF-8.');
    return value;
}
export function validateAccountInput(input: Record<string, unknown>, create: boolean) {
    const full_name = requiredText(input.full_name, 'Họ tên'), email = requiredText(input.email, 'Email', 254).toLowerCase(), role = input.role;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || new TextEncoder().encode(email).length > 254)
        throw new Error('Email không hợp lệ.');
    if (role !== 'student' && role !== 'class_manager')
        throw new Error('Chỉ quản lý Student hoặc Manager.');
    const body: Record<string, unknown> = {
        full_name, email
    };
    const keys = ['student_id', 'school_or_institute', 'university_class', 'phone_number', 'gender'];
    if (role === 'student') {
        if (typeof input.student_id !== 'string' || !/^[0-9]{9}$/.test(input.student_id))
            throw new Error('MSSV phải là chuỗi đúng 9 chữ số.');
        const phone = requiredText(input.phone_number, 'Số điện thoại');
        if (!/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(phone))
            throw new Error('Số điện thoại di động Việt Nam không hợp lệ.');
        if (email.split('@')[1] !== 'sis.hust.edu.vn')
            throw new Error('Student cần email @sis.hust.edu.vn.');
        const gender = input.gender ?? null;
        if (gender !== null && !['male', 'female', 'other'].includes(String(gender)))
            throw new Error('Giới tính chỉ nhận male/female/other hoặc null.');
        Object.assign(body, {
            student_id: input.student_id, school_or_institute: requiredText(input.school_or_institute, 'Trường/Viện'), university_class: requiredText(input.university_class, 'Lớp–Khóa'), phone_number: phone, gender
        });
    }
    else {
        if (keys.some(key => input[key] !== null && input[key] !== undefined))
            throw new Error('Hồ sơ Student của staff phải null.');
        for (const key of keys)
            body[key] = null;
    }
    if (create) {
        body.role = role;
        body.password = passwordInput(input.password);
    }
    return body;
}
export function protocol<T>(read: () => T): T {
    try {
        return read();
    }
    catch (cause) {
        if (cause instanceof ApiError)
            throw cause;
        throw new ApiError('Dữ liệu trả về không đúng contract. Vui lòng tải lại.', {
            kind: 'protocol', code: 'invalid_response'
        });
    }
}
export class AccountsService {
    client: ApiClient;
    constructor(client: ApiClient) {
        this.client = client;
    }
    async list(options: {
        role: 'student' | 'manager';
        search?: string;
        active?: boolean;
        page?: number;
        pageSize?: number;
    }) {
        const query = new URLSearchParams({
            role: options.role === 'manager' ? 'class_manager' : 'student', page: String(options.page ?? 1), page_size: String(options.pageSize ?? 20)
        });
        if (options.search)
            query.set('search', options.search);
        if (options.active !== undefined)
            query.set('is_active', String(options.active));
        const value = await this.client.request('/admin/users?' + query);
        return protocol(() => pageOf(accountFromDto)(value));
    }
    async allManagers() {
        const first = await this.list({
            role: 'manager', pageSize: 100
        });
        const result = [...first.items];
        for (let page = 2; result.length < first.total; page++) {
            const next = await this.list({
                role: 'manager', page, pageSize: 100
            });
            if (!next.items.length)
                throw new Error('Danh sách Manager thay đổi; hãy tải lại.');
            result.push(...next.items);
        }
        return result;
    }
    async create(input: Record<string, unknown>) {
        const value = await this.client.request('/admin/users', {
            method: 'POST', body: validateAccountInput(input, true)
        });
        return protocol(() => accountFromDto(object(value).user));
    }
    async update(id: UserId, input: Record<string, unknown>) {
        const value = await this.client.request('/admin/users/' + userId(id), {
            method: 'PUT', body: validateAccountInput(input, false)
        });
        return protocol(() => accountFromDto(object(value).user));
    }
    async setStatus(id: UserId, is_active: boolean, reason: string) {
        const value = await this.client.request('/admin/users/' + userId(id) + '/status', {
            method: 'PATCH', body: {
                is_active, reason: requiredText(reason, 'Lý do', 2000)
            }
        });
        return protocol(() => accountFromDto(object(value).user));
    }
    async resetPassword(id: UserId, password: string) {
        await this.client.request('/admin/users/' + userId(id) + '/reset-password', {
            method: 'POST', body: {
                new_password: passwordInput(password)
            }
        });
    }
}
