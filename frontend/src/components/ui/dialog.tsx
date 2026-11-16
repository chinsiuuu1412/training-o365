"use client";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";

export function Dialog({ title, description, open, onOpenChange, children }: { title: string; description: string; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  const returnFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { if (open) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }, [open]);
  return <Primitive.Root open={open} onOpenChange={onOpenChange}><Primitive.Portal><Primitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45" /><Primitive.Content onCloseAutoFocus={event => { event.preventDefault(); if (returnFocus.current?.isConnected) { returnFocus.current.focus(); } else { document.getElementById("main-content")?.focus(); } }} className="management-dialog fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-32px)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-white p-5 shadow-xl sm:p-6"><Primitive.Title className="pr-8 text-xl font-semibold">{title}</Primitive.Title><Primitive.Description className="mt-2 text-sm leading-6 text-muted-foreground">{description}</Primitive.Description><Primitive.Close aria-label="Đóng hộp thoại" className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-slate-100"><X size={18} /></Primitive.Close><div className="mt-5">{children}</div></Primitive.Content></Primitive.Portal></Primitive.Root>;
}
