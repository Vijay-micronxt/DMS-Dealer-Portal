import { useSyncExternalStore } from "react";
import type { ProductImage } from "@/api/types";

/**
 * The dealer's enquiry list -- items collected while browsing, sent to Pacific together as
 * one enquiry (raiseInquiries). Kept in localStorage so it survives navigating between
 * catalogue pages and a reload, and cleared on sign-out so it never carries into another
 * dealer's login. Storage can be blocked or empty (private window): every read/write is
 * guarded and the list simply lives in memory for that session instead.
 */
export type EnquiryLine = {
  code: string;
  name: string;
  qty: number;
  /** ISS-2026-00678 -- added from the item page's damaged/insurance-claim bay stock
   * display, not the regular catalogue. Kept as its own line even when the same item
   * code is already on the list as regular stock -- merging their qty would blur a
   * damaged box into a request for a regular one. */
  damagedStock?: boolean;
  /** Client request, 2 Nov 2026 -- carried over from whichever catalog/item-detail result
   * the line was added from, so the enquiry list can show a thumbnail without a second
   * fetch per line. Absent/empty renders the same "no image" placeholder ItemThumbnail
   * already falls back to elsewhere. */
  images?: ProductImage[];
  /** BRD C.1.3/C.2.2, client request 2 Nov 2026 -- the Pcs component of a combined
   * Boxes+Pcs entry (components/ui/boxes-pieces-fields.tsx); `qty` above is always
   * the Boxes component. Undefined/0 for a plain boxes-only line. Sent to
   * raiseInquiries as `enteredBoxes`/`qty` (the Pcs figure) separately, never
   * pre-combined into one total -- see readBoxesAndPieces's own docstring for why
   * that doesn't round-trip back to what was actually typed. */
  pieces?: number | undefined;
  /** Carried over at add-time (same pattern as images) so the cart's own qty editor
   * knows whether to offer a Pcs field for this line at all -- an item with no
   * pieces-per-box figure can only ever be a plain box quantity. */
  piecesPerBox?: number | null | undefined;
};

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

/** Adding an item already on the list (same code AND damagedStock) adds to its
 * quantity (boxes and pieces both) rather than listing it twice -- a damaged-stock
 * line and a regular line for the same item code stay separate rows, never merged. */
export function addToEnquiryList(line: EnquiryLine) {
  const existing = lines.find(
    (l) => l.code === line.code && !!l.damagedStock === !!line.damagedStock,
  );
  commit(
    existing
      ? lines.map((l) =>
          l === existing
            ? {
                ...l,
                qty: l.qty + line.qty,
                pieces: (l.pieces ?? 0) + (line.pieces ?? 0) || undefined,
              }
            : l,
        )
      : [...lines, line],
  );
}

export function setEnquiryQty(
  code: string,
  qty: number,
  damagedStock?: boolean,
) {
  commit(
    lines.map((l) =>
      l.code === code && !!l.damagedStock === !!damagedStock
        ? { ...l, qty }
        : l,
    ),
  );
}

export function setEnquiryPieces(
  code: string,
  pieces: number,
  damagedStock?: boolean,
) {
  commit(
    lines.map((l) =>
      l.code === code && !!l.damagedStock === !!damagedStock
        ? { ...l, pieces: pieces || undefined }
        : l,
    ),
  );
}

export function removeFromEnquiryList(code: string, damagedStock?: boolean) {
  commit(
    lines.filter(
      (l) => !(l.code === code && !!l.damagedStock === !!damagedStock),
    ),
  );
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
