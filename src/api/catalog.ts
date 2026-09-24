import { authedCall } from "@/lib/auth";
import type { CatalogItem, Paginated } from "@/api/types";

export function getCatalog(params: {
  search?: string | undefined;
  category?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}): Promise<Paginated<CatalogItem>> {
  return authedCall("dms_erp.sales.dealer_portal_api.get_catalog", {
    method: "GET",
    params,
  });
}

/** Search by either the dealer's own mapped code or the company item code (BRD C.13.1) --
 * null when the code doesn't resolve into this dealer's catalog. */
export function resolveCode(code: string): Promise<CatalogItem | null> {
  return authedCall("dms_erp.sales.dealer_portal_api.resolve_code", {
    method: "GET",
    params: { code },
  });
}

export function getItem(item: string): Promise<CatalogItem> {
  return authedCall("dms_erp.sales.dealer_portal_api.get_item", {
    method: "GET",
    params: { item },
  });
}

export function suggestAlternatives(
  item: string,
  limit = 5,
): Promise<CatalogItem[]> {
  return authedCall("dms_erp.sales.dealer_portal_api.suggest_alternatives", {
    method: "GET",
    params: { item, limit },
  });
}
