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
import { formatDate } from "@/lib/utils";
import { getMyInquiry, convertToOrder } from "@/api/inquiries";
import { ApiError } from "@/lib/erp-client";

const TERMINAL_STATUSES = new Set(["Converted to Order", "Rejected", "Closed"]);

export const Route = createFileRoute("/inquiries/$id")({
  component: InquiryDetailPage,
});

function InquiryDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["inquiry", id],
    queryFn: () => getMyInquiry(id),
  });

  const [po, setPo] = React.useState("");
  const [dispatchDate, setDispatchDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const convertMutation = useMutation({
    mutationFn: () =>
      convertToOrder({
        inquiry: id,
        expected_dispatch: dispatchDate,
        customer_po: po.trim(),
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["inquiry", id] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      navigate({ to: "/orders/$id", params: { id: order.id } });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not convert to an order.",
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

  const inquiry = query.data;
  const canConvert = !TERMINAL_STATUSES.has(inquiry.status);

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
                <p className="text-sm text-zinc-500">{inquiry.productId}</p>
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

        {canConvert && (
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Convert to order
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
        )}
      </div>
    </AppShell>
  );
}
