import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/erp-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getCatalog, resolveCode } from "@/api/catalog";
import {
  addToEnquiryList,
  clearEnquiryList,
  removeFromEnquiryList,
  setEnquiryQty,
  useEnquiryList,
} from "@/lib/enquiry-list";
import { raiseInquiries } from "@/api/inquiries";

export const Route = createFileRoute("/enquiry")({
  component: EnquiryListPage,
});

/** The items collected while browsing, sent to Pacific as one enquiry. Pacific replies with
 * a quotation (Quotes tab); accepting that is what places the order. */
function EnquiryListPage() {
  const lines = useEnquiryList();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  const sendMutation = useMutation({
    mutationFn: () =>
      raiseInquiries({
        items: lines.map((l) => ({
          item: l.code,
          qty: l.qty,
          damagedStock: l.damagedStock,
        })),
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: () => {
      clearEnquiryList();
      queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
      void navigate({ to: "/inquiries" });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : "Could not send the enquiry.",
      ),
  });

  const invalid = lines.some((l) => !(l.qty > 0));

  return (
    <AppShell>
      <div className="space-y-4">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1 text-sm text-zinc-500"
        >
          <ChevronLeft className="h-4 w-4" /> Back to catalog
        </Link>
        <h1 className="text-lg font-semibold text-zinc-900">Enquiry list</h1>

        {lines.length === 0 ? (
          <>
            <p className="pt-6 text-center text-sm text-zinc-500">
              Your enquiry list is empty. Add the items you want to ask about.
            </p>
            <AddItem adding={adding} setAdding={setAdding} />
          </>
        ) : (
          <>
            <div className="space-y-3">
              {lines.map((line) => (
                <Card key={`${line.code}-${line.damagedStock ? "damaged" : "regular"}`}>
                  <CardContent className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {line.name}
                        </p>
                        {line.damagedStock && (
                          <Badge tone="warning" className="shrink-0">
                            Damaged
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{line.code}</p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
                      Boxes
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={line.qty || ""}
                        onChange={(e) =>
                          setEnquiryQty(
                            line.code,
                            Number(e.target.value) || 0,
                            line.damagedStock,
                          )
                        }
                        className="h-9 w-20"
                      />
                    </label>
                    <button
                      aria-label={`Remove ${line.name}`}
                      onClick={() =>
                        removeFromEnquiryList(line.code, line.damagedStock)
                      }
                      className="shrink-0 p-1 text-zinc-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <AddItem adding={adding} setAdding={setAdding} />

            <label className="block text-sm font-medium text-zinc-700">
              Remarks (optional)
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="mt-1.5"
                placeholder="Site, delivery town, timing…"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              onClick={() => sendMutation.mutate()}
              loading={sendMutation.isPending}
              disabled={invalid}
            >
              Send enquiry ({lines.length} item{lines.length === 1 ? "" : "s"})
            </Button>
            <p className="text-center text-xs text-zinc-500">
              Pacific will reply with a quotation showing the price.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

/** "Add item": a search box that finds items by name or code and adds them to the enquiry list in
 * one tap, so the dealer doesn't have to go back to the catalogue for each one. Quantities are
 * edited in the list above, where they can also be changed after adding. */
function AddItem({
  adding,
  setAdding,
}: {
  adding: boolean;
  setAdding: (v: boolean) => void;
}) {
  const lines = useEnquiryList();
  const [query, setQuery] = React.useState("");
  const debounced = useDebouncedValue(query.trim(), 300);
  const enabled = debounced.length >= 2;

  const results = useQuery({
    queryKey: ["enquiry-add-search", debounced],
    queryFn: () => getCatalog({ search: debounced, limit: 8 }),
    enabled: adding && enabled,
  });
  // An exact item code (the dealer's own or the company's) isn't part of the name search.
  const byCode = useQuery({
    queryKey: ["enquiry-add-code", debounced],
    queryFn: () => resolveCode(debounced),
    enabled:
      adding && enabled && results.isSuccess && results.data.items.length === 0,
  });

  const found =
    results.data && results.data.items.length > 0
      ? results.data.items
      : byCode.data
        ? [byCode.data]
        : [];
  const inList = new Set(lines.map((l) => l.code));

  if (!adding) {
    return (
      <Button variant="outline" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4" /> Add item
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Add an item</h2>
          <button
            onClick={() => {
              setAdding(false);
              setQuery("");
            }}
            className="text-sm font-medium text-zinc-500"
          >
            Done
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            autoFocus
            placeholder="Search item name or code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {!enabled && (
          <p className="text-xs text-zinc-500">
            Type at least 2 letters of the name or code.
          </p>
        )}
        {enabled && (results.isLoading || byCode.isLoading) && (
          <p className="text-xs text-zinc-500">Searching…</p>
        )}
        {enabled &&
          results.isSuccess &&
          found.length === 0 &&
          !byCode.isLoading && (
            <p className="text-xs text-zinc-500">
              No item matches “{debounced}”.
            </p>
          )}
        <div className="divide-y divide-zinc-100">
          {found.map((item) => {
            const added = inList.has(item.code);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {item.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {item.code}
                    {[item.size, item.finish].filter(Boolean).length > 0
                      ? ` · ${[item.size, item.finish].filter(Boolean).join(" / ")}`
                      : ""}
                  </p>
                </div>
                <Button
                  variant={added ? "ghost" : "outline"}
                  size="sm"
                  className="w-auto shrink-0"
                  disabled={added}
                  onClick={() =>
                    addToEnquiryList({
                      code: item.code,
                      name: item.name,
                      qty: 1,
                    })
                  }
                >
                  {added ? "In list" : "Add"}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
