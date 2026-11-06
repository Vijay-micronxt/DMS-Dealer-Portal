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
import {
  BoxesPiecesFields,
  readBoxesAndPieces,
} from "@/components/ui/boxes-pieces-fields";
import { Input } from "@/components/ui/input";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { EnquiryListLink } from "@/components/EnquiryListLink";
import { addToEnquiryList } from "@/lib/enquiry-list";
import { getExcludedStock, getItem, suggestAlternatives } from "@/api/catalog";
import {
  convertToOrder,
  raiseInquiry,
  requestQuotation,
} from "@/api/inquiries";
import { ApiError } from "@/lib/erp-client";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
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
  const navigate = Route.useNavigate();

  const itemQuery = useQuery({
    queryKey: ["item", itemCode],
    queryFn: () => getItem(itemCode),
  });

  const [qtyBoxes, setQtyBoxes] = React.useState("");
  const [qtyPieces, setQtyPieces] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  // ISS-2026-00712, client refinement 4 Nov 2026 -- a dealer can split the
  // entered qty across more than one batch, not just pick a single one. Empty
  // map means Auto (left to the warehouse at dispatch time, largest on-hand
  // batch first); keyed by batch number, value is that batch's share as typed.
  const [batchAlloc, setBatchAlloc] = React.useState<Record<string, string>>(
    {},
  );
  const [raisedInquiry, setRaisedInquiry] = React.useState<Inquiry | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState(false);
  // ISS-2026-00678 -- one qty/added state per excluded-stock row (damage vs
  // insurance_claim can both exist for the same item), keyed by bayType.
  const [damagedQty, setDamagedQty] = React.useState<Record<string, string>>(
    {},
  );
  const [damagedPieces, setDamagedPieces] = React.useState<
    Record<string, string>
  >({});
  const [damagedAdded, setDamagedAdded] = React.useState<
    Record<string, boolean>
  >({});

  const excludedStockQuery = useQuery({
    queryKey: ["excluded-stock", itemCode],
    queryFn: () => getExcludedStock(itemCode),
  });

  const raiseMutation = useMutation({
    mutationFn: () => {
      const combined = readBoxesAndPieces(
        qtyBoxes,
        qtyPieces,
        itemQuery.data?.piecesPerBox,
      );
      if (!combined) throw new Error("Enter a quantity.");
      // Sending one enquiry directly only ever carries one batch (or none, for
      // Auto) -- a split across several batches goes through "Add to enquiry
      // list" instead (each batch becomes its own line), see canSendDirectly.
      // Only a positive-qty pick counts; a batch tapped but still sitting at 0
      // isn't really "the batch" the dealer meant to use.
      const [singleBatch] = Object.entries(batchAlloc)
        .filter(([, v]) => (Number(v) || 0) > 0)
        .map(([bn]) => bn);
      return raiseInquiry({
        item: itemCode,
        qty: combined.pieces,
        remarks: remarks || undefined,
        enteredBoxes: combined.boxes,
        preferredBatchNo: singleBatch || undefined,
      });
    },
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

  // Client request, 28 Oct 2026 -- shown only after the enquiry's actually been sent
  // (raisedInquiry exists). Flags it as dealer-requested right where the dealer already
  // is, instead of making them navigate to the enquiry afterward just to click this.
  const askForQuotationMutation = useMutation({
    mutationFn: () => requestQuotation(raisedInquiry!.number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
    },
  });

  // BRD C.13.1 -- "if in stock, the dealer can convert the enquiry to an order,"
  // offered again (2 Nov 2026) right alongside Ask for quotation.
  const [orderPo, setOrderPo] = React.useState("");
  const [orderDispatchDate, setOrderDispatchDate] = React.useState("");
  const [orderError, setOrderError] = React.useState<string | null>(null);
  const createOrderMutation = useMutation({
    mutationFn: () =>
      convertToOrder({
        inquiry: raisedInquiry!.id,
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
  const enteredCombined = readBoxesAndPieces(
    qtyBoxes,
    qtyPieces,
    item.piecesPerBox,
  );
  const enteredBoxes = enteredCombined?.boxes ?? 0;

  // ISS-2026-00712, client refinement 4 Nov 2026 -- the batch picker only
  // appears once a qty is entered, and lets a dealer split it across more than
  // one batch until it adds up. A batch stays "picked" (key present in
  // batchAlloc) even while its own qty is 0 -- e.g. the moment it's tapped
  // with no room left -- so tapping never silently fails; allocatedTotal/
  // submittableEntries are what actually drive validation and submission.
  const pickedBatches = Object.keys(batchAlloc);
  const allocatedTotal = Object.values(batchAlloc).reduce(
    (sum, v) => sum + (Number(v) || 0),
    0,
  );
  const hasAllocations = pickedBatches.length > 0;
  // Every input clamps itself to what's actually still available (see
  // setBatchQty/toggleBatchPick below), so going over is never possible --
  // "complete" just means the picks add up to the full qty, nothing left over.
  const allocationComplete = !hasAllocations || allocatedTotal === enteredBoxes;
  const submittableEntries = Object.entries(batchAlloc).filter(
    ([, v]) => (Number(v) || 0) > 0,
  );
  // Sending one enquiry directly (raiseInquiry) only ever carries a single
  // preferredBatchNo; a real split needs one line per batch, which only "Add
  // to enquiry list" can build -- see raiseMutation/the Add button below.
  const canSendDirectly = submittableEntries.length <= 1;
  // Client report, 4 Nov 2026 -- a Pcs remainder has no batch of its own to
  // belong to (it's a top-up of less than one box), so when it used to ride
  // on the first split line, that line's own batch needed the Pcs-rounded-up
  // extra box too -- failing a batch that genuinely had enough for the plain
  // Boxes qty, just not boxes+pieces together. Rather than guess which batch
  // should absorb it, a Pcs remainder is only allowed with Auto or a single
  // picked batch; blocked outright once a dealer has actually split across
  // more than one.
  const pieceBatchConflict =
    (enteredCombined?.pieces ?? 0) > 0 && submittableEntries.length > 1;

  // How much of `batchNumber`'s own qty can still grow, given what every
  // *other* picked batch already uses -- shared by both the initial tap-fill
  // and manual edits, so neither can ever push the total past enteredBoxes.
  function roomFor(batchNumber: string, batchBoxes: number, alloc: Record<string, string>) {
    const usedByOthers = Object.entries(alloc)
      .filter(([bn]) => bn !== batchNumber)
      .reduce((s, [, v]) => s + (Number(v) || 0), 0);
    return Math.min(batchBoxes, Math.max(enteredBoxes - usedByOthers, 0));
  }

  function toggleBatchPick(batch: { batchNumber: string; boxes: number }) {
    setBatchAlloc((prev) => {
      if (prev[batch.batchNumber] !== undefined) {
        const next = { ...prev };
        delete next[batch.batchNumber];
        return next;
      }
      // Tapping a batch once everything else is already fully allocated picks
      // it with 0, not the full batch -- it stays selected and editable, the
      // dealer just needs to free up room elsewhere first (lower another
      // picked batch's own qty) before this one can actually take any.
      const fill = roomFor(batch.batchNumber, batch.boxes, prev);
      return { ...prev, [batch.batchNumber]: String(fill) };
    });
  }

  function setBatchQty(batchNumber: string, raw: string, batchBoxes: number) {
    setBatchAlloc((prev) => {
      const cap = roomFor(batchNumber, batchBoxes, prev);
      const n = raw === "" ? 0 : Math.max(0, Math.min(Number(raw) || 0, cap));
      return { ...prev, [batchNumber]: String(n) };
    });
  }

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
                    <span className="text-sm font-normal text-zinc-500">
                      {" "}
                      / Box
                    </span>
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
            {/* BRD C.3.2 -- "Transit Warehouse": not real stock, just visibility that more is
                already on an open Purchase Order, so a low/0-stock item doesn't read as a dead
                end. Never folded into availableStockQty above. */}
            {!!item.inTransitQty && (
              <p className="text-xs text-zinc-500">
                {item.inTransitQty} more boxes in transit
                {item.inTransitEta ? ` — expected ~${formatDate(item.inTransitEta)}` : ""}
              </p>
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

            {/* Read-only reference here -- the pickable version (ISS-2026-00712)
                is under Quantity below, once a qty is actually entered; showing
                it twice, before the dealer has even said how much they want,
                was the "not friendly" complaint (client, 4 Nov 2026). */}
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
                Quantity
                <BoxesPiecesFields
                  boxes={qtyBoxes}
                  pieces={qtyPieces}
                  onBoxesChange={setQtyBoxes}
                  onPiecesChange={setQtyPieces}
                  piecesPerBox={item.piecesPerBox}
                  className="mt-1.5"
                />
              </label>
              {/* ISS-2026-00712, client refinement 4 Nov 2026 -- only appears
                  once a qty is actually entered, and only when there's more
                  than one batch to choose between. Tap batches until
                  "allocated" reaches the entered qty -- each tap fills as much
                  of the remainder as that batch can cover, largest-first same
                  as Auto would, but editable per batch. Every qty here
                  self-caps to whatever's still actually available (roomFor),
                  so going over is never possible -- lowering one batch's own
                  qty frees that room straight back up for the others, letting
                  a dealer re-tap/re-type a higher number into them. */}
              {enteredBoxes > 0 && item.topBatches.length > 1 && (
                <div className="space-y-2 rounded-lg bg-zinc-50 p-3">
                  <p className="text-xs font-medium text-zinc-700">
                    Pick batch(es) for these {enteredBoxes} boxes (optional)
                  </p>
                  <div className="space-y-1">
                    {item.topBatches.map((b) => {
                      const picked = batchAlloc[b.batchNumber] !== undefined;
                      // ISS-2026-00712, client refinement 4 Nov 2026 -- once the
                      // qty is already fully covered by what's picked so far, an
                      // unpicked batch has nothing left to take and is no longer
                      // tappable (greyed out, "qty covered" shown) -- tapping it
                      // used to silently add a dead 0-qty row, which read as
                      // broken rather than "there's nothing left to give you."
                      // Deselecting an already-picked batch always stays
                      // allowed -- that's exactly how room gets freed up again.
                      const pickable = picked || allocatedTotal < enteredBoxes;
                      return (
                        <div
                          key={b.batchNumber}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                            picked
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : pickable
                                ? "border-zinc-200 bg-white text-zinc-700"
                                : "border-zinc-200 bg-zinc-100 text-zinc-500",
                          )}
                        >
                          <button
                            type="button"
                            disabled={!pickable}
                            onClick={() => toggleBatchPick(b)}
                            className={cn(
                              "flex-1 text-left",
                              !pickable && "cursor-not-allowed",
                            )}
                          >
                            <span className="font-medium">
                              {b.batchNumber}
                              {picked && " ✓"}
                            </span>
                            <span
                              className={cn(
                                "block text-[11px]",
                                picked
                                  ? "text-zinc-300"
                                  : pickable
                                    ? "text-zinc-500"
                                    : "text-zinc-500",
                              )}
                            >
                              {pickable
                                ? `${formatBoxQty(b.boxes, item.piecesPerBox)} available`
                                : "Qty already covered — remove a pick above to use this one"}
                            </span>
                          </button>
                          {picked && (
                            <Input
                              type="number"
                              min={0}
                              max={b.boxes}
                              value={batchAlloc[b.batchNumber]}
                              onChange={(e) =>
                                setBatchQty(b.batchNumber, e.target.value, b.boxes)
                              }
                              className="h-8 w-16 shrink-0 bg-white text-right text-xs text-zinc-900"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {hasAllocations && (
                    <p
                      className={cn(
                        "text-xs",
                        allocationComplete ? "text-emerald-700" : "text-amber-700",
                      )}
                    >
                      {allocatedTotal} of {enteredBoxes} boxes allocated
                      {allocatedTotal !== enteredBoxes &&
                        ` — ${enteredBoxes - allocatedTotal} more to go`}
                      .{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setBatchAlloc({})}
                      >
                        Reset to Auto
                      </button>
                    </p>
                  )}
                  {pieceBatchConflict ? (
                    <p className="text-xs text-red-600">
                      Pcs can't be split across batches — clear the Pcs field
                      above, or pick just one batch for this line.
                    </p>
                  ) : (
                    submittableEntries.length > 1 && (
                      <p className="text-xs text-zinc-500">
                        Split across {submittableEntries.length} batches — use
                        "Add to enquiry list" below, then send everything
                        together from your enquiry list.
                      </p>
                    )
                  )}
                </div>
              )}
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
                  const combined = readBoxesAndPieces(
                    qtyBoxes,
                    qtyPieces,
                    item.piecesPerBox,
                  );
                  if (!combined) return;
                  if (hasAllocations) {
                    // ISS-2026-00712 -- one line per batch, each carrying its own
                    // share of the qty. The Pcs component (if any) rides on the
                    // first line only -- safe here because pieceBatchConflict
                    // (see above, and the disabled check below) already blocks
                    // submission whenever there's a Pcs remainder AND more than
                    // one batch, the one case where "which line gets it" would
                    // actually matter.
                    submittableEntries.forEach(([batchNumber, qtyStr], i) => {
                      addToEnquiryList({
                        code: item.code,
                        name: item.name,
                        qty: Number(qtyStr),
                        pieces: i === 0 ? combined.pieces || undefined : undefined,
                        images: item.images,
                        piecesPerBox: item.piecesPerBox,
                        preferredBatchNo: batchNumber,
                        batchMaxBoxes: item.topBatches.find(
                          (b) => b.batchNumber === batchNumber,
                        )?.boxes,
                      });
                    });
                  } else {
                    addToEnquiryList({
                      code: item.code,
                      name: item.name,
                      qty: combined.boxes,
                      pieces: combined.pieces || undefined,
                      images: item.images,
                      piecesPerBox: item.piecesPerBox,
                    });
                  }
                  setQtyBoxes("");
                  setQtyPieces("");
                  setBatchAlloc({});
                  setAdded(true);
                }}
                disabled={
                  !readBoxesAndPieces(qtyBoxes, qtyPieces, item.piecesPerBox) ||
                  added ||
                  raiseMutation.isPending ||
                  !allocationComplete ||
                  pieceBatchConflict
                }
              >
                Add to enquiry list
              </Button>
              <Button
                onClick={() => raiseMutation.mutate()}
                loading={raiseMutation.isPending}
                disabled={
                  !readBoxesAndPieces(qtyBoxes, qtyPieces, item.piecesPerBox) ||
                  added ||
                  !allocationComplete ||
                  !canSendDirectly ||
                  pieceBatchConflict
                }
              >
                Send this enquiry now
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Client refinement, 27 Oct 2026 — shows automatically whenever the item actually
            has damaged/display-bay stock, silent otherwise. Client request, 2 Nov 2026 --
            moved below the regular "Enquire about this item" form so the dealer sees the
            normal enquiry path first and this as a secondary, separate option after it. */}
        {excludedStockQuery.data && excludedStockQuery.data.length > 0 && (
          <Card>
            <CardContent className="space-y-2">
              <p className="text-xs font-medium text-zinc-500">
                Also available, not counted above:
              </p>
              <div className="space-y-2">
                {excludedStockQuery.data.map((row) => {
                  const orderable = ORDERABLE_EXCLUDED_BAY_TYPES.has(
                    row.bayType,
                  );
                  const rowQty = damagedQty[row.bayType] ?? "";
                  return (
                    <div
                      key={row.bayType}
                      className="space-y-1 text-xs text-zinc-600"
                    >
                      <div className="flex justify-between">
                        <span>
                          {EXCLUDED_BAY_LABELS[row.bayType] ?? row.bayType}
                        </span>
                        <span className="font-medium text-zinc-900">
                          {formatBoxQty(row.boxes, item.piecesPerBox)}
                        </span>
                      </div>
                      {orderable &&
                        (() => {
                          const rowPieces = damagedPieces[row.bayType] ?? "";
                          const combined = readBoxesAndPieces(
                            rowQty,
                            rowPieces,
                            item.piecesPerBox,
                          );
                          return (
                            <div className="flex items-center gap-2">
                              <BoxesPiecesFields
                                boxes={rowQty}
                                pieces={rowPieces}
                                onBoxesChange={(v) =>
                                  setDamagedQty((prev) => ({
                                    ...prev,
                                    [row.bayType]: v,
                                  }))
                                }
                                onPiecesChange={(v) =>
                                  setDamagedPieces((prev) => ({
                                    ...prev,
                                    [row.bayType]: v,
                                  }))
                                }
                                piecesPerBox={item.piecesPerBox}
                                className="min-w-0 flex-1"
                                inputClassName="h-8 text-xs"
                              />
                              <Button
                                variant="outline"
                                className="h-8 w-auto shrink-0 px-2.5 text-xs"
                                disabled={!combined}
                                onClick={() => {
                                  if (!combined) return;
                                  addToEnquiryList({
                                    code: item.code,
                                    name: item.name,
                                    qty: combined.boxes,
                                    pieces: combined.pieces || undefined,
                                    damagedStock: true,
                                    images: item.images,
                                    piecesPerBox: item.piecesPerBox,
                                  });
                                  setDamagedQty((prev) => ({
                                    ...prev,
                                    [row.bayType]: "",
                                  }));
                                  setDamagedPieces((prev) => ({
                                    ...prev,
                                    [row.bayType]: "",
                                  }));
                                  setDamagedAdded((prev) => ({
                                    ...prev,
                                    [row.bayType]: true,
                                  }));
                                }}
                              >
                                Add to order
                              </Button>
                              {damagedAdded[row.bayType] && (
                                <span className="text-emerald-700">Added</span>
                              )}
                            </div>
                          );
                        })()}
                    </div>
                  );
                })}
              </div>
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
                        <Badge
                          tone={
                            alt.availableStockQty > 0 ? "success" : "danger"
                          }
                        >
                          {alt.availableStockQty > 0
                            ? "In stock"
                            : "Out of stock"}
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
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-700">
                Your enquiry <strong>{raisedInquiry.number}</strong> has been
                logged.{" "}
                {!item.orderable
                  ? "This item isn't yet set up for ordering on your account — our team will follow up to get it added and quote you."
                  : askForQuotationMutation.isSuccess
                    ? "Pacific will send you a quotation — you can accept it there to place the order."
                    : "Create an order now, or ask Pacific for a quotation first."}
              </p>

              {/* Client request, 2 Nov 2026 -- once a quotation's been asked for, Pacific is
                  now the one pricing this order; self-service "Create order" no longer applies
                  to this enquiry, so it's hidden instead of staying alongside the quotation
                  request. */}
              {item.orderable && !askForQuotationMutation.isSuccess && (
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
        )}

        {raisedInquiry && !inStock && (
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-700">
                Your enquiry <strong>{raisedInquiry.number}</strong> has been
                logged. We'll notify you once it's back in stock.
              </p>
              {askForQuotationMutation.isSuccess ? (
                <p className="text-sm font-medium text-emerald-600">
                  Quotation requested — Pacific will follow up.
                </p>
              ) : (
                <Button
                  size="sm"
                  onClick={() => askForQuotationMutation.mutate()}
                  disabled={askForQuotationMutation.isPending}
                >
                  {askForQuotationMutation.isPending
                    ? "Requesting…"
                    : "Ask for quotation"}
                </Button>
              )}
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
