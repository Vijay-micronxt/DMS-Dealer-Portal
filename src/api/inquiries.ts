import { authedCall } from "@/lib/auth";
import type { Inquiry, Order, Paginated } from "@/api/types";

export function raiseInquiry(params: {
  item: string;
  qty: number;
  remarks?: string | undefined;
}): Promise<Inquiry> {
  return authedCall("dms_erp.sales.dealer_portal_api.raise_inquiry", {
    method: "POST",
    params,
  });
}

/** BRD C.13.1 -- converts an in-stock enquiry straight to an order, tagged with the
 * dealer's own PO number. Only works on an enquiry this dealer owns. */
export function convertToOrder(params: {
  inquiry: string;
  expected_dispatch: string;
  customer_po: string;
}): Promise<Order> {
  return authedCall("dms_erp.sales.dealer_portal_api.convert_to_order", {
    method: "POST",
    params,
  });
}

export function listMyInquiries(params: {
  status?: string | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}): Promise<Paginated<Inquiry>> {
  return authedCall("dms_erp.sales.dealer_portal_api.list_my_inquiries", {
    method: "GET",
    params,
  });
}

export function getMyInquiry(inquiry: string): Promise<Inquiry> {
  return authedCall("dms_erp.sales.dealer_portal_api.get_my_inquiry", {
    method: "GET",
    params: { inquiry },
  });
}
