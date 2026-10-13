import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemThumbnail } from "@/components/ui/image-gallery";
import { Input } from "@/components/ui/input";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import {
  getCatalog,
  listCatalogColourAttribute1,
  listCatalogColourAttribute2,
  listCatalogDesignAttribute1,
  listCatalogDesignAttribute2,
  resolveCode,
} from "@/api/catalog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { ProductImage } from "@/api/types";

const PAGE_SIZE = 40;

export const Route = createFileRoute("/catalog/")({
  component: CatalogPage,
});

function CatalogPage() {
  const [query, setQuery] = React.useState("");
  const debounced = useDebouncedValue(query, 300);
  const navigate = Route.useNavigate();

  // ISS-2026-00632 #4 — filters over this dealer's own catalog, alongside search.
  // "" is the native <select>'s own empty option, meaning "no filter", not a real value.
  const [colourAttribute1, setColourAttribute1] = React.useState("");
  const [colourAttribute2, setColourAttribute2] = React.useState("");
  const [designAttribute1, setDesignAttribute1] = React.useState("");
  const [designAttribute2, setDesignAttribute2] = React.useState("");

  const colourAttribute1Options = useQuery({
    queryKey: ["catalog-filter-options", "colourAttribute1"],
    queryFn: listCatalogColourAttribute1,
  });
  const colourAttribute2Options = useQuery({
    queryKey: ["catalog-filter-options", "colourAttribute2"],
    queryFn: listCatalogColourAttribute2,
  });
  const designAttribute1Options = useQuery({
    queryKey: ["catalog-filter-options", "designAttribute1"],
    queryFn: listCatalogDesignAttribute1,
  });
  const designAttribute2Options = useQuery({
    queryKey: ["catalog-filter-options", "designAttribute2"],
    queryFn: listCatalogDesignAttribute2,
  });

  // Previously a single fixed-size page (limit: 40) with no way to see anything
  // past it -- an item sorted beyond the 40th (alphabetically by item code) in a
  // dealer's catalog was silently unreachable from Browse, even though it was
  // correctly granted visibility on the backend. Infinite-scroll pagination
  // (offset-driven, using the total/offset the backend already returns) fixes
  // that instead of just raising the cap, which would only move the cutoff.
  const catalogQuery = useInfiniteQuery({
    queryKey: [
      "catalog",
      debounced,
      colourAttribute1,
      colourAttribute2,
      designAttribute1,
      designAttribute2,
    ],
    queryFn: ({ pageParam }) =>
      getCatalog({
        search: debounced || undefined,
        colourAttribute1: colourAttribute1 || undefined,
        colourAttribute2: colourAttribute2 || undefined,
        designAttribute1: designAttribute1 || undefined,
        designAttribute2: designAttribute2 || undefined,
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
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search item name or your code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <AttributeFilterSelect
            label="Colour attribute 1"
            value={colourAttribute1}
            onChange={setColourAttribute1}
            options={colourAttribute1Options.data ?? []}
          />
          <AttributeFilterSelect
            label="Colour attribute 2"
            value={colourAttribute2}
            onChange={setColourAttribute2}
            options={colourAttribute2Options.data ?? []}
          />
          <AttributeFilterSelect
            label="Design attribute 1"
            value={designAttribute1}
            onChange={setDesignAttribute1}
            options={designAttribute1Options.data ?? []}
          />
          <AttributeFilterSelect
            label="Design attribute 2"
            value={designAttribute2}
            onChange={setDesignAttribute2}
            options={designAttribute2Options.data ?? []}
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
                  : "No items in your catalog yet."}
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

/** ISS-2026-00632 #4 — a plain native <select> (this app has no Select component yet),
 * styled to match Input. Disabled with no options rather than hidden, so the filter
 * row's layout stays stable whether or not this dealer's catalog has any items with
 * that attribute set yet. */
function AttributeFilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={options.length === 0}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50"
    >
      <option value="">{label}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
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
    price: number | null;
    stockQty: number;
    status: string;
    images: ProductImage[];
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
          <span className="text-sm font-semibold text-zinc-900">
            {formatCurrency(item.price)}
          </span>
          <Badge tone={item.stockQty > 0 ? "success" : "danger"}>
            {item.stockQty > 0 ? `${item.stockQty} in stock` : "Out of stock"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
