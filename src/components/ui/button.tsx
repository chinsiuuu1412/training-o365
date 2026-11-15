import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva("inline-flex max-w-full min-w-0 shrink-0 items-center justify-center gap-2 whitespace-normal rounded-lg text-center text-sm font-medium leading-5 transition-[color,background-color,border-color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: { default: "bg-primary text-primary-foreground hover:bg-primary/90", outline: "border border-border bg-white hover:bg-slate-50 text-foreground", ghost: "hover:bg-slate-100 text-muted-foreground" },
    size: { default: "min-h-11 px-4 py-2.5", sm: "min-h-9 px-3 py-2", icon: "size-11" },
  }, defaultVariants: { variant: "default", size: "default" },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
