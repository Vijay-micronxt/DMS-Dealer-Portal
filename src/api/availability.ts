import { useQuery } from "@tanstack/react-query";
import { authedCall } from "@/lib/auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

/** One line to judge: the same entry shape raiseInquiries takes (`qty` is the Pcs part). */
export type AvailabilityEntry = {
  item: string;
  qty: number;
  enteredBoxes: number;
  damagedStock?: boolean | undefined;
};

export type LineAvailability = {
  item: string;
  /** The quantity asked for, in boxes (Pcs rounded up to a whole box). */
  boxes: number;
  /** True only when the WHOLE quantity asked for can be supplied -- the order gate reads this,
   * so a partly-available line is false here and still not orderable. */
  available: boolean;
  /** How many of those boxes can be supplied now (all of them when `available`). Never more than
   * `boxes` -- it is the part of the dealer's own quantity, not a stock figure. */
  availableBoxes: number;
  shortfallBoxes: number;
  /** The batch(es) the system will draw the available boxes from, and how many from each.
   * Only what was asked for -- never a batch's own stock. Empty when nothing is available. */
  batches: { batchNumber: string; boxes: number }[];
  /** Stock already on an open purchase order. `boxes`/`eta`/`days` describe the first arrival
   * only; `totalBoxes` is everything on order. `days` is 0 when it is due now or late, and null
   * when the order has no expected date. */
  inTransit: {
    boxes: number;
    eta: string | null;
    days: number | null;
    totalBoxes: number;
  } | null;
};

export function checkAvailability(
  items: AvailabilityEntry[],
): Promise<LineAvailability[]> {
  return authedCall("dms_erp.sales.dealer_portal_api.check_availability", {
    method: "GET",
    params: { items: JSON.stringify(items) },
  });
}

/** "Available" / "Not available" for each line as the dealer types, one request for the whole
 * list. Debounced so typing a quantity doesn't fire a call per keystroke; nothing is asked
 * until every line has a quantity above zero. Returned in the order of `entries`. */
export function useAvailability(entries: AvailabilityEntry[]) {
  const ready =
    entries.length > 0 && entries.every((e) => e.enteredBoxes + e.qty > 0);
  const key = useDebouncedValue(JSON.stringify(ready ? entries : []), 400);
  const settled = key === JSON.stringify(ready ? entries : []);
  const query = useQuery({
    queryKey: ["availability", key],
    queryFn: () => checkAvailability(JSON.parse(key) as AvailabilityEntry[]),
    enabled: ready && settled,
    staleTime: 15_000,
  });
  return {
    lines: ready && settled ? (query.data ?? null) : null,
    isChecking: ready && (!settled || query.isFetching),
  };
}
