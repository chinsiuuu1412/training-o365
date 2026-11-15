"use client";
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type ReactElement } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LoadingState } from "./states";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const generatedId = useId();
  const nativeControl = isValidElement(children) && typeof children.type === "string" && ["input", "select", "textarea"].includes(children.type);
  if (!nativeControl) return <label className="grid min-w-0 gap-2 text-sm font-medium">{label}{children}{hint && <span className="text-xs font-normal leading-5 text-muted-foreground">{hint}</span>}</label>;
  const control = children as ReactElement<{ id?: string; "aria-describedby"?: string }>;
  const id = control.props.id ?? generatedId;
  const hintId = `${id}-hint`;
  return <div className="grid min-w-0 gap-2 text-sm font-medium"><label htmlFor={id}>{label}</label>{cloneElement(control, { id, "aria-describedby": [control.props["aria-describedby"], hint ? hintId : undefined].filter(Boolean).join(" ") || undefined })}{hint && <span id={hintId} className="text-xs font-normal leading-5 text-muted-foreground">{hint}</span>}</div>;
}
export function Feedback({ message, error = false }: { message: string; error?: boolean }) {
  const Icon = error ? CircleAlert : CircleCheck;
  return message ? <div role={error ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm leading-6 ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0" /><p>{message}</p></div> : null;
}
export function ActionForm({ onSubmit, children, submitLabel = "Lưu thay đổi", onCancel }: { onSubmit: (data: FormData) => Promise<void>; children: ReactNode; submitLabel?: string; onCancel?: () => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const errorId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; setError(""); setBusy(true); try { await onSubmit(new FormData(form)); } catch (e) { setError(e instanceof Error ? e.message : "Không thể hoàn tất thao tác."); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="space-y-4" aria-busy={busy} aria-describedby={error ? errorId : undefined}><fieldset disabled={busy} className="min-w-0 space-y-4">{children}</fieldset>{error && <div ref={errorRef} id={errorId} tabIndex={-1} className="rounded-lg"><Feedback message={error} error /></div>}<div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">{onCancel && <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Hủy</Button>}<Button type="submit" disabled={busy}>{busy && <LoaderCircle aria-hidden="true" className="animate-spin" />}{busy ? "Đang lưu…" : submitLabel}</Button></div></form>;
}
export function ConfirmAction({ title, description, trigger, onConfirm, needsReason = true, reasonLimit = 1000 }: { title: string; description: string; trigger: string; onConfirm: (reason: string) => Promise<void>; needsReason?: boolean; reasonLimit?: number }) {
  const [open, setOpen] = useState(false);
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}>{trigger}</Button><Dialog title={title} description={description} open={open} onOpenChange={setOpen}><ActionForm onCancel={() => setOpen(false)} submitLabel="Xác nhận" onSubmit={async data => { await onConfirm(String(data.get("reason") ?? "")); setOpen(false); }}>{needsReason && <Field label="Lý do *"><textarea name="reason" required maxLength={reasonLimit} className="form-control min-h-24" /></Field>}</ActionForm></Dialog></>;
}
export function DataTable({ caption, columns, children }: { caption: string; columns: string[]; children: ReactNode }) { return <div className="min-w-0 space-y-2"><p className="text-xs leading-5 text-muted-foreground sm:hidden">Cuộn ngang để xem đầy đủ bảng.</p><div role="region" tabIndex={0} aria-label={`${caption} · Cuộn ngang để xem toàn bộ bảng`} className="data-table max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-white"><table className="w-full min-w-[700px] text-left text-sm"><caption className="sr-only">{caption}</caption><thead className="border-b border-border bg-slate-50"><tr>{columns.map(column => <th scope="col" key={column} className="px-4 py-3 text-xs font-medium text-slate-600">{column}</th>)}</tr></thead><tbody className="divide-y divide-border">{children}</tbody></table></div></div>; }
export function Pagination({page,pageSize,total,onPage}:{page:number;pageSize:number;total:number;onPage:(page:number)=>void}){return <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">Trang {page} / {Math.max(1,Math.ceil(total/pageSize))} · {total} bản ghi</p><div className="flex gap-2"><Button variant="outline" disabled={page<=1} onClick={()=>onPage(page-1)}>Trang trước</Button><Button variant="outline" disabled={page*pageSize>=total} onClick={()=>onPage(page+1)}>Trang sau</Button></div></nav>;}
export function ResourceFeedback({resource}:{resource:{data?:unknown;loading:boolean;error:string;refresh:()=>Promise<boolean>}}){if(resource.loading&&resource.data===undefined)return <LoadingState/>;return <>{resource.error&&<div className="space-y-3"><Feedback error message={resource.error}/><Button variant="outline" onClick={()=>void resource.refresh()}>Thử tải lại</Button></div>}{resource.loading&&<p role="status" className="text-sm text-muted-foreground">Đang cập nhật dữ liệu…</p>}</>;}
