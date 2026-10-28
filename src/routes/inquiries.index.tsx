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

// Client request, 28 Oct 2026 -- collapsed from 6 tabs (All/Open/Available/Out of
// Stock/Converted to Order/Rejected) down to 3. "Open" is now a catch-all bucket for
// every non-terminal status (Open, Available, Partially Available, Out of Stock,
// Pre-order Required, Quoted, Mixed, ...) -- not just the two named in the request --
// so an enquiry can never fall through and vanish from every tab as new statuses
// appear. The backend only matches one exact status per call, so this bucketing
// happens client-side: fetch unfiltered, then filter by tab here.
const FILTERS = ["Open", "Converted to Order", "Rejected"] as const;
const TERMINAL_STATUSES = new Set(["Converted to Order", "Rejected"]);

export const Route = createFileRoute("/inquiries/")({
  component: InquiriesPage,
});

function InquiriesPage() {
  const [tab, setTab] = React.useState<(typeof FILTERS)[number]>("Open");

  // One entry per enquiry the dealer made: items sent together from the enquiry list arrive as a
  // single enquiry holding all of them, not one card per item. Unfiltered here -- the tab is
  // applied client-side below (see FILTERS' own note on why).
  const query = useQuery({
    queryKey: ["my-inquiries"],
    queryFn: () => listMyEnquiries({ limit: 50 }),
  });

  const rows = React.useMemo(() => {
    const items = query.data?.items ?? [];
    if (tab === "Open") {
      return items.filter((e) => !TERMINAL_STATUSES.has(e.status));
    }
    return items.filter((e) => e.status === tab);
  }, [query.data, tab]);

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-zinc-900">My enquiries</h1>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setTab(f)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                tab === f
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
        {query.isSuccess && rows.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">
            No enquiries here yet.
          </p>
        )}

        <div className="space-y-3">
          {rows.map((enquiry) => {
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
