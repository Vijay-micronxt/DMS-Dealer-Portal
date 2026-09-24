import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-sky-100 text-sky-800",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Maps an Inquiry/Order status string to a badge tone -- shared so a status reads the
 * same color everywhere it appears (catalog stock, enquiry list, order stage). */
export function toneForStatus(status: string): BadgeTone {
  const positive = new Set([
    "Available",
    "Delivered",
    "Converted to Order",
    "Active",
  ]);
  const warning = new Set([
    "Open",
    "Partially Available",
    "Pre-order Required",
    "Quoted",
    "Confirmed",
    "Picking",
    "Ready to Dispatch",
    "Dispatched",
  ]);
  const negative = new Set([
    "Out of Stock",
    "Rejected",
    "Cancelled",
    "Discontinued",
  ]);
  if (positive.has(status)) return "success";
  if (warning.has(status)) return "warning";
  if (negative.has(status)) return "danger";
  return "neutral";
}
