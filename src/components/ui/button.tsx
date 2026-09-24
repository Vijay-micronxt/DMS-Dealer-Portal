import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "default" | "sm" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950",
  secondary:
    "bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900",
  outline: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
  ghost: "text-zinc-700 hover:bg-zinc-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "default",
  disabled,
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
