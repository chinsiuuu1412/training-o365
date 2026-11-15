"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './auth-provider';
import { ApiError } from '@/lib/api/client';
import { AccountsService } from '@/lib/api/accounts';
import { ClassesService } from '@/lib/api/classes';
import { EnrollmentService } from '@/lib/api/enrollments';
import { DashboardService } from '@/lib/api/dashboard';
import { SessionsService } from '@/lib/api/sessions';
import { QuizzesService } from '@/lib/api/quizzes';
import { ProgressService } from '@/lib/api/progress';
import { MessagesService } from '@/lib/api/messages';
import { MaterialsService } from '@/lib/api/materials';
function useController() {
    const { getClient } = useAuth();
    const [refreshers] = useState(() => new Set<() => Promise<boolean>>());
    const [now, setNow] = useState(0);
    const currentClock = useRef(() => Date.now());
    const readNow = useCallback(() => currentClock.current(), []);
    const services = useMemo(() => getClient().then(client => ({
        accounts: new AccountsService(client), classes: new ClassesService(client), enrollments: new EnrollmentService(client), dashboard: new DashboardService(client), sessions: new SessionsService(client), quizzes: new QuizzesService(client), progress: new ProgressService(client), messages: new MessagesService(client), materials: new MaterialsService(client)
    })), [getClient]);
    useEffect(() => {
        let alive = true;
        let getNow = () => Date.now();
        if (process.env.NEXT_PUBLIC_DATA_SOURCE === 'fixture' || process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DATA_SOURCE !== 'api')
            void import('@/mocks/management-fixture').then(module => {
                getNow = module.fixtureNow;
                currentClock.current = getNow;
            });
        else
            void getClient().then(client => {
                getNow = () => client.serverNow();
                currentClock.current = getNow;
            });
        const timer = setInterval(() => {
            if (alive) {
                try {
                    setNow(getNow());
                }
                catch {
                    setNow(0);
                }
            }
        }, 1000);
        return () => {
            alive = false;
            clearInterval(timer);
        };
    }, [getClient]);
    const refresh = useCallback(async () => {
        const results = await Promise.allSettled([...refreshers].map(fn => fn()));
        return results.every(result => result.status === 'fulfilled' && result.value);
    }, [refreshers]);
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const onStorage = (event: StorageEvent) => {
            if ((process.env.NEXT_PUBLIC_DATA_SOURCE === 'fixture' || process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DATA_SOURCE !== 'api') && event.key === 'o365-approved-v2-management-fixture-v4') {
                clearTimeout(timer);
                timer = setTimeout(() => void refresh(), 50);
            }
        };
        const onFocus = () => void refresh();
        window.addEventListener('storage', onStorage);
        window.addEventListener('focus', onFocus);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('focus', onFocus);
        };
    }, [refresh]);
    const write = useCallback(async <T,>(action: () => Promise<T>) => {
        let result: T;
        try {
            result = await action();
        }
        catch (cause) {
            if (cause instanceof ApiError && (cause.kind === 'network' || cause.status >= 500)) {
                await refresh();
                throw new Error('Chưa xác định kết quả ghi. Đã thử đọc lại dữ liệu; kiểm tra trạng thái trước khi gửi lại.');
            }
            throw cause;
        }
        const updated = await refresh();
        if (!updated)
            throw new Error('Thao tác đã được ghi nhưng chưa làm mới đầy đủ. Chọn Làm mới; không gửi lại thao tác.');
        return result;
    }, [refresh]);
    return useMemo(() => ({
        services, refreshers: refreshers, refresh, write, now, readNow
    }), [services, refreshers, refresh, write, now, readNow]);
}
type Data = ReturnType<typeof useController>;
const Context = createContext<Data | null>(null);
function Scope({ children }: {
    children: ReactNode;
}) {
    const value = useController();
    return <Context.Provider value={value}>
    {children}
    </Context.Provider>;
}
export function ApiDataProvider({ children }: {
    children: ReactNode;
}) {
    const { user, status } = useAuth();
    return status === 'authenticated' && user ? <Scope key={user.role + ':' + user.id}>
    {children}
    </Scope> : children;
}
export function useApiData() {
    const value = useContext(Context);
    if (!value)
        throw new Error('Missing authenticated API data scope');
    return value;
}
export function useApiResource<T>(key: string, load: (services: Awaited<Data['services']>) => Promise<T>) {
    const { services, refreshers } = useApiData();
    const loader = useRef(load), revision = useRef(0), mounted = useRef(false);
    const [state, setState] = useState<{
        data?: T;
        error: string;
        loading: boolean;
    }>({
        data: undefined, error: '', loading: true
    });
    useEffect(() => {
        loader.current = load;
    }, [load]);
    const refresh = useCallback(async () => {
        const token = ++revision.current;
        if (mounted.current)
            setState(old => ({
                ...old, loading: true, error: ''
            }));
        try {
            const data = await loader.current(await services);
            if (mounted.current && token === revision.current) {
                setState({
                    data, loading: false, error: ''
                });
            }
            return true;
        }
        catch (cause) {
            if (mounted.current && token === revision.current)
                setState(old => ({
                    data: cause instanceof ApiError && [401, 403, 404].includes(cause.status) ? undefined : old.data, loading: false, error: cause instanceof Error ? cause.message : 'Không thể tải dữ liệu.'
                }));
            return false;
        }
    }, [services]);
    useEffect(() => {
        const currentRevision = revision;
        mounted.current = true;
        refreshers.add(refresh);
        void refresh();
        return () => {
            mounted.current = false;
            currentRevision.current++;
            refreshers.delete(refresh);
        };
    }, [refresh, refreshers, key]);
    return {
        ...state, refresh
    };
}
export function formatApiDate(value: string | null) {
    if (!value || !Number.isFinite(Date.parse(value)))
        return 'Chưa có thời gian';
    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh'
    }).format(new Date(value));
}
