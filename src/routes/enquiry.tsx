import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClickableThumbnail } from "@/components/ui/image-gallery";
import { BoxesPiecesFields } from "@/components/ui/boxes-pieces-fields";
import { ApiError } from "@/lib/erp-client";
import { formatCurrency } from "@/lib/utils";
import { formatBoxQty } from "@/lib/stock-format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getCatalog, resolveCode } from "@/api/catalog";
import {
  addToEnquiryList,
  clearEnquiryList,
  removeFromEnquiryList,
  setEnquiryPieces,
  setEnquiryQty,
  useEnquiryList,
} from "@/lib/enquiry-list";
import {
  checkRecentInquiry,
  convertToOrder,
  raiseInquiries,
  requestQuotation,
} from "@/api/inquiries";
import type { CatalogItem } from "@/api/types";
import type { InquiryItemRow } from "@/api/types";

export const Route = createFileRoute("/enquiry")({
  component: EnquiryListPage,
});

/** The items collected while browsing, sent to Pacific as one enquiry. Pacific replies with
 * a quotation (Quotes tab); accepting that is what places the order. */
function EnquiryListPage() {
  const lines = useEnquiryList();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const [remarks, setRemarks] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [sentGroup, setSentGroup] = React.useState<string | null>(null);
  const [sentItems, setSentItems] = React.useState<InquiryItemRow[]>([]);

  const sendMutation = useMutation({
    mutationFn: () =>
      raiseInquiries({
        items: lines.map((l) => ({
          item: l.code,
          qty: l.pieces ?? 0,
          damagedStock: l.damagedStock,
          enteredBoxes: l.qty,
          preferredBatchNo: l.preferredBatchNo,
        })),
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: (result) => {
      clearEnquiryList();
      queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
      // Stay on this page and show the "Ask for quotation"/"Create order" options
      // right here, same as the single-item flow on the item page -- not a redirect away.
      setSentGroup(result.requestGroup);
      setSentItems(result.items);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : "Could not send the enquiry.",
      ),
  });

  // Client request, 28 Oct 2026 -- flags the just-sent enquiry as dealer-requested
  // right where the dealer already is, instead of making them open it afterward.
  const askForQuotationMutation = useMutation({
    mutationFn: () => requestQuotation(sentGroup!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
    },
  });

  // BRD C.13.1, re-enabled 2 Nov 2026; 12 Nov 2026 rebuild (BRD D.3) -- convert_to_order
  // now builds ONE combined Sales Order from every real item on this Inquiry, so a
  // multi-item enquiry is a single call here too, not one order per item.
  const [orderPo, setOrderPo] = React.useState("");
  const [orderDispatchDate, setOrderDispatchDate] = React.useState("");
  const [orderError, setOrderError] = React.useState<string | null>(null);
  const allOrderable =
    sentItems.length > 0 && sentItems.every((i) => i.orderable);
  const createOrderMutation = useMutation({
    mutationFn: () =>
      convertToOrder({
        inquiry: sentGroup!,
        expectedDispatch: orderDispatchDate,
        customerPo: orderPo.trim(),
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      void navigate({ to: "/orders/$id", params: { id: order.id } });
    },
    onError: (err) =>
      setOrderError(
        err instanceof ApiError ? err.message : "Could not create the order.",
      ),
  });

  // ISS-2026-00712, client report 5 Nov 2026 -- a line tied to a batch can be
  // edited past what that batch actually has right here on the list page; this
  // catches it before Send instead of letting a failed round-trip be the first
  // warning (the item page's own picker already prevents it going in, but a
  // line can still be bumped up after the fact).
  const overBatchLine = lines.find(
    (l) => l.batchMaxBoxes !== undefined && l.qty > l.batchMaxBoxes,
  );
  const invalid = lines.some((l) => !(l.qty > 0)) || !!overBatchLine;

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

        {sentGroup ? (
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-700">
                Your enquiry <strong>{sentGroup}</strong> has been logged.
                {!createOrderMutation.isSuccess && (
                  <>
                    {" "}
                    {!allOrderable || askForQuotationMutation.isSuccess
                      ? "Pacific will send you a quotation — you can accept it there to place the order."
                      : "Create an order now, or ask Pacific for a quotation first."}
                  </>
                )}
              </p>

              {createOrderMutation.isSuccess ? (
                <p className="text-sm font-medium text-emerald-600">
                  Order created.
                </p>
              ) : (
                // Client request, 2 Nov 2026 -- once a quotation's been asked for, Pacific is
                // now the one pricing this enquiry; self-service "Create order" no longer
                // applies, so it's hidden instead of staying alongside the quotation request.
                allOrderable &&
                !askForQuotationMutation.isSuccess && (
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
                        onChange={(e) => setOrderDispatchDate(e.target.value)}
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

              {askForQuotationMutation.isSuccess ? (
                <p className="text-sm font-medium text-emerald-600">
                  Quotation requested — Pacific will follow up.
                </p>
              ) : (
                // Client request, 2 Nov 2026 (mirrors the Create order guard above) -- once
                // an order's been created directly, there's nothing left to quote.
                !createOrderMutation.isSuccess && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => askForQuotationMutation.mutate()}
                    disabled={askForQuotationMutation.isPending}
                  >
                    {askForQuotationMutation.isPending
                      ? "Requesting…"
                      : "Ask for quotation"}
                  </Button>
                )
              )}
              <Link
                to="/inquiries"
                className="block text-center text-sm font-medium text-zinc-900 underline"
              >
                View my enquiries
              </Link>
            </CardContent>
          </Card>
        ) : lines.length === 0 ? (
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
                <Card
                  key={`${line.code}-${line.damagedStock ? "damaged" : "regular"}-${line.preferredBatchNo ?? "auto"}`}
                >
                  <CardContent className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <ClickableThumbnail
                        images={line.images ?? []}
                        className="h-12 w-12"
                        alt={line.name}
                      />
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
                        <p className="text-xs text-zinc-500">
                          {line.code}
                          {/* ISS-2026-00712 -- shown so a dealer who picked a specific
                            batch on the item page can see it stuck, before sending. */}
                          {line.preferredBatchNo && (
                            <> · Batch {line.preferredBatchNo}</>
                          )}
                        </p>
                      </div>
                      <BoxesPiecesFields
                        boxes={line.qty ? String(line.qty) : ""}
                        pieces={line.pieces ? String(line.pieces) : ""}
                        onBoxesChange={(v) =>
                          setEnquiryQty(
                            line.code,
                            Number(v) || 0,
                            line.damagedStock,
                            line.preferredBatchNo,
                          )
                        }
                        onPiecesChange={(v) =>
                          setEnquiryPieces(
                            line.code,
                            Number(v) || 0,
                            line.damagedStock,
                            line.preferredBatchNo,
                          )
                        }
                        piecesPerBox={line.piecesPerBox}
                        className="w-auto shrink-0"
                        inputClassName="h-9 w-20 text-sm"
                      />
                      <button
                        aria-label={`Remove ${line.name}`}
                        onClick={() =>
                          removeFromEnquiryList(
                            line.code,
                            line.damagedStock,
                            line.preferredBatchNo,
                          )
                        }
                        className="shrink-0 p-1 text-zinc-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {/* ISS-2026-00712, client report 5 Nov 2026 -- a batch-tied line
                      edited past that batch's own on-hand qty right here, caught
                      before Send rather than only on a failed round-trip. */}
                    {line.batchMaxBoxes !== undefined &&
                      line.qty > line.batchMaxBoxes && (
                        <p className="text-xs text-red-600">
                          {line.preferredBatchNo} only has {line.batchMaxBoxes}{" "}
                          boxes — lower the qty or remove this line.
                        </p>
                      )}
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

  // Client request, 12 Nov 2026 -- warns before adding an item the dealer already
  // asked about in the last 24 hours (checkRecentInquiry), rather than finding out
  // only after staff notice the same item enquired twice. A hint, not a block --
  // confirming still adds it, same as every other duplicate check in this app.
  const addMutation = useMutation({
    mutationFn: async (item: CatalogItem) => {
      const { recent } = await checkRecentInquiry({ item: item.code });
      if (
        recent &&
        !window.confirm(
          `You already asked about ${item.name} in the last 24 hours. Add it again anyway?`,
        )
      ) {
        return;
      }
      addToEnquiryList({
        code: item.code,
        name: item.name,
        qty: 1,
        images: item.images,
        piecesPerBox: item.piecesPerBox,
      });
    },
  });

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
                  {/* Client request, 28 Oct 2026: a dealer using this quick-add won't go back
                      to the catalog page to check price/stock first -- show both right here. */}
                  <p className="truncate text-xs">
                    <span className="font-medium text-zinc-900">
                      {item.price !== null
                        ? `${formatCurrency(item.price)} / Box`
                        : "Price on request"}
                    </span>
                    <span className="text-zinc-400"> · </span>
                    <span
                      className={
                        item.availableStockQty > 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }
                    >
                      {item.availableStockQty > 0
                        ? `${formatBoxQty(item.availableStockQty, item.piecesPerBox)} in stock`
                        : "Out of stock"}
                    </span>
                  </p>
                </div>
                <Button
                  variant={added ? "ghost" : "outline"}
                  size="sm"
                  className="w-auto shrink-0"
                  disabled={added || addMutation.isPending}
                  loading={
                    addMutation.isPending &&
                    addMutation.variables?.code === item.code
                  }
                  onClick={() => addMutation.mutate(item)}
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
