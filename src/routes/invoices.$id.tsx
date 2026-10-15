import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getMyInvoice } from "@/api/invoices";

export const Route = createFileRoute("/invoices/$id")({
  component: InvoiceDetailPage,
});

const TRANSPORT_LABELS: Record<string, string> = {
  transporter: "Transporter",
  vehicleNo: "Vehicle",
  lrNo: "LR number",
  lrDate: "LR date",
  ewayBillNo: "E-way bill",
};

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => getMyInvoice(id),
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
          message="Couldn't load this invoice."
          onRetry={() => query.refetch()}
        />
      </AppShell>
    );
  }

  const inv = query.data;
  const transport = Object.entries(TRANSPORT_LABELS).filter(
    ([key]) => !!inv.transport[key],
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1 text-sm text-zinc-500"
        >
          <ChevronLeft className="h-4 w-4" /> Back to invoices
        </Link>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-semibold text-zinc-900">
                  {inv.id}
                </h1>
                <p className="text-sm text-zinc-500">{formatDate(inv.date)}</p>
              </div>
              {inv.type !== "Sales" && <Badge tone="info">{inv.type}</Badge>}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {inv.dueDate && (
                <div>
                  <dt className="text-zinc-400">Due date</dt>
                  <dd className="text-zinc-900">{formatDate(inv.dueDate)}</dd>
                </div>
              )}
              {inv.poNumber && (
                <div>
                  <dt className="text-zinc-400">Your PO number</dt>
                  <dd className="text-zinc-900">{inv.poNumber}</dd>
                </div>
              )}
              {transport.map(([key, label]) => (
                <div key={key}>
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className="text-zinc-900">{inv.transport[key]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900">Items</h2>
            <div className="divide-y divide-zinc-100">
              {inv.items.map((row, i) => (
                <div
                  key={`${row.itemCode}-${i}`}
                  className="flex gap-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900">
                      {row.itemName || row.itemCode}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {row.qty} {row.uom ?? ""} × {formatCurrency(row.rate)}
                      {row.batchNo ? ` · Batch ${row.batchNo}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium tabular-nums text-zinc-900">
                    {formatCurrency(row.amount)}
                  </p>
                </div>
              ))}
            </div>
            <dl className="space-y-1.5 border-t border-zinc-200 pt-3 text-sm">
              <div className="flex justify-between text-zinc-600">
                <dt>Subtotal</dt>
                <dd className="tabular-nums text-zinc-900">
                  {formatCurrency(inv.netTotal)}
                </dd>
              </div>
              {inv.taxes.map((t, i) => (
                <div
                  key={`${t.description}-${i}`}
                  className="flex justify-between text-zinc-600"
                >
                  <dt>
                    {t.description}
                    {t.rate ? ` (${t.rate}%)` : ""}
                  </dt>
                  <dd className="tabular-nums text-zinc-900">
                    {formatCurrency(t.amount)}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  {formatCurrency(inv.grandTotal)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {inv.receipts.length > 0 && (
          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-900">
                Payments received
              </h2>
              {inv.receipts.map((r) => (
                <div key={r.id} className="flex justify-between text-sm">
                  <span className="text-zinc-600">
                    {formatDate(r.date)}
                    {r.mode ? ` · ${r.mode}` : ""}
                  </span>
                  <span className="tabular-nums text-zinc-900">
                    {formatCurrency(r.amount)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
