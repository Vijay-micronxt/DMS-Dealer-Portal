import type { LineAvailability } from "@/api/availability";
import { formatBoxQty } from "@/lib/stock-format";

export const NOT_AVAILABLE_HINT =
  "You can raise an inquiry or request a quotation.";

/** What the dealer sees for a line once they've entered a quantity: Available (with which
 * batch(es) it will come from and how many boxes from each) or Not available. Never a stock
 * figure, never a "partly available". */
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
  if (!availability.available) {
    return (
      <p className="text-xs text-rose-600">
        <span className="font-medium">Not available.</span> {NOT_AVAILABLE_HINT}
      </p>
    );
  }
  // A split is only shown when the batches really cover the whole quantity -- a partial
  // list would read as if the rest could not be supplied.
  const covered = availability.batches.reduce((sum, b) => sum + b.boxes, 0);
  const showBatches =
    availability.batches.length > 0 && covered >= availability.boxes - 0.001;
  return (
    <div className="space-y-0.5 text-xs">
      <p className="font-medium text-emerald-600">Available</p>
      {showBatches && (
        <div className="text-zinc-500">
          {availability.batches.length > 1 && (
            <p>Will be supplied from {availability.batches.length} batches:</p>
          )}
          {availability.batches.map((b) => (
            <p key={b.batchNumber} className="break-words">
              Batch {b.batchNumber} — {formatBoxQty(b.boxes, piecesPerBox)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
