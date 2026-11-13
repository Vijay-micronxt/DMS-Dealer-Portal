import { authedCall } from "@/lib/auth";
import type {
  Enquiry,
  Inquiry,
  InquiryItemRow,
  Order,
  Paginated,
} from "@/api/types";

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
  /** ISS-2026-00712 -- the dealer's own batch choice; omitted/undefined leaves it
   * on Auto (the warehouse decides at dispatch, largest lot first). */
  preferredBatchNo?: string | undefined;
}): Promise<Inquiry> {
  return authedCall("dms_erp.sales.dealer_portal_api.raise_inquiry", {
    method: "POST",
    params: {
      item: params.item,
      qty: params.qty,
      remarks: params.remarks,
      damaged_stock: params.damagedStock,
      entered_boxes: params.enteredBoxes,
      preferred_batch_no: params.preferredBatchNo,
    },
  });
}

/** 12 Nov 2026 rebuild (BRD D.3) -- several items enquired on in one go now land as rows
 * on ONE Inquiry (`requestGroup`/`enquiry` are both that one Inquiry's own id -- kept as
 * two keys since the response shape itself hasn't changed, only what the id now points
 * at), not several whole records glued together by a shared group string. `items` here
 * is this one Inquiry's own item rows, not a list of separate enquiries. Nothing is
 * created unless every line is valid. */
export function raiseInquiries(params: {
  items: {
    item: string;
    qty: number;
    damagedStock?: boolean | undefined;
    enteredBoxes?: number | undefined;
    preferredBatchNo?: string | undefined;
  }[];
  remarks?: string | undefined;
}): Promise<{
  requestGroup: string;
  enquiry: string;
  items: InquiryItemRow[];
}> {
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

/** Client request, 12 Nov 2026 -- a genuine rolling 24-hour check (not BRD C.2.4's
 * own 7-day one), used by the enquiry list's "Add" button to warn a dealer before
 * they add an item they already asked about recently. A hint only -- adding still
 * goes through either way, same as every other duplicate check in this app. */
export function checkRecentInquiry(params: {
  item: string;
  damagedStock?: boolean | undefined;
}): Promise<{ recent: boolean; inquiry: string | null }> {
  return authedCall("dms_erp.sales.dealer_portal_api.check_recent_inquiry", {
    method: "GET",
    params: { item: params.item, damaged_stock: params.damagedStock },
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
 * (2 Nov 2026) alongside acceptQuotation. 12 Nov 2026 rebuild (BRD D.3): one Sales
 * Order is built from EVERY real (non-Custom-Style) item on this Inquiry now, not just
 * a single item/qty -- a multi-item enquiry is one call, one combined order, same as
 * the single-item case; there's no more one-call-per-item looping needed. */
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
