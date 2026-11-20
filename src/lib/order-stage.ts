/** What a dealer reads for an order's stage. A order the dealer has just sent is saved as a draft that
 * Pacific reviews and submits; to the dealer that is "Awaiting confirmation", never the internal word. */
export function orderStageLabel(stage: string): string {
  return stage === "Draft" ? "Awaiting confirmation" : stage;
}
