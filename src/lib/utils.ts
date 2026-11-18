import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Today in the browser's local calendar day, as a date-input value. Used as `min` on any
 * date field that represents something still to happen (a future scheduled/expected date) --
 * never on a field recording when something already happened, or a filter range, which must
 * stay free to go into the past. */
export function todayISO(): string {
  // Local parts, not toISOString(): that is the UTC date, which in India is still "yesterday"
  // until 5:30am, so the date picker let people pick the day before today.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
