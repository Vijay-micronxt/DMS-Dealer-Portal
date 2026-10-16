import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { cn, formatDate } from "@/lib/utils";
import { listMyEnquiries } from "@/api/inquiries";
import { itemLabel } from "@/lib/item-label";

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

  // One entry per enquiry the dealer made: items sent together from the enquiry list arrive as a
  // single enquiry holding all of them, not one card per item.
  const query = useQuery({
    queryKey: ["my-inquiries", status],
    queryFn: () =>
      listMyEnquiries({
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
          {query.data?.items.map((enquiry) => {
            const shown = enquiry.items.slice(0, 2).map(itemLabel);
            const more = enquiry.itemCount - shown.length;
            return (
              <Link
                key={enquiry.id}
                to="/inquiries/$id"
                params={{ id: enquiry.id }}
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {enquiry.itemCount === 1
                          ? shown[0]
                          : `${enquiry.itemCount} items`}
                      </p>
                      {enquiry.itemCount > 1 && (
                        <p className="truncate text-xs text-zinc-500">
                          {shown.join(", ")}
                          {more > 0 ? ` +${more} more` : ""}
                        </p>
                      )}
                      <p className="text-xs text-zinc-500">
                        {enquiry.number} · {formatDate(enquiry.date)}
                        {enquiry.itemCount === 1
                          ? ` · ${enquiry.items[0]?.qty} boxes`
                          : ""}
                      </p>
                    </div>
                    <Badge tone={toneForStatus(enquiry.status)}>
                      {enquiry.status}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
