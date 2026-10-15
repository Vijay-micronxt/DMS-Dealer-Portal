import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { listMyQuotations } from "@/api/quotations";

export const Route = createFileRoute("/quotations/")({
  component: QuotationsPage,
});

/** What Pacific has quoted this dealer. The price appears here (and nowhere before it);
 * accepting a quotation is what places the order. */
function QuotationsPage() {
  const query = useQuery({
    queryKey: ["my-quotations"],
    queryFn: () => listMyQuotations({ limit: 50 }),
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-zinc-900">My quotations</h1>

        {query.isLoading && <Spinner />}
        {query.isError && (
          <ErrorState
            message="Couldn't load quotations."
            onRetry={() => query.refetch()}
          />
        )}
        {query.data && query.data.items.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">
            No quotations yet. Send an enquiry from the catalog and Pacific will
            quote you.
          </p>
        )}

        <div className="space-y-3">
          {query.data?.items.map((q) => (
            <Link key={q.id} to="/quotations/$id" params={{ id: q.id }}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {q.number}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(q.date)} · {q.lines.length} item
                      {q.lines.length === 1 ? "" : "s"} ·{" "}
                      {formatCurrency(q.totalPayable)}
                    </p>
                    {q.canAccept && q.validTill && (
                      <p className="text-xs text-amber-700">
                        Valid till {formatDate(q.validTill)}
                      </p>
                    )}
                  </div>
                  <Badge
                    tone={q.canAccept ? "warning" : toneForStatus(q.status)}
                  >
                    {q.canAccept ? "Awaiting your PO" : q.status}
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
