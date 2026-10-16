import { authedCall } from "@/lib/auth";
import type { Enquiry, Inquiry, Paginated } from "@/api/types";

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

/** Several items enquired on in one go. Each becomes its own enquiry; they share one
 * `requestGroup` so Pacific can quote them together. Nothing is created unless every
 * line is valid. */
export function raiseInquiries(params: {
  items: { item: string; qty: number }[];
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
