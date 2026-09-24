import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getMyOrder } from "@/api/orders";

export const Route = createFileRoute("/orders/$id")({
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { id } = Route.useParams();

  const query = useQuery({
    queryKey: ["order", id],
    queryFn: () => getMyOrder(id),
  });

  if (query.isLoading) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  if (query.isError || !query.data) {
    return (
      <AppShell>
        <ErrorState
          message="Couldn't load this order."
          onRetry={() => query.refetch()}
        />
      </AppShell>
    );
  }

  const order = query.data;

  return (
    <AppShell>
      <div className="space-y-4">
        <Link
          to="/orders"
          className="inline-flex items-center gap-1 text-sm text-zinc-500"
        >
          <ChevronLeft className="h-4 w-4" /> Back to orders
        </Link>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-semibold text-zinc-900">
                  {order.number}
                </h1>
                <p className="text-sm text-zinc-500">
                  {formatDate(order.date)}
                </p>
              </div>
              <Badge tone={toneForStatus(order.stage)}>{order.stage}</Badge>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              {order.customerPo && (
                <div>
                  <dt className="text-zinc-400">PO number</dt>
                  <dd className="text-zinc-900">{order.customerPo}</dd>
                </div>
              )}
              <div>
                <dt className="text-zinc-400">Expected dispatch</dt>
                <dd className="text-zinc-900">
                  {formatDate(order.expectedDispatch)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-400">Channel</dt>
                <dd className="text-zinc-900">{order.channel}</dd>
              </div>
              {order.vehicle && (
                <div>
                  <dt className="text-zinc-400">Vehicle</dt>
                  <dd className="text-zinc-900">{order.vehicle}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-900">Items</h2>
            <div className="divide-y divide-zinc-100">
              {order.lines.map((line, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div>
                    <p className="text-zinc-900">{line.itemCode}</p>
                    <p className="text-xs text-zinc-500">{line.qty} boxes</p>
                  </div>
                  <p className="font-medium text-zinc-900">
                    {formatCurrency(line.rate * line.qty)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-sm font-semibold">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              Delivery status
            </h2>
            <ol className="space-y-3">
              {order.history.map((event, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-zinc-900" />
                  <div>
                    <p className="font-medium text-zinc-900">{event.stage}</p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(event.at)}
                    </p>
                    {event.note && (
                      <p className="text-xs text-zinc-500">{event.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
