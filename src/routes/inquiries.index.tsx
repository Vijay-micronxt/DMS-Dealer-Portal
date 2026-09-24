import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { cn, formatDate } from "@/lib/utils";
import { listMyInquiries } from "@/api/inquiries";

const FILTERS = [
  "All",
  "Open",
  "Available",
  "Out of Stock",
  "Converted to Order",
  "Rejected",
] as const;

export const Route = createFileRoute("/inquiries/")({
  component: InquiriesPage,
});

function InquiriesPage() {
  const [status, setStatus] = React.useState<(typeof FILTERS)[number]>("All");

  const query = useQuery({
    queryKey: ["my-inquiries", status],
    queryFn: () =>
      listMyInquiries({
        status: status === "All" ? undefined : status,
        limit: 50,
      }),
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-zinc-900">My enquiries</h1>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                status === f
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-600",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {query.isLoading && <Spinner />}
        {query.isError && (
          <ErrorState
            message="Couldn't load enquiries."
            onRetry={() => query.refetch()}
          />
        )}
        {query.data && query.data.items.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">
            No enquiries here yet.
          </p>
        )}

        <div className="space-y-3">
          {query.data?.items.map((inquiry) => (
            <Link
              key={inquiry.id}
              to="/inquiries/$id"
              params={{ id: inquiry.id }}
            >
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {inquiry.productId}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {inquiry.qty} boxes · {formatDate(inquiry.date)}
                    </p>
                  </div>
                  <Badge tone={toneForStatus(inquiry.status)}>
                    {inquiry.status}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
