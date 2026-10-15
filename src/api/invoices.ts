import { authedCall } from "@/lib/auth";
import type { Invoice, InvoiceDetail, Paginated } from "@/api/types";

/** This dealer's own Sales Invoices (and credit notes), including the history migrated from
 * Tally. `search` matches the invoice number, voucher number, vehicle or LR number. */
export function listMyInvoices(params: {
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}): Promise<Paginated<Invoice>> {
  return authedCall("dms_erp.sales.dealer_portal_api.list_my_invoices", {
    method: "GET",
    params,
  });
}

export function getMyInvoice(invoice: string): Promise<InvoiceDetail> {
  return authedCall("dms_erp.sales.dealer_portal_api.get_my_invoice", {
    method: "GET",
    params: { invoice },
  });
}
