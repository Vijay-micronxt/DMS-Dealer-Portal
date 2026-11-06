import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * BRD C.1.3/C.2.2, client request 2 Nov 2026 -- a dealer can enter a quantity as
 * boxes and pieces together (e.g. "50 Box 5 Pcs"), the same mixed format the rest
 * of this app already displays stock in (lib/stock-format.ts's formatBoxQty) --
 * not a Box-or-Pcs toggle, and NOT collapsed into one combined "total pieces"
 * number before sending: a pieces count at or above the item's own pieces-per-box
 * figure doesn't round-trip back to the same split the dealer actually typed
 * (client report, 2 Nov 2026 -- 50 Box + 5 Pcs on a 4-pcs box came back as
 * "entered as 205 Pcs" after being pre-combined, instead of "50 Box 5 Pcs"). The
 * two numbers travel separately all the way to the backend (dealer_portal_api.
 * raise_inquiry/raise_inquiries' own `entered_boxes` param) and back.
 */
export interface BoxesPieces {
  /** The Boxes field value, as typed (0 when left blank). */
  boxes: number;
  /** The Pcs field value, as typed (0 when left blank or no piecesPerBox figure). */
  pieces: number;
}

/** Null when both fields are empty/zero -- nothing to send. */
export function readBoxesAndPieces(
  boxes: string,
  pieces: string,
  piecesPerBox: number | null | undefined,
): BoxesPieces | null {
  const b = Number(boxes) || 0;
  const p = piecesPerBox ? Number(pieces) || 0 : 0;
  if (b <= 0 && p <= 0) return null;
  return { boxes: b, pieces: p };
}

export function BoxesPiecesFields({
  boxes,
  pieces,
  onBoxesChange,
  onPiecesChange,
  piecesPerBox,
  className,
  inputClassName,
}: {
  boxes: string;
  pieces: string;
  onBoxesChange: (v: string) => void;
  onPiecesChange: (v: string) => void;
  piecesPerBox: number | null | undefined;
  className?: string;
  inputClassName?: string;
}) {
  return (
    <div className={cn("flex min-w-0 gap-2", className)}>
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        placeholder="Boxes"
        value={boxes}
        onChange={(e) => {
          // Boxes is always a whole count -- a fractional box isn't a real thing,
          // and the Pcs field right next to it is where a sub-box amount belongs.
          // Client report, 6 Nov 2026 -- a live enquiry reached the backend as
          // "28.444444 boxes" because nothing stopped a decimal from being typed
          // or pasted straight into this field; strip anything but digits so one
          // can never land here again.
          onBoxesChange(e.target.value.replace(/[^0-9]/g, ""));
        }}
        className={cn("flex-1", inputClassName)}
      />
      {/* No way to combine pieces into a box figure without this item's own
          piecesPerBox -- same gate the backend itself enforces, just surfaced
          as "there's no pieces field" instead of a failed submit. */}
      {!!piecesPerBox && (
        <Input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          placeholder="Pcs"
          value={pieces}
          onChange={(e) => onPiecesChange(e.target.value.replace(/[^0-9]/g, ""))}
          className={cn("w-20", inputClassName)}
        />
      )}
    </div>
  );
}
