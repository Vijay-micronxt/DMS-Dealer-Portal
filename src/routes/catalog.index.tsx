import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { formatBoxQty } from "@/lib/stock-format";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemThumbnail } from "@/components/ui/image-gallery";
import { Input } from "@/components/ui/input";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { cn, formatCurrency } from "@/lib/utils";
import { EnquiryListLink } from "@/components/EnquiryListLink";
import { exportMyCatalog, getCatalog, resolveCode } from "@/api/catalog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { ProductImage } from "@/api/types";

const PAGE_SIZE = 40;

export const Route = createFileRoute("/catalog/")({
  component: CatalogPage,
});

// ISS-2026-00644 + client request (Oct 2026): items outside the dealer's own catalogue
// are a separate section, not mixed into one list -- they can be enquired on, not ordered.
const SECTIONS = [
  { scope: "assigned", label: "Your catalogue" },
  { scope: "other", label: "Other items" },
] as const;

function CatalogPage() {
  const [scope, setScope] = React.useState<"assigned" | "other">("assigned");
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  async function downloadCatalogue() {
    setExportError(null);
    // Opened inside the click so pop-up blockers allow it; filled once the page arrives.
    const win = window.open("", "_blank");
    if (!win) {
      setExportError("Allow pop-ups for this site to open your catalogue.");
      return;
    }
    win.document.write(
      "<p style='font-family:sans-serif;padding:24px'>Preparing your catalogue…</p>",
    );
    setExporting(true);
    try {
      const html = await exportMyCatalog();
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    } catch (err) {
      win.close();
      setExportError(
        err instanceof Error ? err.message : "Couldn't prepare your catalogue.",
      );
    } finally {
      setExporting(false);
    }
  }
  const [query, setQuery] = React.useState("");
  const debounced = useDebouncedValue(query, 300);
  const navigate = Route.useNavigate();

  // Previously a single fixed-size page (limit: 40) with no way to see anything
  // past it -- an item sorted beyond the 40th (alphabetically by item code) in a
  // dealer's catalog was silently unreachable from Browse, even though it was
  // correctly granted visibility on the backend. Infinite-scroll pagination
  // (offset-driven, using the total/offset the backend already returns) fixes
  // that instead of just raising the cap, which would only move the cutoff.
  //
  // ISS-2026-00632 #4 originally gave this its own four colour/design attribute
  // dropdown filters alongside search; those were dropped in favour of this one
  // search box also matching those same four attributes server-side (see
  // dealer_portal_api.get_catalog/_catalog_search_matches) -- one box to type
  // "Rustic" into, instead of hunting through four dropdowns for it.
  const catalogQuery = useInfiniteQuery({
    queryKey: ["catalog", scope, debounced],
    queryFn: ({ pageParam }) =>
      getCatalog({
        scope,
        search: debounced || undefined,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const fetched = lastPage.offset + lastPage.items.length;
      return fetched < lastPage.total ? fetched : undefined;
    },
  });

  const items = React.useMemo(
    () => catalogQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [catalogQuery.data],
  );

  const codeQuery = useQuery({
    queryKey: ["resolve-code", debounced],
    queryFn: () => resolveCode(debounced),
    enabled:
      debounced.length > 0 && catalogQuery.isSuccess && items.length === 0,
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <EnquiryListLink />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            Save your catalogue as a PDF or share it on WhatsApp.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => void downloadCatalogue()}
          >
            <Download className="size-4" />
            {exporting ? "Preparing…" : "Download catalogue"}
          </Button>
        </div>
        {exportError && <p className="text-xs text-red-600">{exportError}</p>}

        <div className="flex gap-1 rounded-xl bg-zinc-200/70 p-1">
          {SECTIONS.map((s) => (
            <button
              key={s.scope}
              onClick={() => setScope(s.scope)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium",
                scope === s.scope
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {scope === "other" && (
          <p className="text-xs text-zinc-500">
            These items aren't set up for ordering on your account yet. Add them
            to an enquiry and Pacific will quote you.
          </p>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search item name or your code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {catalogQuery.isLoading && <Spinner />}
        {catalogQuery.isError && (
          <ErrorState
            message="Couldn't load the catalog."
            onRetry={() => catalogQuery.refetch()}
          />
        )}

        {catalogQuery.isSuccess && items.length === 0 && (
          <div className="pt-2">
            {codeQuery.data ? (
              <button
                className="w-full text-left"
                onClick={() =>
                  navigate({
                    to: "/catalog/$item",
                    params: { item: codeQuery.data!.code },
                  })
                }
              >
                <ItemCard item={codeQuery.data} />
              </button>
            ) : (
              <p className="py-10 text-center text-sm text-zinc-500">
                {query
                  ? "No items match that search or code."
                  : scope === "assigned"
                    ? "No items in your catalogue yet."
                    : "No other items to show."}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to="/catalog/$item"
              params={{ item: item.code }}
            >
              <ItemCard item={item} />
            </Link>
          ))}
        </div>

        {catalogQuery.hasNextPage && (
          <Button
            variant="outline"
            className="w-full"
            disabled={catalogQuery.isFetchingNextPage}
            onClick={() => void catalogQuery.fetchNextPage()}
          >
            {catalogQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </AppShell>
  );
}

function ItemCard({
  item,
}: {
  item: {
    code: string;
    name: string;
    series: string | null;
    size: string | null;
    finish: string | null;
    colourAttribute1?: string | null;
    colourAttribute2?: string | null;
    designAttribute1?: string | null;
    designAttribute2?: string | null;
    dealerCode: string | null;
    availableStockQty: number;
    piecesPerBox?: number | null;
    status: string;
    images: ProductImage[];
    orderable: boolean;
    price: number | null;
  };
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-3">
        <ItemThumbnail images={item.images} className="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">
            {item.name}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {item.code}
            {item.dealerCode ? ` · your code ${item.dealerCode}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {[item.series, item.size, item.finish]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
          {[
            item.colourAttribute1,
            item.colourAttribute2,
            item.designAttribute1,
            item.designAttribute2,
          ].filter(Boolean).length > 0 && (
            <p className="mt-0.5 text-xs text-zinc-400">
              {[
                item.colourAttribute1,
                item.colourAttribute2,
                item.designAttribute1,
                item.designAttribute2,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <p className="text-sm font-semibold text-zinc-900">
            {item.price !== null ? formatCurrency(item.price) : "Price on request"}
          </p>
          <Badge tone={item.availableStockQty > 0 ? "success" : "danger"}>
            {item.availableStockQty > 0
              ? `${formatBoxQty(item.availableStockQty, item.piecesPerBox)} in stock`
              : "Out of stock"}
          </Badge>
          {!item.orderable && (
            // ISS-2026-00644 -- this item isn't in your Dealer Catalog assignment yet;
            // it can still be enquired on (Item detail's Raise Enquiry), just not booked.
            <Badge tone="info">Inquire only</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
