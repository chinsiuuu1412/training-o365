"use client";

import { CircleCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div role="status" className="toast-message fixed bottom-[max(20px,env(safe-area-inset-bottom))] right-4 z-[70] flex w-[calc(100%_-_32px)] max-w-md items-start gap-3 rounded-xl border border-blue-200 bg-white p-4 text-sm shadow-lg"><CircleCheck aria-hidden="true" size={20} className="mt-2 shrink-0 text-blue-700" /><span className="min-w-0 flex-1 self-center break-words leading-6">{message}</span><Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Đóng thông báo" className="-my-1 -mr-1 shrink-0"><X /></Button></div>;
}
