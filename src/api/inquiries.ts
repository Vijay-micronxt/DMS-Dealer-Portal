import { authedCall } from "@/lib/auth";
import type { Enquiry, Inquiry, Order, Paginated } from "@/api/types";

export function raiseInquiry(params: {
  item: string;
  /** BRD C.1.3/C.2.2, client request 2 Nov 2026 -- the Pcs component when
   * `enteredBoxes` is also given (a combined Boxes+Pcs entry), otherwise the
   * plain box count. Never a pre-combined total -- see readBoxesAndPieces's own
   * docstring for why that doesn't round-trip back to what was actually typed. */
  qty: number;
  remarks?: string | undefined;
  /** ISS-2026-00678 -- set when raised from the item page's damaged/insurance-claim
   * bay stock display rather than the regular catalogue. */
  damagedStock?: boolean | undefined;
  /** The Boxes component of a combined Boxes+Pcs entry; omitted for a plain,
   * boxes-only enquiry. */
  enteredBoxes?: number | undefined;
}): Promise<Inquiry> {
  return authedCall("dms_erp.sales.dealer_portal_api.raise_inquiry", {
    method: "POST",
    params: {
      item: params.item,
      qty: params.qty,
      remarks: params.remarks,
      damaged_stock: params.damagedStock,
      entered_boxes: params.enteredBoxes,
    },
  });
}

/** Several items enquired on in one go. Each becomes its own enquiry; they share one
 * `requestGroup` so Pacific can quote them together. Nothing is created unless every
 * line is valid. */
export function raiseInquiries(params: {
  items: {
    item: string;
    qty: number;
    damagedStock?: boolean | undefined;
    enteredBoxes?: number | undefined;
  }[];
  remarks?: string | undefined;
}): Promise<{ requestGroup: string; items: Inquiry[] }> {
  return authedCall("dms_erp.sales.dealer_portal_api.raise_inquiries", {
    method: "POST",
    params: { items: JSON.stringify(params.items), remarks: params.remarks },
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

/** The dealer's enquiries, one entry per enquiry made -- items sent together arrive as one. */
export function listMyEnquiries(params: {
  status?: string | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}): Promise<Paginated<Enquiry>> {
  return authedCall("dms_erp.sales.dealer_portal_api.list_my_enquiries", {
    method: "GET",
    params,
  });
}

export function getMyEnquiry(enquiry: string): Promise<Enquiry> {
  return authedCall("dms_erp.sales.dealer_portal_api.get_my_enquiry", {
    method: "GET",
    params: { enquiry },
  });
}

/** Client request, 28 Oct 2026 -- flags every still-waiting item in this enquiry as
 * dealer-requested, so staff can see and prioritize it. Silent/idempotent on an enquiry
 * with nothing left to flag (already quoted or closed out). */
export function requestQuotation(
  enquiry: string,
): Promise<{ flagged: number }> {
  return authedCall("dms_erp.sales.dealer_portal_api.request_quotation", {
    method: "POST",
    params: { enquiry },
  });
}

/** BRD C.13.1 -- "if in stock, the dealer can convert the enquiry to an order,
 * entering their own PO number to tag and close it," offered by the portal again
 * (2 Nov 2026) alongside acceptQuotation. One Sales Order is built straight from
 * this single inquiry's own item/qty -- there's no batch/group variant, so a
 * multi-item enquiry needs one call per inquiry id (see routes/enquiry.tsx). */
export function convertToOrder(params: {
  inquiry: string;
  expectedDispatch: string;
  customerPo: string;
}): Promise<Order> {
  return authedCall("dms_erp.sales.dealer_portal_api.convert_to_order", {
    method: "POST",
    params: {
      inquiry: params.inquiry,
      expected_dispatch: params.expectedDispatch,
      customer_po: params.customerPo,
    },
  });
}
