"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { LmsState, Role } from "@/types/lms";
import { createInitialState, isValidState, migrateLessonState } from "@/mocks/state";
import { accountFor, execute, type Command } from "@/mocks/services/management";

const KEY = "hoc-viet-lms-prompt03-v1";
interface Stored { version: 1; state: LmsState; demoEpoch: number; realEpoch: number }
function initial(): Stored { const state = createInitialState(); return { version: 1, state, demoEpoch: Date.parse(state.referenceTime), realEpoch: Date.now() }; }
function read(): Stored {
  const raw = localStorage.getItem(KEY);
  if (!raw) return initial();
  const data = JSON.parse(raw) as Stored;
  if (data?.state) data.state = migrateLessonState(data.state);
  if (!data || data.version !== 1 || !Number.isFinite(data.demoEpoch) || !Number.isFinite(data.realEpoch) || !isValidState(data.state)) throw new Error("Dữ liệu lưu không hợp lệ. Dùng Khôi phục demo để bắt đầu lại.");
  return data;
}
const defaultAccounts: Record<Role, string> = { admin: "a1", teacher: "t1", student: "s1" };
function useController() {
  const [stored, setStored] = useState<Stored>(initial);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [selected, setSelected] = useState(defaultAccounts);
  const [tick, setTick] = useState(0);
  const [toast,setToast]=useState("");
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(""),5000);return()=>clearTimeout(timer);},[toast]);
  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      try {
        const data = read();
        if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(data));
        setStored(data);
        const accounts = sessionStorage.getItem(`${KEY}-accounts`);
        if (accounts) setSelected({ ...defaultAccounts, ...JSON.parse(accounts) });
      } catch (error) { setStorageError(error instanceof Error ? error.message : "Không thể truy cập bộ nhớ trình duyệt."); }
      setReady(true);
    });
    const listener = (event: StorageEvent) => { if (event.key === KEY || event.key === null) { try { setStored(read()); setStorageError(""); } catch (error) { setStorageError((error as Error).message); } } };
    window.addEventListener("storage", listener);
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("storage", listener); };
  }, []);
  const now = stored.demoEpoch + Math.max(0, (tick || stored.realEpoch) - stored.realEpoch);
  const state = stored.state;
  function selectAccount(role: Role, userId: string) {
    const updated = { ...selected, [role]: userId };
    setSelected(updated);
    try { sessionStorage.setItem(`${KEY}-accounts`, JSON.stringify(updated)); } catch { /* Selection still works in memory. */ }
  }
  async function withLock(action: () => void) {
    if (navigator.locks) await navigator.locks.request(KEY, action); else action();
  }
  async function run(actorId: string, command: Command) {
    await withLock(() => {
      const latest = read();
      const time = latest.demoEpoch + Math.max(0, Date.now() - latest.realEpoch);
      const updated = { ...latest, state: execute(latest.state, actorId, command, time) };
      localStorage.setItem(KEY, JSON.stringify(updated));
      setStored(updated); setTick(Date.now()); setStorageError("");
      setToast("Đã cập nhật dữ liệu mô phỏng.");
    });
  }
  async function reset() {
    await withLock(() => { const data = initial(); localStorage.setItem(KEY, JSON.stringify(data)); setStored(data); setSelected(defaultAccounts); sessionStorage.removeItem(`${KEY}-accounts`); setTick(Date.now()); setStorageError(""); });
  }
  async function simulateTime(target:number) { await withLock(()=>{if(!Number.isFinite(target))throw new Error("Mốc thời gian không hợp lệ.");const latest=read();const updated={...latest,demoEpoch:target,realEpoch:Date.now(),state:{...latest.state,referenceTime:new Date(target).toISOString()}};localStorage.setItem(KEY,JSON.stringify(updated));setStored(updated);setTick(Date.now());setToast("Đã đổi thời gian mô phỏng cho các tab.");}); }
  return { state, now, ready, storageError, toast, dismissToast:()=>setToast(""), account: (role: Role) => accountFor(state, role, selected[role]), selectAccount, run, reset, simulateTime };
}
const Context = createContext<ReturnType<typeof useController> | null>(null);
export function LmsProvider({ children }: { children: ReactNode }) { const value = useController(); return <Context.Provider value={value}>{children}{value.toast&&<div role="status" className="fixed bottom-5 right-4 z-[70] flex max-w-[calc(100vw-32px)] items-center gap-4 rounded-xl border border-blue-200 bg-white p-4 text-sm shadow-lg"><span>{value.toast}</span><button onClick={value.dismissToast} aria-label="Đóng thông báo">×</button></div>}</Context.Provider>; }
export function useLms() { const context = useContext(Context); if (!context) throw new Error("Missing LMS provider"); return context; }
