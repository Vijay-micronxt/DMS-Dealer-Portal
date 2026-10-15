import { authedCall } from "@/lib/auth";
import type { Order, Paginated, Quotation } from "@/api/types";

/** Quotations Pacific has prepared for this dealer. An enquiry becomes an order only by
 * accepting one of these (acceptQuotation) -- there is no direct "convert enquiry". */
export function listMyQuotations(params: {
  status?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}): Promise<Paginated<Quotation>> {
  return authedCall("dms_erp.sales.dealer_portal_api.list_my_quotations", {
    method: "GET",
    params,
  });
}

export function getMyQuotation(quotation: string): Promise<Quotation> {
  return authedCall("dms_erp.sales.dealer_portal_api.get_my_quotation", {
    method: "GET",
    params: { quotation },
  });
}

/** The dealer's order confirmation: builds the order from the quotation exactly as quoted,
 * tagged with the dealer's own PO number. */
export function acceptQuotation(params: {
  quotation: string;
  expected_dispatch: string;
  customer_po: string;
}): Promise<Order> {
  return authedCall("dms_erp.sales.dealer_portal_api.accept_quotation", {
    method: "POST",
    params,
  });
}
