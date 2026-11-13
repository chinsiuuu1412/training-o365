"use client";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="grid gap-2 text-sm font-medium">{label}{children}{hint && <span className="text-xs font-normal leading-5 text-muted-foreground">{hint}</span>}</label>; }
export function Feedback({ message, error = false }: { message: string; error?: boolean }) { return message ? <p role={error ? "alert" : "status"} className={`rounded-lg border p-3 text-sm leading-6 ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{message}</p> : null; }
export function ActionForm({ onSubmit, children, submitLabel = "Lưu thay đổi", onCancel }: { onSubmit: (data: FormData) => Promise<void>; children: ReactNode; submitLabel?: string; onCancel?: () => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const errorId = useId();
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; setError(""); setBusy(true); try { await onSubmit(new FormData(form)); } catch (e) { setError(e instanceof Error ? e.message : "Không thể hoàn tất thao tác."); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="space-y-4" aria-describedby={error ? errorId : undefined}><fieldset disabled={busy} className="min-w-0 space-y-4">{children}</fieldset><div id={errorId}><Feedback message={error} error /></div><div className="flex flex-wrap justify-end gap-3">{onCancel && <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Hủy</Button>}<Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : submitLabel}</Button></div></form>;
}
export function ConfirmAction({ title, description, trigger, onConfirm, needsReason = true }: { title: string; description: string; trigger: string; onConfirm: (reason: string) => Promise<void>; needsReason?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}>{trigger}</Button><Dialog title={title} description={description} open={open} onOpenChange={setOpen}><ActionForm onCancel={() => setOpen(false)} submitLabel="Xác nhận" onSubmit={async data => { await onConfirm(String(data.get("reason") ?? "")); setOpen(false); }}>{needsReason && <Field label="Lý do *"><textarea name="reason" required maxLength={1000} className="form-control min-h-24" /></Field>}</ActionForm></Dialog></>;
}
export function DataTable({ caption, columns, children }: { caption: string; columns: string[]; children: ReactNode }) { return <div role="region" tabIndex={0} aria-label={`${caption} · Cuộn ngang để xem toàn bộ bảng`} className="overflow-x-auto rounded-xl border border-border bg-white"><table className="w-full min-w-[700px] text-left text-sm"><caption className="sr-only">{caption}</caption><thead className="border-b border-border bg-slate-50"><tr>{columns.map(column => <th scope="col" key={column} className="px-4 py-3 text-xs font-medium text-muted-foreground">{column}</th>)}</tr></thead><tbody className="divide-y divide-border">{children}</tbody></table></div>; }
