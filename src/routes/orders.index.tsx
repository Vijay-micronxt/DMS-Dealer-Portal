import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { listMyOrders } from "@/api/orders";

const STAGES = [
  "All",
  "Confirmed",
  "Picking",
  "Ready to Dispatch",
  "Dispatched",
  "Delivered",
  "Cancelled",
] as const;

export const Route = createFileRoute("/orders/")({
  component: OrdersPage,
});

function OrdersPage() {
  const [stage, setStage] = React.useState<(typeof STAGES)[number]>("All");

  const query = useQuery({
    queryKey: ["my-orders", stage],
    queryFn: () =>
      listMyOrders({ stage: stage === "All" ? undefined : stage, limit: 50 }),
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-zinc-900">My orders</h1>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                stage === s
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-600",
              )}
            >
              {s}
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
