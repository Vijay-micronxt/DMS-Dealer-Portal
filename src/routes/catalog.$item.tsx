import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { formatArea, formatBoxQty } from "@/lib/stock-format";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageGallery, ItemThumbnail } from "@/components/ui/image-gallery";
import { Input } from "@/components/ui/input";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { EnquiryListLink } from "@/components/EnquiryListLink";
import { addToEnquiryList } from "@/lib/enquiry-list";
import { getExcludedStock, getItem, suggestAlternatives } from "@/api/catalog";
import { raiseInquiry } from "@/api/inquiries";
import { ApiError } from "@/lib/erp-client";
import { formatCurrency } from "@/lib/utils";
import type { Inquiry } from "@/api/types";

export const Route = createFileRoute("/catalog/$item")({
  component: ItemDetailPage,
});

const EXCLUDED_BAY_LABELS: Record<string, string> = {
  damage: "Damaged stock, condition as-is",
  insurance_claim: "Insurance claim stock, condition as-is",
  display: "Display/sample",
};

/** ISS-2026-00678 -- only damaged/insurance-claim bay stock can be added to an order
 * (as a special-case, same rate as regular stock for now). Display/sample stock has
 * its own separate workflow (Sample & Display Management) and is never ordered this
 * way, so it's shown but gets no "Add to order" control. */
const ORDERABLE_EXCLUDED_BAY_TYPES = new Set(["damage", "insurance_claim"]);

function ItemDetailPage() {
  const { item: itemCode } = Route.useParams();
  const queryClient = useQueryClient();

  const itemQuery = useQuery({
    queryKey: ["item", itemCode],
    queryFn: () => getItem(itemCode),
  });

  const [qty, setQty] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [raisedInquiry, setRaisedInquiry] = React.useState<Inquiry | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState(false);
  // ISS-2026-00678 -- one qty/added state per excluded-stock row (damage vs
  // insurance_claim can both exist for the same item), keyed by bayType.
  const [damagedQty, setDamagedQty] = React.useState<Record<string, string>>({});
  const [damagedAdded, setDamagedAdded] = React.useState<Record<string, boolean>>({});

  const excludedStockQuery = useQuery({
    queryKey: ["excluded-stock", itemCode],
    queryFn: () => getExcludedStock(itemCode),
  });

  const raiseMutation = useMutation({
    mutationFn: () =>
      raiseInquiry({
        item: itemCode,
        qty: Number(qty),
        remarks: remarks || undefined,
      }),
    onSuccess: (inquiry) => {
      setRaisedInquiry(inquiry);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : "Could not raise the enquiry.",
      ),
  });

  const alternativesQuery = useQuery({
    queryKey: ["alternatives", itemCode],
    queryFn: () => suggestAlternatives(itemCode),
    // As soon as the item is out of stock -- not only after an enquiry -- so the dealer is shown
    // something they can order instead (Pacific's own pick first) while they're looking at it.
    enabled: !!itemQuery.data && itemQuery.data.availableStockQty <= 0,
  });

  if (itemQuery.isLoading) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  if (itemQuery.isError || !itemQuery.data) {
    return (
      <AppShell>
        <ErrorState
          message="Couldn't load this item."
          onRetry={() => itemQuery.refetch()}
        />
      </AppShell>
    );
  }

  const item = itemQuery.data;
  const inStock = item.availableStockQty > 0 && item.isSellable;

  return (
    <AppShell>
      <div className="space-y-4">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1 text-sm text-zinc-500"
        >
          <ChevronLeft className="h-4 w-4" /> Back to catalog
        </Link>

        <EnquiryListLink />

        <ImageGallery images={item.images} />

        <Card>
          <CardContent className="space-y-3">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">
                {item.name}
              </h1>
              <p className="text-sm text-zinc-500">
                {item.code}
                {item.dealerCode ? ` · your code ${item.dealerCode}` : ""}
              </p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">
                {item.price !== null ? (
                  <>
                    {formatCurrency(item.price)}
                    <span className="text-sm font-normal text-zinc-500"> / Box</span>
                  </>
                ) : (
                  "Price on request"
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={inStock ? "success" : "danger"}>
                {inStock
                  ? `${formatBoxQty(item.availableStockQty, item.piecesPerBox)} in stock`
                  : "Out of stock"}
              </Badge>
              {item.series && <Badge tone="info">{item.series}</Badge>}
              {!item.isSellable && <Badge tone="neutral">{item.status}</Badge>}
              {!item.orderable && <Badge tone="info">Inquire only</Badge>}
            </div>

            {/* Client refinement, 27 Oct 2026 — this used to sit behind a "View more"
                click (ISS-2026-00678). Dealers wouldn't necessarily know to look for it,
                so now it shows automatically whenever the item actually has damaged/
                display-bay stock, and stays silent otherwise rather than announcing
                "no damaged stock" on every item. */}
            {excludedStockQuery.data && excludedStockQuery.data.length > 0 && (
              <div className="rounded-lg bg-zinc-50 px-2.5 py-2 text-xs text-zinc-600">
                <p className="mb-1 font-medium text-zinc-500">
                  Also available, not counted above:
                </p>
                <div className="space-y-2">
                  {excludedStockQuery.data.map((row) => {
                    const orderable = ORDERABLE_EXCLUDED_BAY_TYPES.has(row.bayType);
                    const rowQty = damagedQty[row.bayType] ?? "";
                    return (
                      <div key={row.bayType} className="space-y-1">
                        <div className="flex justify-between">
                          <span>{EXCLUDED_BAY_LABELS[row.bayType] ?? row.bayType}</span>
                          <span className="font-medium text-zinc-900">
                            {formatBoxQty(row.boxes, item.piecesPerBox)}
                          </span>
                        </div>
                        {orderable && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={row.boxes}
                              inputMode="numeric"
                              placeholder="Boxes"
                              value={rowQty}
                              onChange={(e) =>
                                setDamagedQty((prev) => ({
                                  ...prev,
                                  [row.bayType]: e.target.value,
                                }))
                              }
                              className="h-8 w-20 text-xs"
                            />
                            <Button
                              variant="outline"
                              className="h-8 px-2.5 text-xs"
                              disabled={!rowQty || Number(rowQty) <= 0}
                              onClick={() => {
                                addToEnquiryList({
                                  code: item.code,
                                  name: item.name,
                                  qty: Number(rowQty),
                                  damagedStock: true,
                                });
                                setDamagedQty((prev) => ({ ...prev, [row.bayType]: "" }));
                                setDamagedAdded((prev) => ({ ...prev, [row.bayType]: true }));
                              }}
                            >
                              Add to order
                            </Button>
                            {damagedAdded[row.bayType] && (
                              <span className="text-emerald-700">Added</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-400">Size / Finish</dt>
                <dd className="text-zinc-900">
                  {[item.size, item.finish].filter(Boolean).join(" / ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-400">Pieces / box</dt>
                <dd className="text-zinc-900">{item.piecesPerBox || "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Coverage / box</dt>
                <dd className="text-zinc-900">{formatArea(item.sqftPerBox)}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Weight / box</dt>
                <dd className="text-zinc-900">
                  {item.weightPerBoxKg ? `${item.weightPerBoxKg} kg` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-400">Category</dt>
                <dd className="text-zinc-900">{item.category || "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Colour</dt>
                <dd className="text-zinc-900">{item.color || "—"}</dd>
              </div>
              {/* The four colour/design descriptors (ISS-2026-00632): only the ones this item has. */}
              {(
                [
                  ["Colour attribute 1", item.colourAttribute1],
                  ["Colour attribute 2", item.colourAttribute2],
                  ["Design attribute 1", item.designAttribute1],
                  ["Design attribute 2", item.designAttribute2],
                ] as const
              )
                .filter(([, value]) => !!value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-zinc-400">{label}</dt>
                    <dd className="text-zinc-900">{value}</dd>
                  </div>
                ))}
            </dl>

            {item.topBatches.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-400">
                  Available batches
                </p>
                <div className="space-y-1">
                  {item.topBatches.map((b) => (
                    <div
                      key={b.batchNumber}
                      className="flex justify-between rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs"
                    >
                      <span className="text-zinc-600">{b.batchNumber}</span>
                      <span className="font-medium text-zinc-900">
                        {formatBoxQty(b.boxes, item.piecesPerBox)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!raisedInquiry && (
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                {inStock
                  ? "Enquire about this item"
                  : "Raise an out-of-stock enquiry"}
              </h2>
              <p className="text-xs text-zinc-500">
                Pacific will send you a quotation with the price. Add several
                items to your enquiry list to ask about them together.
              </p>
              <label className="block text-sm font-medium text-zinc-700">
                Quantity (boxes)
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="mt-1.5"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700">
                Remarks (optional)
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="mt-1.5"
                />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {added && (
                <p className="text-sm text-emerald-700">
                  Added to your enquiry list.
                </p>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  addToEnquiryList({
                    code: item.code,
                    name: item.name,
                    qty: Number(qty),
                  });
                  setQty("");
                  setAdded(true);
                }}
                disabled={!qty || Number(qty) <= 0}
              >
                Add to enquiry list
              </Button>
              <Button
                onClick={() => raiseMutation.mutate()}
                loading={raiseMutation.isPending}
                disabled={!qty || Number(qty) <= 0}
              >
                Send this enquiry now
              </Button>
            </CardContent>
          </Card>
        )}

        {!inStock &&
          alternativesQuery.data &&
          alternativesQuery.data.length > 0 && (
            <Card>
              <CardContent className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Out of stock — you might also like
                </h2>
                <div className="space-y-2">
                  {alternativesQuery.data.map((alt) => (
                    <Link
                      key={alt.id}
                      to="/catalog/$item"
                      params={{ item: alt.code }}
                    >
                      <div className="flex items-center gap-2.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                        <ItemThumbnail
                          images={alt.images}
                          className="h-9 w-9"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-zinc-800">
                            {alt.name}
                          </span>
                          {alt.isRecommended && (
                            <span className="text-xs font-medium text-emerald-700">
                              Recommended by Pacific
                            </span>
                          )}
                        </span>
                        <Badge tone={alt.availableStockQty > 0 ? "success" : "danger"}>
                          {alt.availableStockQty > 0 ? "In stock" : "Out of stock"}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        {raisedInquiry && inStock && (
          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm text-zinc-700">
                Your enquiry <strong>{raisedInquiry.number}</strong> has been
                logged.{" "}
                {item.orderable
                  ? "Pacific will send you a quotation — you can accept it there to place the order."
                  : "This item isn't yet set up for ordering on your account — our team will follow up to get it added and quote you."}
              </p>
              <Link
                to="/inquiries"
                className="block text-center text-sm font-medium text-zinc-900 underline"
              >
                View my enquiries
              </Link>
            </CardContent>
          </Card>
        )}

        {raisedInquiry && !inStock && (
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-700">
                Your enquiry <strong>{raisedInquiry.number}</strong> has been
                logged. We'll notify you once it's back in stock.
              </p>
              <Link
                to="/inquiries"
                className="block text-center text-sm font-medium text-zinc-900 underline"
              >
                View my enquiries
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
