import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { getCatalog, resolveCode } from "@/api/catalog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export const Route = createFileRoute("/catalog/")({
  component: CatalogPage,
});

function CatalogPage() {
  const [query, setQuery] = React.useState("");
  const debounced = useDebouncedValue(query, 300);
  const navigate = Route.useNavigate();

  const catalogQuery = useQuery({
    queryKey: ["catalog", debounced],
    queryFn: () => getCatalog({ search: debounced || undefined, limit: 40 }),
  });

  const codeQuery = useQuery({
    queryKey: ["resolve-code", debounced],
    queryFn: () => resolveCode(debounced),
    enabled:
      debounced.length > 0 && (catalogQuery.data?.items.length ?? 0) === 0,
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

        {catalogQuery.isLoading && <Spinner />}
        {catalogQuery.isError && (
          <ErrorState
            message="Couldn't load the catalog."
            onRetry={() => catalogQuery.refetch()}
          />
        )}

        {catalogQuery.data && catalogQuery.data.items.length === 0 && (
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
          {catalogQuery.data?.items.map((item) => (
            <Link
              key={item.id}
              to="/catalog/$item"
              params={{ item: item.code }}
            >
              <ItemCard item={item} />
            </Link>
          ))}
        </div>
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
    dealerCode: string | null;
    price: number | null;
    stockQty: number;
    status: string;
  };
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0">
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
