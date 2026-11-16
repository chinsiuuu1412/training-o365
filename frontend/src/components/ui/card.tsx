import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }: ComponentProps<"section">) { return <section className={cn("rounded-2xl border border-border bg-card shadow-[0_2px_6px_0_rgb(15_23_42/0.025)]", className)} {...props} />; }
