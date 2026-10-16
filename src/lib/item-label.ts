import type { Inquiry } from "@/api/types";

/** What one item of an enquiry is called: its name, else its code, else the style the dealer
 * typed for a custom request. */
export function itemLabel(item: Inquiry): string {
  return (
    item.productName ?? item.productId ?? item.requestedStyle ?? "Custom style"
  );
}
