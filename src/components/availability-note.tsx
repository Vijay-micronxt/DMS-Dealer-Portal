import type { LineAvailability } from "@/api/availability";
import { formatBoxQty } from "@/lib/stock-format";
import { formatDate } from "@/lib/utils";

export const NOT_AVAILABLE_HINT =
  "You can raise an inquiry or request a quotation.";

/** "expected in about 5 days" / "expected within a day" / "expected soon" -- never a date in the
 * past, and never a promise when the purchase order has no expected date at all. */
export function arrivalPhrase(days: number | null, eta: string | null): string {
  if (days === null) return "soon";
  if (days <= 1) return "in 1 day";
  return `in ${days} days${eta ? ` (${formatDate(eta)})` : ""}`;
}

/** Whole days from today to an ISO date (0 when it is today or already past); null without one.
 * For places that only have the catalog's `inTransitEta`, not the per-line availability check. */
export function daysUntil(eta: string | null | undefined): number | null {
  if (!eta) return null;
  const due = new Date(`${eta}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(
    Math.round((due.getTime() - start.getTime()) / 86_400_000),
    0,
  );
}

/** What the dealer sees for a line once they've entered a quantity: Available, Partly available
 * (how much of what they asked for, and from which batches) or Not available -- plus, when more
 * stock is already on an open purchase order, when the first of it is due. Never a stock figure
 * beyond the dealer's own quantity. */
export function AvailabilityNote({
  availability,
  checking,
  piecesPerBox,
}: {
  availability: LineAvailability | null | undefined;
  checking?: boolean;
  piecesPerBox?: number | null | undefined;
}) {
  if (!availability) {
    return checking ? (
      <p className="text-xs text-zinc-400">Checking availability…</p>
    ) : null;
  }

  const partly = !availability.available && availability.availableBoxes > 0;
  const transit = availability.inTransit;

  // The batches are those of the boxes that CAN be supplied now (all of them when fully available).
  const covered = availability.batches.reduce((sum, b) => sum + b.boxes, 0);
  const showBatches =
    availability.batches.length > 0 &&
    covered >= availability.availableBoxes - 0.001;

  return (
    <div className="space-y-0.5 text-xs">
      {availability.available ? (
        <p className="font-medium text-emerald-600">Available</p>
      ) : partly ? (
        <>
          <p className="font-medium text-amber-600">
            Partly available —{" "}
            {formatBoxQty(availability.availableBoxes, piecesPerBox)} available
            now (you asked for {formatBoxQty(availability.boxes, piecesPerBox)})
          </p>
          <p className="text-zinc-500">
            Short by {formatBoxQty(availability.shortfallBoxes, piecesPerBox)}.{" "}
            {NOT_AVAILABLE_HINT}
          </p>
        </>
      ) : (
        <p className="text-rose-600">
          <span className="font-medium">Not available.</span>{" "}
          {NOT_AVAILABLE_HINT}
        </p>
      )}
      {showBatches && (
        <div className="text-zinc-500">
          {availability.batches.length > 1 ? (
            <p>
              {partly
                ? "The available boxes come from"
                : "Will be supplied from"}{" "}
              {availability.batches.length} batches:
            </p>
          ) : (
            partly && <p>The available boxes come from:</p>
          )}
          {availability.batches.map((b) => (
            <p key={b.batchNumber} className="break-words">
              Batch {b.batchNumber} — {formatBoxQty(b.boxes, piecesPerBox)}
            </p>
          ))}
        </div>
      )}
      {transit && (
        <p className="text-sky-700">
          {formatBoxQty(transit.boxes, piecesPerBox)} will be available{" "}
          {arrivalPhrase(transit.days, transit.eta)}
          {transit.totalBoxes > transit.boxes + 0.001
            ? ` · ${formatBoxQty(transit.totalBoxes, piecesPerBox)} on order in all`
            : ""}
          .
        </p>
      )}
    </div>
  );
}
