import type { ReactNode } from "react";
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="flex min-w-0 flex-col justify-between gap-5 sm:flex-row sm:items-end"><div className="min-w-0 flex-1">{eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[.14em] text-primary">{eyebrow}</p>}<h1 className="text-[28px] font-semibold leading-tight tracking-tight lg:text-[32px]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p></div>{actions && <div className="flex max-w-full flex-wrap gap-2 sm:max-w-[50%]">{actions}</div>}</div>;
}
