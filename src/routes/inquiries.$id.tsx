import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatDate } from "@/lib/utils";
import { itemLabel } from "@/lib/item-label";
import { getMyEnquiry, requestQuotation } from "@/api/inquiries";

const TERMINAL_STATUSES = new Set(["Converted to Order", "Rejected", "Closed"]);

export const Route = createFileRoute("/inquiries/$id")({
  component: EnquiryDetailPage,
});

/** One enquiry and everything in it: the items the dealer asked about together, each with its own
 * quantity and status, and the quotation(s) Pacific prepared. */
function EnquiryDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["inquiry", id],
    queryFn: () => getMyEnquiry(id),
  });

  const requestMutation = useMutation({
    mutationFn: () => requestQuotation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiry", id] });
    },
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
          message="Couldn't load this enquiry."
          onRetry={() => query.refetch()}
        />
      </AppShell>
    );
  }

  const enquiry = query.data;
  const waiting = enquiry.items.filter(
    (i) => !i.linkedQuotation && !TERMINAL_STATUSES.has(i.status),
  );
  // Items Pacific can't quote for ordering yet: outside the dealer's catalogue, or a custom style.
  const notOrderable = waiting.filter((i) => !i.orderable);

  return (
    <AppShell>
      <div className="space-y-4">
        <Link
          to="/inquiries"
          className="inline-flex items-center gap-1 text-sm text-zinc-500"
        >
          <ChevronLeft className="h-4 w-4" /> Back to enquiries
        </Link>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-semibold text-zinc-900">
                  {enquiry.number}
                </h1>
                <p className="text-sm text-zinc-500">
                  {enquiry.itemCount === 1
                    ? "1 item"
                    : `${enquiry.itemCount} items`}{" "}
                  · {formatDate(enquiry.date)}
                </p>
              </div>
              <Badge tone={toneForStatus(enquiry.status)}>
                {enquiry.status}
              </Badge>
            </div>
            {enquiry.remarks && (
              <div className="text-sm">
                <p className="text-zinc-400">Remarks</p>
                <p className="text-zinc-900">{enquiry.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-900">Items</h2>
            <div className="divide-y divide-zinc-100">
              {enquiry.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900">
                      {itemLabel(item)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {item.productId && item.productId !== itemLabel(item)
                        ? `${item.productId} · `
                        : ""}
                      {item.qty} boxes
                      {!item.productId ? " · Custom style" : ""}
                    </p>
                    {item.customerPo && (
                      <p className="text-xs text-zinc-500">
                        PO {item.customerPo}
                      </p>
                    )}
                  </div>
                  <Badge tone={toneForStatus(item.status)}>{item.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* An enquiry becomes an order only through a quotation the dealer accepts --
            there is no direct "convert to order" here. */}
        {enquiry.linkedQuotations.length > 0 && (
          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm text-zinc-700">
                Pacific has sent you a quotation for this enquiry.
              </p>
              {enquiry.linkedQuotations.map((q) => (
                <Link
                  key={q}
                  to="/quotations/$id"
                  params={{ id: q }}
                  className="block text-center text-sm font-medium text-zinc-900 underline"
                >
                  View quotation {q}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {waiting.length > 0 && (
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-700">
                {notOrderable.length === waiting.length
                  ? "These items aren't yet set up for ordering on your account — our team will follow up to get them added and quote you."
                  : notOrderable.length > 0
                    ? "Pacific will send you a quotation with the prices. Some items here aren't yet set up for ordering on your account — our team will follow up on those."
                    : "Pacific will send you a quotation with the prices. Accept it there to place the order."}
              </p>
              {/* Client request, 28 Oct 2026 -- before this, a dealer could only wait
                  silently here. Lets them actively nudge staff instead. */}
              {waiting.some((i) => i.dealerRequestedQuote) ||
              requestMutation.isSuccess ? (
                <p className="text-sm font-medium text-emerald-600">
                  Quotation requested — Pacific will follow up.
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => requestMutation.mutate()}
                  disabled={requestMutation.isPending}
                >
                  {requestMutation.isPending
                    ? "Requesting…"
                    : "Ask for quotation"}
                </Button>
              )}
              {requestMutation.isError && (
                <p className="text-sm text-rose-600">
                  Couldn't send your request — try again.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
