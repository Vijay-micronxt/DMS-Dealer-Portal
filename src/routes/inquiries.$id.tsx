import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { ClickableThumbnail } from "@/components/ui/image-gallery";
import { formatDate } from "@/lib/utils";
import { ApiError } from "@/lib/erp-client";
import { itemLabel } from "@/lib/item-label";
import {
  convertToOrder,
  getMyEnquiry,
  requestQuotation,
} from "@/api/inquiries";

const TERMINAL_STATUSES = new Set(["Converted to Order", "Rejected", "Closed"]);

export const Route = createFileRoute("/inquiries/$id")({
  component: EnquiryDetailPage,
});

/** One enquiry and everything in it: the items the dealer asked about together, each with its own
 * quantity and stock availability, and the quotation Pacific prepared. */
function EnquiryDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();

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

  // BRD C.13.1, re-enabled 2 Nov 2026; 12 Nov 2026 rebuild (BRD D.3) -- same "Create
  // order" path already offered from the item page and the enquiry cart; this is the
  // third/last place an enquiry's own items are shown before a quotation exists.
  // convert_to_order now builds ONE combined Sales Order from every real item on this
  // Inquiry, so this whole enquiry becomes a single call, not one order per item.
  const [orderPo, setOrderPo] = React.useState("");
  const [orderDispatchDate, setOrderDispatchDate] = React.useState("");
  const [orderError, setOrderError] = React.useState<string | null>(null);
  const createOrderMutation = useMutation({
    mutationFn: () =>
      convertToOrder({
        inquiry: id,
        expectedDispatch: orderDispatchDate,
        customerPo: orderPo.trim(),
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["inquiry", id] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      void navigate({ to: "/orders/$id", params: { id: order.id } });
    },
    onError: (err) =>
      setOrderError(
        err instanceof ApiError ? err.message : "Could not create the order.",
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
          message="Couldn't load this enquiry."
          onRetry={() => query.refetch()}
        />
      </AppShell>
    );
  }

  const enquiry = query.data;
  // 12 Nov 2026 rebuild (BRD D.3) -- linkedQuotation and workflow status are whole-
  // Inquiry fields now, not per item, so "waiting on a quotation" is a whole-enquiry
  // state; `waiting` stays an items array (not just a boolean) only so the rest of
  // this page -- the order/quotation panel below -- doesn't need reshaping.
  const isWaiting =
    !enquiry.linkedQuotation && !TERMINAL_STATUSES.has(enquiry.status);
  const waiting = isWaiting ? enquiry.items : [];
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
            {/* 12 Nov 2026 rebuild: customerPo is a whole-Inquiry field now, not
                per item -- shown once here instead of repeated on every row below. */}
            {enquiry.customerPo && (
              <p className="text-xs text-zinc-500">PO {enquiry.customerPo}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-900">Items</h2>
            <div className="divide-y divide-zinc-100">
              {enquiry.items.map((item) => (
                <div
                  key={item.lineId}
                  className="flex items-start justify-between gap-3 py-2 text-sm"
                >
                  <ClickableThumbnail
                    images={item.images ?? []}
                    className="h-11 w-11"
                    alt={itemLabel(item)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {/* Client request, 12 Nov 2026 -- tapping the name goes to the item's
                          own detail page, same as its thumbnail already opens the image
                          dialog. Only when there's a real catalog item behind this line --
                          a Custom Style request (no productId) has no detail page to go to. */}
                      {item.productId ? (
                        <Link
                          to="/catalog/$item"
                          params={{ item: item.productId }}
                          className="truncate font-medium text-zinc-900 underline-offset-2 hover:underline"
                        >
                          {itemLabel(item)}
                        </Link>
                      ) : (
                        <p className="truncate font-medium text-zinc-900">
                          {itemLabel(item)}
                        </p>
                      )}
                      {/* Client report, 2 Nov 2026 -- a damaged-stock line and a regular
                          line for the same item (ISS-2026-00678) looked identical here,
                          unlike the enquiry cart's own list, which already flags it. */}
                      {item.damagedStock && (
                        <Badge tone="warning" className="shrink-0">
                          Damaged
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {item.productId && item.productId !== itemLabel(item)
                        ? `${item.productId} · `
                        : ""}
                      {item.qty} boxes
                      {!item.productId ? " · Custom style" : ""}
                      {item.enteredUom && item.enteredQty != null && (
                        <>
                          {" "}
                          · entered as{" "}
                          {item.enteredBoxes != null
                            ? `${item.enteredBoxes} Box ${item.enteredQty} Pcs`
                            : `${item.enteredQty} ${item.enteredUom}`}
                        </>
                      )}
                      {/* ISS-2026-00712, client report 5 Nov 2026 -- the dealer's
                          batch choice wasn't shown anywhere once the enquiry was
                          sent, only on the cart before Send. */}
                      {item.preferredBatchNo && (
                        <> · Batch {item.preferredBatchNo}</>
                      )}
                    </p>
                  </div>
                  {/* 12 Nov 2026 rebuild: workflow status (shown once, at the top of
                      this enquiry) and per-item stock availability are separate now --
                      this badge is this row's own availabilityStatus. */}
                  <Badge tone={toneForStatus(item.availabilityStatus)}>
                    {item.availabilityStatus}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {enquiry.linkedQuotation && (
          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm text-zinc-700">
                Pacific has sent you a quotation for this enquiry.
              </p>
              <Link
                to="/quotations/$id"
                params={{ id: enquiry.linkedQuotation }}
                className="block text-center text-sm font-medium text-zinc-900 underline"
              >
                View quotation {enquiry.linkedQuotation}
              </Link>
            </CardContent>
          </Card>
        )}

        {waiting.length > 0 && (
          <Card>
            <CardContent className="space-y-3">
              {(() => {
                const allOrderable = notOrderable.length === 0;
                const quotationAsked =
                  enquiry.dealerRequestedQuote || requestMutation.isSuccess;
                return (
                  <>
                    <p className="text-sm text-zinc-700">
                      {notOrderable.length === waiting.length
                        ? "These items aren't yet set up for ordering on your account — our team will follow up to get them added and quote you."
                        : notOrderable.length > 0
                          ? "Pacific will send you a quotation with the prices. Some items here aren't yet set up for ordering on your account — our team will follow up on those."
                          : createOrderMutation.isSuccess
                            ? "Pacific will send you a quotation with the prices. Accept it there to place the order."
                            : quotationAsked
                              ? "Pacific will send you a quotation with the prices. Accept it there to place the order."
                              : "Create an order now, or ask Pacific for a quotation first."}
                    </p>

                    {createOrderMutation.isSuccess ? (
                      <p className="text-sm font-medium text-emerald-600">
                        Order created.
                      </p>
                    ) : (
                      // BRD C.13.1, re-enabled 2 Nov 2026 -- hidden once a quotation's
                      // been asked for (Pacific is then the one pricing this), same
                      // mirrored guard the item page and cart already use.
                      allOrderable &&
                      !quotationAsked && (
                        <div className="space-y-2 rounded-lg bg-zinc-50 p-3">
                          <label className="block text-xs font-medium text-zinc-700">
                            Your PO number
                            <Input
                              value={orderPo}
                              onChange={(e) => setOrderPo(e.target.value)}
                              className="mt-1 h-9 text-sm"
                              placeholder="PO-2026-001"
                            />
                          </label>
                          <label className="block text-xs font-medium text-zinc-700">
                            Expected dispatch date
                            <Input
                              type="date"
                              value={orderDispatchDate}
                              onChange={(e) =>
                                setOrderDispatchDate(e.target.value)
                              }
                              className="mt-1 h-9 text-sm"
                            />
                          </label>
                          {orderError && (
                            <p className="text-sm text-red-600">{orderError}</p>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => createOrderMutation.mutate()}
                            loading={createOrderMutation.isPending}
                            disabled={!orderPo.trim() || !orderDispatchDate}
                          >
                            Create order
                          </Button>
                        </div>
                      )
                    )}

                    {/* Client request, 28 Oct 2026 -- before this, a dealer could only wait
                        silently here. Lets them actively nudge staff instead. */}
                    {quotationAsked ? (
                      <p className="text-sm font-medium text-emerald-600">
                        Quotation requested — Pacific will follow up.
                      </p>
                    ) : (
                      !createOrderMutation.isSuccess && (
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
                      )
                    )}
                    {requestMutation.isError && (
                      <p className="text-sm text-rose-600">
                        Couldn't send your request — try again.
                      </p>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
