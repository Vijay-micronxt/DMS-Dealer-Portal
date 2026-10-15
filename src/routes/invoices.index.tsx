import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { listMyInvoices } from "@/api/invoices";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PAGE_SIZE = 30;

export const Route = createFileRoute("/invoices/")({
  component: InvoicesPage,
});

/** The dealer's own Sales Invoices, newest first -- including the history migrated from
 * Tally, which can run to thousands, so it pages rather than loading everything. */
function InvoicesPage() {
  const [query, setQuery] = React.useState("");
  const debounced = useDebouncedValue(query, 300);

  const invoicesQuery = useInfiniteQuery({
    queryKey: ["my-invoices", debounced],
    queryFn: ({ pageParam }) =>
      listMyInvoices({
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
    () => invoicesQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [invoicesQuery.data],
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-zinc-900">My invoices</h1>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search invoice number, vehicle or LR number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {invoicesQuery.isLoading && <Spinner />}
        {invoicesQuery.isError && (
          <ErrorState
            message="Couldn't load invoices."
            onRetry={() => invoicesQuery.refetch()}
          />
        )}
        {invoicesQuery.isSuccess && items.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">
            {query ? "No invoice matches that search." : "No invoices yet."}
          </p>
        )}

        <div className="space-y-3">
          {items.map((inv) => (
            <Link key={inv.id} to="/invoices/$id" params={{ id: inv.id }}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {inv.id}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(inv.date)}
                      {inv.vehicleNo ? ` · ${inv.vehicleNo}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-zinc-900">
                      {formatCurrency(inv.grandTotal)}
                    </span>
                    {inv.type !== "Sales" && (
                      <Badge tone="info">{inv.type}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {invoicesQuery.hasNextPage && (
          <Button
            variant="outline"
            className="w-full"
            disabled={invoicesQuery.isFetchingNextPage}
            onClick={() => void invoicesQuery.fetchNextPage()}
          >
            {invoicesQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </AppShell>
  );
}
