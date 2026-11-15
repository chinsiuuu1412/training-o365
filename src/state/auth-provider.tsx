"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from '@/types/lms';
import { ApiClient, ApiError } from '@/lib/api/client';
import { AuthService } from '@/lib/api/auth';
export const fixtureMode = process.env.NEXT_PUBLIC_DATA_SOURCE === 'fixture' || process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DATA_SOURCE !== 'api';
export const authEnabled = fixtureMode || process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
export const managementEnabled = fixtureMode || process.env.NEXT_PUBLIC_MANAGEMENT_ENABLED === 'true';
export const schedulingEnabled = fixtureMode || process.env.NEXT_PUBLIC_SCHEDULING_ENABLED === 'true';
export const quizzesEnabled = fixtureMode || process.env.NEXT_PUBLIC_QUIZZES_ENABLED === 'true';
export const communicationsEnabled = fixtureMode || process.env.NEXT_PUBLIC_COMMUNICATIONS_ENABLED === 'true';
type Status = 'restoring' | 'authenticated' | 'anonymous' | 'error';
function useController() {
    const [user, setUser] = useState<User | null>(null), [status, setStatus] = useState<Status>('restoring'), [error, setError] = useState(''), [anonymousReason, setAnonymousReason] = useState('session');
    const generation = useRef(0), service = useRef<Promise<AuthService> | null>(null), clientRef = useRef<ApiClient | null>(null);
    const getService = useCallback(() => {
        if (!service.current)
            service.current = (async () => {
                const transport = fixtureMode ? (await import('@/mocks/api-fixture')).createFixtureTransport().transport : undefined;
                clientRef.current = new ApiClient(transport, () => {
                    setAnonymousReason('session');
                    setUser(null);
                    setStatus('anonymous');
                });
                return new AuthService(clientRef.current);
            })();
        return service.current;
    }, []);
    const restore = useCallback(async () => {
        const revision = ++generation.current;
        if (!authEnabled) {
            setStatus('anonymous');
            return;
        }
        setStatus('restoring');
        setError('');
        try {
            const value = await (await getService()).me();
            if (generation.current === revision) {
                setUser(value);
                setStatus('authenticated');
            }
        }
        catch (cause) {
            if (generation.current !== revision)
                return;
            if (cause instanceof ApiError && cause.status === 401 && cause.kind === 'http') {
                setUser(null);
                setStatus('anonymous');
            }
            else {
                setError(cause instanceof Error ? cause.message : 'Không thể khôi phục phiên.');
                setStatus('error');
            }
        }
    }, [getService]);
    useEffect(() => {
        let alive = true;
        const revision = generation;
        queueMicrotask(() => {
            if (alive)
                void restore();
        });
        return () => {
            alive = false;
            revision.current++;
        };
    }, [restore]);
    async function login(email: string, password: string) {
        if (!authEnabled)
            throw new Error('Đăng nhập chưa được mở trên bản triển khai này.');
        const revision = ++generation.current;
        const value = await (await getService()).login(email, password);
        if (revision === generation.current) {
            setUser(value);
            setStatus('authenticated');
            setError('');
        }
        return value.role;
    }
    async function logout() {
        await (await getService()).logout();
        generation.current++;
        setAnonymousReason('logout');
        setUser(null);
        setStatus('anonymous');
    }
    async function changePassword(current: string, next: string) {
        await (await getService()).changePassword(current, next);
        generation.current++;
        setAnonymousReason('changed');
        setUser(null);
        setStatus('anonymous');
    }
    const getClient = useCallback(async () => {
        await getService();
        return clientRef.current!;
    }, [getService]);
    const refreshUser = useCallback(async () => {
        const revision = generation.current, value = await (await getService()).me();
        if (revision === generation.current)
            setUser(value);
        return value;
    }, [getService]);
    return {
        user, status, error, anonymousReason, restore, login, logout, changePassword, getClient, refreshUser, fixtureMode, enabled: authEnabled
    };
}
const Context = createContext<ReturnType<typeof useController> | null>(null);
export function AuthProvider({ children }: {
    children: ReactNode;
}) {
    const value = useController();
    return <Context.Provider value={value}>
    {children}
    </Context.Provider>;
}
export function useAuth() {
    const value = useContext(Context);
    if (!value)
        throw new Error('Missing AuthProvider');
    return value;
}
