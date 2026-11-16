"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
export function Sheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (value: boolean) => void; children: ReactNode }) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="drawer-overlay fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" /><Dialog.Content onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }} className="drawer-panel fixed inset-y-0 left-0 z-50 w-72 max-w-[calc(100vw-32px)] overflow-y-auto bg-navy text-white shadow-xl"><Dialog.Title className="sr-only">Điều hướng chính</Dialog.Title><Dialog.Description className="sr-only">Chọn một mục để di chuyển trong hệ thống học tập.</Dialog.Description><Dialog.Close className="absolute right-3 top-5 z-10 rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Đóng điều hướng"><X size={18} /></Dialog.Close>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
