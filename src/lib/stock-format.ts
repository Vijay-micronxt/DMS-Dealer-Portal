/**
 * Stock is held in boxes (the Item's stock UOM), but a loose part-box is real stock too — Tally
 * migration and piece-level sales leave quantities like 70.888889 boxes, which on a 9-pcs box is
 * 70 full boxes and 8 loose pieces. Showing the raw decimal made staff read it as "70.9 boxes";
 * this renders it the way the warehouse counts it: "70 Box 8 pcs".
 *
 * Without a known pieces-per-box there's no honest way to split the remainder, so the box figure
 * is shown rounded to 2 decimals instead of inventing a piece count.
 */
export function formatBoxQty(
  qty: number | null | undefined,
  piecesPerBox?: number | null,
): string {
  const value = Number(qty) || 0;
  const ppb = Math.round(Number(piecesPerBox) || 0);
  if (ppb <= 1) {
    return `${Number(value.toFixed(2)).toLocaleString("en-IN")} Box`;
  }
  const sign = value < 0 ? "-" : "";
  // Round to whole pieces first, so 70.999999 on a 9-pcs box is 71 Box, not "70 Box 9 pcs".
  const totalPieces = Math.round(Math.abs(value) * ppb);
  const boxes = Math.floor(totalPieces / ppb);
  const pieces = totalPieces % ppb;
  if (pieces === 0) return `${sign}${boxes.toLocaleString("en-IN")} Box`;
  if (boxes === 0) return `${sign}${pieces} pcs`;
  return `${sign}${boxes.toLocaleString("en-IN")} Box ${pieces} pcs`;
}
