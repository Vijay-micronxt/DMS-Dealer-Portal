import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { listMyOrders } from "@/api/orders";

// Client refinement, 27 Oct 2026 — collapsed from the full stage list (which needed
// horizontal scrolling to see) down to 2 tabs. "Open" isn't a real Sales Order stage;
// it groups Confirmed/Picking/Ready to Dispatch/Dispatched together — a just-placed
// order is Open from the start, no separate "Pending" tab for it. No "All" tab either.
//
// Delivered is deliberately in neither tab — a client-confirmed gap, not an
// oversight: a Delivered order has no tab of its own and relies on its eventual Sales
// Invoice as the dealer's record instead, even though invoicing is a separate, manual
// staff action that may not have happened yet (see dealer_portal_api.OPEN_ORDER_STAGES'
// own comment for the full reasoning).
const TABS = ["Open", "Cancelled"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/orders/")({
  component: OrdersPage,
});

function OrdersPage() {
  const [tab, setTab] = React.useState<Tab>("Open");

  const query = useQuery({
    queryKey: ["my-orders", tab],
    queryFn: () =>
      listMyOrders({
        stage: tab === "Cancelled" ? "Cancelled" : undefined,
        stageGroup: tab === "Open" ? "open" : undefined,
        limit: 50,
      }),
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-zinc-900">My orders</h1>

        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                tab === t
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-600",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {query.isLoading && <Spinner />}
        {query.isError && (
          <ErrorState
            message="Couldn't load orders."
            onRetry={() => query.refetch()}
          />
        )}
        {query.data && query.data.items.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">
            No orders here yet.
          </p>
        )}

        <div className="space-y-3">
          {query.data?.items.map((order) => (
            <Link key={order.id} to="/orders/$id" params={{ id: order.id }}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {order.number}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(order.date)} · {formatCurrency(order.total)}
                    </p>
                  </div>
                  <Badge tone={toneForStatus(order.stage)}>{order.stage}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
