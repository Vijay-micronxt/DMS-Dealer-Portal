import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatDate } from "@/lib/utils";
import { getMyInquiry } from "@/api/inquiries";

const TERMINAL_STATUSES = new Set(["Converted to Order", "Rejected", "Closed"]);

export const Route = createFileRoute("/inquiries/$id")({
  component: InquiryDetailPage,
});

function InquiryDetailPage() {
  const { id } = Route.useParams();

  const query = useQuery({
    queryKey: ["inquiry", id],
    queryFn: () => getMyInquiry(id),
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

  const inquiry = query.data;
  const isOpen = !TERMINAL_STATUSES.has(inquiry.status);

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
                  {inquiry.number}
                </h1>
                <p className="text-sm text-zinc-500">
                  {inquiry.productId ??
                    `Custom style: ${inquiry.requestedStyle ?? "—"}`}
                </p>
              </div>
              <Badge tone={toneForStatus(inquiry.status)}>
                {inquiry.status}
              </Badge>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-400">Quantity</dt>
                <dd className="text-zinc-900">{inquiry.qty} boxes</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Raised on</dt>
                <dd className="text-zinc-900">{formatDate(inquiry.date)}</dd>
              </div>
              {inquiry.requestGroup && (
                <div className="col-span-2">
                  <dt className="text-zinc-400">Sent together with</dt>
                  <dd className="text-zinc-900">
                    Enquiry group {inquiry.requestGroup}
                  </dd>
                </div>
              )}
              {inquiry.customerPo && (
                <div>
                  <dt className="text-zinc-400">PO number</dt>
                  <dd className="text-zinc-900">{inquiry.customerPo}</dd>
                </div>
              )}
              {inquiry.remarks && (
                <div className="col-span-2">
                  <dt className="text-zinc-400">Remarks</dt>
                  <dd className="text-zinc-900">{inquiry.remarks}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* An enquiry becomes an order only through a quotation the dealer accepts --
            there is no direct "convert to order" here any more. */}
        {inquiry.linkedQuotation ? (
          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm text-zinc-700">
                Pacific has sent you a quotation for this enquiry.
              </p>
              <Link
                to="/quotations/$id"
                params={{ id: inquiry.linkedQuotation }}
                className="block text-center text-sm font-medium text-zinc-900 underline"
              >
                View quotation {inquiry.linkedQuotation}
              </Link>
            </CardContent>
          </Card>
        ) : (
          isOpen && (
            <Card>
              <CardContent>
                <p className="text-sm text-zinc-700">
                  {inquiry.productId && !inquiry.orderable
                    ? "This item isn't yet set up for ordering on your account — our team will follow up to get it added and quote you."
                    : inquiry.productId
                      ? "Pacific will send you a quotation with the price. Accept it there to place the order."
                      : "This is a custom style request — our team will follow up with you on it."}
                </p>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </AppShell>
  );
}
