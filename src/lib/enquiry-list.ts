import { useSyncExternalStore } from "react";

/**
 * The dealer's enquiry list -- items collected while browsing, sent to Pacific together as
 * one enquiry (raiseInquiries). Kept in localStorage so it survives navigating between
 * catalogue pages and a reload, and cleared on sign-out so it never carries into another
 * dealer's login. Storage can be blocked or empty (private window): every read/write is
 * guarded and the list simply lives in memory for that session instead.
 */
export type EnquiryLine = { code: string; name: string; qty: number };

const KEY = "dms-portal-enquiry-list";
const listeners = new Set<() => void>();

function read(): EnquiryLine[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (l): l is EnquiryLine =>
            !!l &&
            typeof l.code === "string" &&
            typeof l.name === "string" &&
            typeof l.qty === "number",
        )
      : [];
  } catch {
    return [];
  }
}

let lines: EnquiryLine[] = typeof window === "undefined" ? [] : read();

function commit(next: EnquiryLine[]) {
  lines = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* in-memory only */
  }
  listeners.forEach((l) => l());
}

/** Adding an item already on the list adds to its quantity rather than listing it twice. */
export function addToEnquiryList(line: EnquiryLine) {
  const existing = lines.find((l) => l.code === line.code);
  commit(
    existing
      ? lines.map((l) =>
          l.code === line.code ? { ...l, qty: l.qty + line.qty } : l,
        )
      : [...lines, line],
  );
}

export function setEnquiryQty(code: string, qty: number) {
  commit(lines.map((l) => (l.code === code ? { ...l, qty } : l)));
}

export function removeFromEnquiryList(code: string) {
  commit(lines.filter((l) => l.code !== code));
}

export function clearEnquiryList() {
  commit([]);
}

export function useEnquiryList(): EnquiryLine[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lines,
    () => [],
  );
}
