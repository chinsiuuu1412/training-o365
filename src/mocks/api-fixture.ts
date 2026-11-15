import type { Transport } from '../lib/api/client.ts';
import { passwordInput } from '../lib/api/accounts.ts';
import { createManagementFixture } from './management-fixture.ts';
const cookieName = 'o365-v2-fixture-user';
function cookieValue(name: string) {
    return typeof document === 'undefined' ? null : document.cookie.split('; ').find(item => item.startsWith(name + '='))?.slice(name.length + 1) ?? null;
}
export function createFixtureTransport(shared?: {
    management: ReturnType<typeof createManagementFixture>;
    passwords: Map<number, string>;
}) {
    const passwords = shared?.passwords ?? new Map<number, string>(), management = shared?.management ?? createManagementFixture((id, password) => passwords.set(id, password));
    let userId: number | null = null, revision = 1, failure: 'network' | 'server' | 'unauthenticated' | null = null;
    const loadCookie = () => {
        if (typeof document !== 'undefined') {
            const parts = (cookieValue(cookieName) ?? '').split(':');
            userId = Number(parts[0]) || null;
            revision = Number(parts[1]) || 1;
        }
    };
    loadCookie();
    const setUser = (id: number | null) => {
        userId = id;
        revision = id ? management.revision(id) : 1;
        if (typeof document !== 'undefined')
            document.cookie = cookieName + '=' + (id ? id + ':' + revision : '') + '; Path=/; SameSite=Lax' + (!id ? '; Max-Age=0' : '');
    };
    const ok = (data: unknown) => Response.json({
        data, error: null
    });
    const error = (status: number, code: string, message: string) => Response.json({
        data: null, error: {
            code, message, details: null
        }
    }, {
        status
    });
    const transport: Transport = async (url, init) => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new TypeError('Chế độ mô phỏng · Kết nối gián đoạn.');
        await management.synchronize();
        loadCookie();
        const path = url.replace('/api/v1', ''), input = init.body ? JSON.parse(String(init.body)) : {};
        const users = management.users();
        if (path === '/auth/login' && init.method === 'POST') {
            const user = users.find(user => user.email === String(input.email).trim().toLowerCase());
            if (!user?.is_active || (passwords.get(user.id) ?? 'O365-demo-12345') !== input.password)
                return error(401, 'unauthenticated', 'Email hoặc mật khẩu không đúng.');
            setUser(user.id);
            return ok({
                user, csrf_token: 'synthetic-csrf-' + user.id + '-' + revision
            });
        }
        if (path === '/auth/me') {
            const mode = failure ?? cookieValue('o365-v2-fixture-restore');
            if (mode === 'network')
                throw new TypeError('synthetic offline');
            if (mode === 'server')
                return error(503, 'unavailable', 'Máy chủ mô phỏng đang bận.');
            if (mode === 'unauthenticated') {
                setUser(null);
                return error(401, 'unauthenticated', 'Phiên đã hết hiệu lực.');
            }
        }
        const user = users.find(user => user.id === userId);
        if (!user?.is_active || revision !== management.revision(user.id))
            return error(401, 'unauthenticated', 'Vui lòng đăng nhập.');
        const csrf = 'synthetic-csrf-' + user.id + '-' + revision;
        if (init.method !== 'GET' && new Headers(init.headers).get('X-CSRF-Token') !== csrf)
            return error(403, 'forbidden', 'CSRF không hợp lệ.');
        if (path === '/auth/me' && init.method === 'GET')
            return ok({
                user, csrf_token: csrf
            });
        if (path === '/auth/logout' && init.method === 'POST') {
            setUser(null);
            return ok({});
        }
        if (path === '/auth/change-password' && init.method === 'POST') {
            if (input.current_password !== (passwords.get(user.id) ?? 'O365-demo-12345'))
                return error(422, 'invalid_current_password', 'Mật khẩu hiện tại không đúng.');
            try {
                management.changePassword(user.id, passwordInput(input.new_password));
            }
            catch {
                return error(400, 'invalid_request', 'Mật khẩu mới không hợp lệ.');
            }
            setUser(null);
            return ok({});
        }
        return management.handle(user.id, url, init);
    };
    return {
        transport, setRestoreFailure: (value: typeof failure) => {
            failure = value;
        }, now: management.now, advanceTime: management.advanceTime, setTime: management.setTime, shared: {
            management, passwords
        }
    };
}
