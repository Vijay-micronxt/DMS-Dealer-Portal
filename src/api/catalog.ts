import { authedCall } from "@/lib/auth";
import type { CatalogItem, Paginated } from "@/api/types";

export function getCatalog(params: {
  search?: string | undefined;
  category?: string | undefined;
  color?: string | undefined;
  colourAttribute1?: string | undefined;
  colourAttribute2?: string | undefined;
  designAttribute1?: string | undefined;
  designAttribute2?: string | undefined;
  /** "assigned" = your own catalogue (orderable); "other" = every other sellable item
   * (enquire only). Left out, both. */
  scope?: "assigned" | "other" | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}): Promise<Paginated<CatalogItem>> {
  const {
    colourAttribute1,
    colourAttribute2,
    designAttribute1,
    designAttribute2,
    ...rest
  } = params;
  return authedCall("dms_erp.sales.dealer_portal_api.get_catalog", {
    method: "GET",
    params: {
      ...rest,
      colour_attribute_1: colourAttribute1,
      colour_attribute_2: colourAttribute2,
      design_attribute_1: designAttribute1,
      design_attribute_2: designAttribute2,
    },
  });
}

// ISS-2026-00632 #4 — distinct values already present in this dealer's own catalog, for
// Browse's filter dropdowns (dealer_portal_api.list_catalog_*, scoped per-dealer so an
// option never produces an empty result when picked).
export function listCatalogColors(): Promise<string[]> {
  return authedCall("dms_erp.sales.dealer_portal_api.list_catalog_colors", {
    method: "GET",
  });
}

export function listCatalogColourAttribute1(): Promise<string[]> {
  return authedCall(
    "dms_erp.sales.dealer_portal_api.list_catalog_colour_attribute_1",
    {
      method: "GET",
    },
  );
}

export function listCatalogColourAttribute2(): Promise<string[]> {
  return authedCall(
    "dms_erp.sales.dealer_portal_api.list_catalog_colour_attribute_2",
    {
      method: "GET",
    },
  );
}

export function listCatalogDesignAttribute1(): Promise<string[]> {
  return authedCall(
    "dms_erp.sales.dealer_portal_api.list_catalog_design_attribute_1",
    {
      method: "GET",
    },
  );
}

export function listCatalogDesignAttribute2(): Promise<string[]> {
  return authedCall(
    "dms_erp.sales.dealer_portal_api.list_catalog_design_attribute_2",
    {
      method: "GET",
    },
  );
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
