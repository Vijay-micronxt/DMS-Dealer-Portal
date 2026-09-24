import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-base text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
