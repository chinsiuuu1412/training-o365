"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { LmsState, MockSession, Role } from "@/types/lms";
import { createInitialState } from "@/mocks/state";
import { accountFor, type Command } from "@/mocks/services/management";
import { loginMock, logoutMock, requireMockSession } from "@/mocks/services/authentication";
import { executeAuthenticated } from "@/mocks/services/session-command";
import { captureEnrollmentContext } from "@/mocks/services/enrollment-cycles";
import { advanceDemoClock } from "@/mocks/demo-clock";
import { decodeDemoStore, DEMO_STORE_KEY as KEY, DEMO_SESSION_KEY, LEGACY_DEMO_KEY, type DemoStore } from "@/mocks/demo-storage";
import { synchronizeMockState } from "@/mocks/services/synchronization";
import { Toast } from "@/components/shared/toast";

function initial(): DemoStore {
  const state = createInitialState();
  state.mockGeneration = 'mock-dataset-' + crypto.randomUUID();
  state.mockSessions = [];
  return { version: 4, state, demoEpoch: Date.parse(state.referenceTime), realEpoch: Date.now() };
}
function read(): DemoStore {
  const raw = localStorage.getItem(KEY);
  if (raw) return decodeDemoStore(raw);
  if (localStorage.getItem(LEGACY_DEMO_KEY)) throw new Error("Phát hiện dữ liệu demo v1. Schema v2 có role Manager, hồ sơ và phiên mô phỏng mới. Chọn Khôi phục demo để tạo bộ dữ liệu v2; kho v1 được giữ nguyên, không tự ghi đè.");
  return initial();
}
async function withLock(action: () => void) {
  if (navigator.locks) await navigator.locks.request(KEY, action); else action();
}
function useController(demoRole?: Role) {
  const [stored, setStored] = useState<DemoStore>(() => {
    const state = createInitialState();
    return { version: 4, state, demoEpoch: Date.parse(state.referenceTime), realEpoch: 0 };
  });
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [session, setSession] = useState<MockSession | null>(null);
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState("");
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      void withLock(() => {
      if (!alive) return;
      try {
        const data = read();
        const raw = localStorage.getItem(KEY);
        if (!raw || JSON.parse(raw).version !== 4) localStorage.setItem(KEY, JSON.stringify(data));
        setStored(data);
        setTick(Date.now());
        const rawSession = sessionStorage.getItem(DEMO_SESSION_KEY);
        let restored: MockSession | null = null;
        if (rawSession) {
          try { const candidate = JSON.parse(rawSession) as MockSession; requireMockSession(data.state, candidate); setSession(candidate); restored = candidate; }
          catch { sessionStorage.removeItem(DEMO_SESSION_KEY); }
        }
        if (demoRole && restored?.role !== demoRole) {
          const actor=data.state.users.find(user=>user.role===demoRole&&user.status!=="suspended")!;
          const logged=loginMock(data.state,actor.email!,"O365-DEMO-"+actor.id+"-v"+(actor.credentialVersion??1),Date.now(),"fixture-workspace-"+crypto.randomUUID());
          data.state=logged.state;localStorage.setItem(KEY,JSON.stringify(data));sessionStorage.setItem(DEMO_SESSION_KEY,JSON.stringify(logged.session));setStored({...data});setSession(logged.session);
        }
      } catch (error) { setStorageError(error instanceof Error ? error.message : "Không thể truy cập bộ nhớ trình duyệt."); }
      setReady(true);
      }).catch(error => { if (alive) { setStorageError(error instanceof Error ? error.message : 'Không thể khôi phục kho demo.'); setReady(true); } });
    });
    const listener = (event: StorageEvent) => {
      if (event.key !== KEY && event.key !== null) return;
      try { setStored(read()); setStorageError(""); } catch (error) { setStorageError((error as Error).message); }
    };
    window.addEventListener("storage", listener);
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("storage", listener); };
  }, [demoRole]);
  const now = stored.demoEpoch + Math.max(0, (tick || stored.realEpoch) - stored.realEpoch);
  const state = stored.state;
  function persist(data: DemoStore) { localStorage.setItem(KEY, JSON.stringify(data)); setStored(data); setTick(Date.now()); setStorageError(""); }
  const run = useCallback(async (actorId: string, command: Command, silent = false) => {
    const scopedCommand = captureEnrollmentContext(state, actorId, command);
    await withLock(() => {
      const latest = read();
      const actor = requireMockSession(latest.state, session);
      if (actor.id !== actorId) throw new Error("Phiên mô phỏng không thuộc tài khoản thực hiện.");
      const time = latest.demoEpoch + Math.max(0, Date.now() - latest.realEpoch);
      const current = synchronizeMockState(latest.state, time);
      let nextState: LmsState;
      try { nextState = executeAuthenticated(current, session, scopedCommand, time); }
      catch (error) { if (current !== latest.state) persist({ ...latest, state: current }); throw error; }
      persist({ ...latest, state: synchronizeMockState(nextState, time) });
      if (!silent) setToast("Đã cập nhật dữ liệu · Chế độ mô phỏng.");
    });
  }, [session, state]);
  const pauseAssignmentOnExit = useCallback((actorId: string, attemptId: string) => {
    void withLock(() => {
      const latest = read();
      const actor = requireMockSession(latest.state, session);
      if (actor.id !== actorId) return;
      const attempt = latest.state.attempts.find(a => a.id === attemptId && a.studentId === actorId);
      if (attempt?.status !== "active" || !latest.state.quizzes.some(q => q.id === attempt.quizId && q.kind === "assignment")) return;
      const time = latest.demoEpoch + Math.max(0, Date.now() - latest.realEpoch);
      persist({ ...latest, state: executeAuthenticated(latest.state, session, captureEnrollmentContext(state, actorId, { type: "pauseQuiz", attemptId }), time) });
    }).catch(() => {});
  }, [session, state]);
  useEffect(() => {
    if (!ready || storageError || synchronizeMockState(state, now) === state) return;
    void withLock(() => {
      const latest = read();
      const time = latest.demoEpoch + Math.max(0, Date.now() - latest.realEpoch);
      const synced = synchronizeMockState(latest.state, time);
      if (synced !== latest.state) persist({ ...latest, state: synced });
    }).catch(error => setStorageError(error instanceof Error ? error.message : "Không thể lưu dữ liệu mô phỏng."));
  }, [ready, storageError, state, now]);
  async function login(email: string, code: string) {
    let role: Role | null = null;
    await withLock(() => {
      const latest = read();
      const time = latest.demoEpoch + Math.max(0, Date.now() - latest.realEpoch);
      const loggedIn = loginMock(latest.state, email, code, time, 'mock-session-' + crypto.randomUUID());
      const nextState = logoutMock(loggedIn.state, session);
      sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(loggedIn.session));
      persist({ ...latest, state: nextState });
      setSession(loggedIn.session);
      role = loggedIn.session.role;
    });
    return role;
  }
  async function logout() {
    await withLock(() => { const latest = read(); persist({ ...latest, state: logoutMock(latest.state, session) }); sessionStorage.removeItem(DEMO_SESSION_KEY); setSession(null); });
  }
  async function reset() {
    await withLock(() => { const data = initial(); persist(data); setSession(null); sessionStorage.removeItem(DEMO_SESSION_KEY); });
  }
  async function simulateTime(target: number) {
    await withLock(() => {
      if (!Number.isFinite(target)) throw new Error("Mốc thời gian không hợp lệ.");
      const latest = read(); requireMockSession(latest.state, session);
      persist({ ...latest, demoEpoch: target, realEpoch: Date.now(), state: { ...latest.state, referenceTime: new Date(target).toISOString() } });
      setToast("Chế độ mô phỏng · Đã đổi thời gian cho các tab.");
    });
  }
  async function advanceTime(milliseconds: number) {
    await withLock(() => {
      const latest = read(); requireMockSession(latest.state, session);
      persist(advanceDemoClock(latest, milliseconds, Date.now()));
      setToast("Chế độ mô phỏng · Đã tiến đồng hồ dùng chung.");
    });
  }
  return { state, now, ready, session, storageError, migrationNotice: stored.migrationNotice, toast, dismissToast: () => setToast(""), account: (role: Role) => accountFor(state, role, session?.userId), run, pauseAssignmentOnExit, reset, simulateTime, advanceTime, login, logout };
}
const Context = createContext<ReturnType<typeof useController> | null>(null);
export function LmsProvider({ children, demoRole }: { children: ReactNode; demoRole?: Role }) { const value = useController(demoRole); return <Context.Provider value={value}>{children}{value.toast && <Toast message={value.toast} onDismiss={value.dismissToast} />}</Context.Provider>; }
export function useLms() { const context = useContext(Context); if (!context) throw new Error("Missing LMS provider"); return context; }
