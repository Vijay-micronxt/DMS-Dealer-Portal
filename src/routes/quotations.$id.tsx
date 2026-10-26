import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ApiError } from "@/lib/erp-client";
import { acceptQuotation, getMyQuotation } from "@/api/quotations";

export const Route = createFileRoute("/quotations/$id")({
  component: QuotationDetailPage,
});

function QuotationDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => getMyQuotation(id),
  });

  const [po, setPo] = React.useState("");
  const [dispatchDate, setDispatchDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const acceptMutation = useMutation({
    mutationFn: () =>
      acceptQuotation({
        quotation: id,
        expected_dispatch: dispatchDate,
        customer_po: po.trim(),
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["quotation", id] });
      queryClient.invalidateQueries({ queryKey: ["my-quotations"] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
      void navigate({ to: "/orders/$id", params: { id: order.id } });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not accept this quotation.",
      ),
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
          message="Couldn't load this quotation."
          onRetry={() => query.refetch()}
        />
      </AppShell>
    );
  }

  const q = query.data;

  return (
    <AppShell>
      <div className="space-y-4">
        <Link
          to="/quotations"
          className="inline-flex items-center gap-1 text-sm text-zinc-500"
        >
          <ChevronLeft className="h-4 w-4" /> Back to quotations
        </Link>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-semibold text-zinc-900">
                  {q.number}
                </h1>
                <p className="text-sm text-zinc-500">{formatDate(q.date)}</p>
              </div>
              <Badge tone={toneForStatus(q.status)}>{q.status}</Badge>
            </div>
            {q.validTill && (
              <p className="text-sm text-zinc-600">
                Valid till <strong>{formatDate(q.validTill)}</strong>
              </p>
            )}
            {q.deliveryPincode && (
              <p className="text-sm text-zinc-600">
                Delivery pincode {q.deliveryPincode}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900">Items</h2>
            <div className="divide-y divide-zinc-100">
              {q.lines.map((l) => (
                <div key={l.itemCode} className="flex gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900">
                      {l.itemName || l.itemCode}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {l.itemCode} · {l.qty} boxes × {formatCurrency(l.rate)}
                      {l.discountPercentage > 0 &&
                        ` (${l.discountPercentage}% off ${formatCurrency(l.priceListRate)})`}
                    </p>
                    {l.deliveryDate && (
                      <p className="text-xs text-zinc-500">
                        Delivery {formatDate(l.deliveryDate)}
                      </p>
                    )}
                    {l.totalWeightKg != null && (
                      <p className="text-xs text-zinc-500">
                        Weight{" "}
                        {l.totalWeightKg.toLocaleString("en-IN", {
                          maximumFractionDigits: 1,
                        })}{" "}
                        kg
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-medium tabular-nums text-zinc-900">
                    {formatCurrency(l.amount)}
                  </p>
                </div>
              ))}
            </div>
            {q.lines.some((l) => l.totalWeightKg != null) && (
              <p className="text-xs text-zinc-500">
                Total weight{" "}
                {q.lines
                  .reduce((sum, l) => sum + (l.totalWeightKg ?? 0), 0)
                  .toLocaleString("en-IN", { maximumFractionDigits: 1 })}{" "}
                kg
              </p>
            )}

            <dl className="space-y-1.5 border-t border-zinc-200 pt-3 text-sm">
              <Row label="Items total" value={formatCurrency(q.netTotal)} />
              {q.taxes.map((t) => (
                <Row
                  key={t.description}
                  label={`${t.description} (${t.rate}%)`}
                  value={formatCurrency(t.amount)}
                />
              ))}
              {q.freight > 0 && (
                <Row label="Freight" value={formatCurrency(q.freight)} />
              )}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  {formatCurrency(q.totalPayable)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {q.canAccept ? (
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Accept this quotation to place your order
              </h2>
              <label className="block text-sm font-medium text-zinc-700">
                Your PO number
                <Input
                  value={po}
                  onChange={(e) => setPo(e.target.value)}
                  className="mt-1.5"
                  placeholder="PO-2026-001"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700">
                Expected dispatch date
                <Input
                  type="date"
                  value={dispatchDate}
                  onChange={(e) => setDispatchDate(e.target.value)}
                  className="mt-1.5"
                />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                variant="secondary"
                onClick={() => acceptMutation.mutate()}
                loading={acceptMutation.isPending}
                disabled={!po.trim() || !dispatchDate}
              >
                Accept &amp; place order
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <p className="text-sm text-zinc-700">
                {q.status === "Ordered"
                  ? "This quotation has been accepted and your order placed."
                  : q.status === "Expired"
                    ? "This quotation has expired. Please ask Pacific for a fresh one."
                    : `This quotation is ${q.status.toLowerCase()} and can't be accepted.`}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-zinc-600">
      <dt>{label}</dt>
      <dd className="tabular-nums text-zinc-900">{value}</dd>
    </div>
  );
}
