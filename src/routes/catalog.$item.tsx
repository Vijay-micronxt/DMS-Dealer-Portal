import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { getItem, suggestAlternatives } from "@/api/catalog";
import { raiseInquiry, convertToOrder } from "@/api/inquiries";
import { ApiError } from "@/lib/erp-client";
import type { Inquiry } from "@/api/types";

export const Route = createFileRoute("/catalog/$item")({
  component: ItemDetailPage,
});

function ItemDetailPage() {
  const { item: itemCode } = Route.useParams();
  const queryClient = useQueryClient();

  const itemQuery = useQuery({
    queryKey: ["item", itemCode],
    queryFn: () => getItem(itemCode),
  });

  const [qty, setQty] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [raisedInquiry, setRaisedInquiry] = React.useState<Inquiry | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  const raiseMutation = useMutation({
    mutationFn: () =>
      raiseInquiry({
        item: itemCode,
        qty: Number(qty),
        remarks: remarks || undefined,
      }),
    onSuccess: (inquiry) => {
      setRaisedInquiry(inquiry);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : "Could not raise the enquiry.",
      ),
  });

  const alternativesQuery = useQuery({
    queryKey: ["alternatives", itemCode],
    queryFn: () => suggestAlternatives(itemCode),
    enabled:
      !!raisedInquiry && !!itemQuery.data && itemQuery.data.stockQty <= 0,
  });

  if (itemQuery.isLoading) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  if (itemQuery.isError || !itemQuery.data) {
    return (
      <AppShell>
        <ErrorState
          message="Couldn't load this item."
          onRetry={() => itemQuery.refetch()}
        />
      </AppShell>
    );
  }

  const item = itemQuery.data;
  const inStock = item.stockQty > 0 && item.isSellable;

  return (
    <AppShell>
      <div className="space-y-4">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1 text-sm text-zinc-500"
        >
          <ChevronLeft className="h-4 w-4" /> Back to catalog
        </Link>

        <Card>
          <CardContent className="space-y-3">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">
                {item.name}
              </h1>
              <p className="text-sm text-zinc-500">
                {item.code}
                {item.dealerCode ? ` · your code ${item.dealerCode}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge tone={inStock ? "success" : "danger"}>
                {inStock ? `${item.stockQty} boxes in stock` : "Out of stock"}
              </Badge>
              {item.series && <Badge tone="info">{item.series}</Badge>}
              {!item.isSellable && <Badge tone="neutral">{item.status}</Badge>}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-400">Size / Finish</dt>
                <dd className="text-zinc-900">
                  {[item.size, item.finish].filter(Boolean).join(" / ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-400">Price / box</dt>
                <dd className="font-medium text-zinc-900">
                  {formatCurrency(item.price)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-400">Pieces / box</dt>
                <dd className="text-zinc-900">{item.piecesPerBox ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Weight / box</dt>
                <dd className="text-zinc-900">
                  {item.weightPerBoxKg ? `${item.weightPerBoxKg} kg` : "—"}
                </dd>
              </div>
            </dl>

            {item.topBatches.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-400">
                  Available batches
                </p>
                <div className="space-y-1">
                  {item.topBatches.map((b) => (
                    <div
                      key={b.batchNumber}
                      className="flex justify-between rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs"
                    >
                      <span className="text-zinc-600">{b.batchNumber}</span>
                      <span className="font-medium text-zinc-900">
                        {b.boxes} boxes
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!raisedInquiry && (
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                {inStock
                  ? "Raise an enquiry for this item"
                  : "Raise an out-of-stock enquiry"}
              </h2>
              <label className="block text-sm font-medium text-zinc-700">
                Quantity (boxes)
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="mt-1.5"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700">
                Remarks (optional)
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="mt-1.5"
                />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                onClick={() => raiseMutation.mutate()}
                loading={raiseMutation.isPending}
                disabled={!qty || Number(qty) <= 0}
              >
                Raise enquiry
              </Button>
            </CardContent>
          </Card>
        )}

        {raisedInquiry && inStock && <ConvertPanel inquiry={raisedInquiry} />}

        {raisedInquiry && !inStock && (
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-700">
                Your enquiry <strong>{raisedInquiry.number}</strong> has been
                logged. We'll notify you once it's back in stock.
              </p>
              {alternativesQuery.data && alternativesQuery.data.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-400">
                    You might also like
                  </p>
                  <div className="space-y-2">
                    {alternativesQuery.data.map((alt) => (
                      <Link
                        key={alt.id}
                        to="/catalog/$item"
                        params={{ item: alt.code }}
                      >
                        <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                          <span className="text-zinc-800">{alt.name}</span>
                          <Badge tone={alt.stockQty > 0 ? "success" : "danger"}>
                            {alt.stockQty > 0 ? "In stock" : "Out of stock"}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <Link
                to="/inquiries"
                className="block text-center text-sm font-medium text-zinc-900 underline"
              >
                View my enquiries
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function ConvertPanel({ inquiry }: { inquiry: Inquiry }) {
  const [po, setPo] = React.useState("");
  const [dispatchDate, setDispatchDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const convertMutation = useMutation({
    mutationFn: () =>
      convertToOrder({
        inquiry: inquiry.id,
        expected_dispatch: dispatchDate,
        customer_po: po.trim(),
      }),
    onSuccess: () => setDone(true),
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not convert to an order.",
      ),
  });

  if (done) {
    return (
      <Card>
        <CardContent className="space-y-2 text-center">
          <p className="text-sm font-medium text-zinc-900">
            Order placed successfully.
          </p>
          <Link
            to="/orders"
            className="text-sm font-medium text-zinc-900 underline"
          >
            View my orders
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          In stock — enter your PO number to place the order
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
          onClick={() => convertMutation.mutate()}
          loading={convertMutation.isPending}
          disabled={!po.trim() || !dispatchDate}
        >
          Convert to order
        </Button>
      </CardContent>
    </Card>
  );
}
