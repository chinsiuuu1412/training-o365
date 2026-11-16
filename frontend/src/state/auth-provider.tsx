"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiClientError, setCsrfToken, setUnauthorizedHandler } from "@/lib/api-client";
import { authApi } from "@/lib/lms-api";
import { cycleKeyRegistry } from "@/lib/quiz-client";
import { roleToRoute, type User } from "@/types/api";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  errorMessage: string | null;
  sessionEpoch: number;
  restoreSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const restoreAbortRef = useRef<AbortController | null>(null);
  const activeUserIdRef = useRef<number | null>(null);

  const clearSessionState = useCallback(
    (redirectToLogin: boolean) => {
      restoreAbortRef.current?.abort();
      activeUserIdRef.current = null;
      cycleKeyRegistry.clearAll();
      setCsrfToken(null);
      setUser(null);
      setErrorMessage(null);
      setStatus("unauthenticated");
      setSessionEpoch((e) => e + 1);
      if (redirectToLogin && pathname !== "/" && pathname !== "/login") {
        router.replace("/login");
      }
    },
    [pathname, router],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSessionState(true);
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSessionState]);

  const restoreSession = useCallback(async () => {
    restoreAbortRef.current?.abort();
    const controller = new AbortController();
    restoreAbortRef.current = controller;
    setErrorMessage(null);
    if (!user) {
      setStatus("loading");
    }
    try {
      const data = await authApi.me(controller.signal);
      if (controller.signal.aborted) return;
      if (activeUserIdRef.current !== null && activeUserIdRef.current !== data.user.id) {
        cycleKeyRegistry.clearAll();
      }
      activeUserIdRef.current = data.user.id;
      setCsrfToken(data.csrf_token);
      setUser(data.user);
      setStatus("authenticated");
    } catch (err) {
      if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        return;
      }
      if (err instanceof ApiClientError && err.status === 401) {
        activeUserIdRef.current = null;
        cycleKeyRegistry.clearAll();
        setCsrfToken(null);
        setUser(null);
        setStatus("unauthenticated");
        setSessionEpoch((e) => e + 1);
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : "Không thể xác minh phiên đăng nhập. Vui lòng thử lại.";
        setErrorMessage(msg);
        if (!user) {
          setStatus("error");
        }
      }
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => {
      void restoreSession();
    });
    return () => restoreAbortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      restoreAbortRef.current?.abort();
      cycleKeyRegistry.clearAll();
      const data = await authApi.login(email, password);
      activeUserIdRef.current = data.user.id;
      setCsrfToken(data.csrf_token);
      setUser(data.user);
      setErrorMessage(null);
      setStatus("authenticated");
      setSessionEpoch((e) => e + 1);
      router.replace(`/${roleToRoute(data.user.role)}`);
      return data.user;
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if cookie already expired, clear client memory state
    } finally {
      clearSessionState(false);
      router.replace("/login");
    }
  }, [clearSessionState, router]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await authApi.changePassword(currentPassword, newPassword);
      // Backend revokes all sessions on password change
      clearSessionState(false);
      router.replace("/login?reason=password-changed");
    },
    [clearSessionState, router],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      errorMessage,
      sessionEpoch,
      restoreSession,
      login,
      logout,
      changePassword,
    }),
    [user, status, errorMessage, sessionEpoch, restoreSession, login, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
