import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChevronLeft, Paperclip, Search, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClickableThumbnail } from "@/components/ui/image-gallery";
import { BoxesPiecesFields } from "@/components/ui/boxes-pieces-fields";
import { ApiError } from "@/lib/erp-client";
import { cn, formatCurrency, todayISO } from "@/lib/utils";
import { formatBoxQty } from "@/lib/stock-format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAvailability } from "@/api/availability";
import { PoAttachment } from "@/components/po-attachment";
import { attachMyPo, poIsMissing, useMyPo } from "@/api/customerPo";
import {
  AvailabilityNote,
  arrivalPhrase,
  daysUntil,
} from "@/components/availability-note";
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
  // Two screens: the list (items, remarks) and then "send", which asks for the dealer's PO number and
  // PO file -- both optional -- and holds the real Send button. Nothing is created until Send.
  const [step, setStep] = React.useState<"list" | "send">("list");
  const [poNumber, setPoNumber] = React.useState("");
  const [poFile, setPoFile] = React.useState<File | null>(null);
  const [poFileError, setPoFileError] = React.useState<string | null>(null);
  const [poAttachError, setPoAttachError] = React.useState<string | null>(null);
  const poInput = React.useRef<HTMLInputElement>(null);
  const [sentGroup, setSentGroup] = React.useState<string | null>(null);
  const [sentItems, setSentItems] = React.useState<InquiryItemRow[]>([]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const result = await raiseInquiries({
        items: lines.map((l) => ({
          item: l.code,
          qty: l.pieces ?? 0,
          damagedStock: l.damagedStock,
          enteredBoxes: l.qty,
          preferredBatchNo: l.preferredBatchNo,
        })),
        remarks: remarks.trim() || undefined,
        customerPo: poNumber.trim() || undefined,
      });
      // The enquiry exists now. A PO that then fails to upload must not undo it -- the dealer is told
      // and can attach it again from the next screen.
      let attachError: string | null = null;
      if (poFile) {
        try {
          await attachMyPo(result.requestGroup, poFile);
        } catch (err) {
          attachError =
            err instanceof ApiError ? err.message : "Could not attach the PO.";
        }
      }
      return { result, attachError };
    },
    onSuccess: ({ result, attachError }) => {
      clearEnquiryList();
      queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
      // Stay on this page and show the "Ask for quotation"/"Create order" options
      // right here, same as the single-item flow on the item page -- not a redirect away.
      setSentGroup(result.requestGroup);
      setSentItems(result.items);
      // The PO number typed on the send screen is already the Create order box's PO number.
      setOrderPo(poNumber.trim());
      setPoAttachError(attachError);
      setStep("list");
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
  // An order needs every line to be both set up for this dealer AND available in the quantity
  // asked for. A line that isn't available can still be quoted -- it just can't be ordered.
  const allOrderable =
    sentItems.length > 0 &&
    sentItems.every((i) => i.orderable && i.available !== false);
  const someUnavailable = sentItems.some((i) => i.available === false);
  // The PO attached to the enquiry just sent: reused on the order, and required before it where the
  // site says so (the server enforces that either way).
  const sentPo = useMyPo(sentGroup);
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
  // "Available" / "Not available" per line, for the quantity typed on it.
  const availability = useAvailability(
    lines.map((l) => ({
      item: l.code,
      qty: l.pieces ?? 0,
      enteredBoxes: l.qty,
      damagedStock: l.damagedStock,
    })),
  );

  function onPickPo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
      setPoFileError("Please choose a JPG, PNG or PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPoFileError("The file is too large. Please keep it under 10 MB.");
      return;
    }
    setPoFileError(null);
    setPoFile(file);
  }

  const sendScreen = step === "send" && !sentGroup;

  const overBatchLine = lines.find(
    (l) => l.batchMaxBoxes !== undefined && l.qty > l.batchMaxBoxes,
  );
  const invalid = lines.some((l) => !(l.qty > 0)) || !!overBatchLine;

  return (
    <AppShell>
      <div className="-mt-2 space-y-2">
        {/* The back link is just the chevron, in front of the title: one row instead of two, so
            more of the list fits on a phone. */}
        <div className="flex items-center gap-1">
          {sendScreen ? (
            <button
              aria-label="Back to the enquiry list"
              title="Back to the enquiry list"
              onClick={() => setStep("list")}
              className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link
              to="/catalog"
              aria-label="Back to catalog"
              title="Back to catalog"
              className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
          )}
          <h1 className="text-lg font-semibold text-zinc-900">
            {sendScreen ? "Send enquiry" : "Enquiry list"}
          </h1>
        </div>

        {sentGroup ? (
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-700">
                Your enquiry <strong>{sentGroup}</strong> has been logged.
                {!createOrderMutation.isSuccess && (
                  <>
                    {" "}
                    {someUnavailable
                      ? `Some items aren't available in the quantity you asked for, so this can't be ordered directly. Ask for a quotation below — Pacific will send you a quotation — you can accept it there to place the order.`
                      : !allOrderable || askForQuotationMutation.isSuccess
                        ? "Pacific will send you a quotation — you can accept it there to place the order."
                        : "Create an order now, or ask Pacific for a quotation first."}
                  </>
                )}
              </p>
              {poAttachError && (
                <p className="text-sm text-red-600">
                  Your enquiry was sent, but the PO could not be attached:{" "}
                  {poAttachError}
                  {allOrderable &&
                  !askForQuotationMutation.isSuccess &&
                  !createOrderMutation.isSuccess
                    ? " You can attach it below."
                    : ""}
                </p>
              )}
              {sentPo.data?.attached &&
                !(
                  allOrderable &&
                  !askForQuotationMutation.isSuccess &&
                  !createOrderMutation.isSuccess
                ) && (
                  <p className="text-xs break-all text-emerald-600">
                    PO attached — {sentPo.data.fileName}
                  </p>
                )}

              {createOrderMutation.isSuccess ? (
                <p className="text-sm font-medium text-emerald-600">
                  Order sent — Pacific will check it and confirm.
                </p>
              ) : (
                // Client request, 2 Nov 2026 -- once a quotation's been asked for, Pacific is
                // now the one pricing this enquiry; self-service "Create order" no longer
                // applies, so it's hidden instead of staying alongside the quotation request.
                allOrderable &&
                !askForQuotationMutation.isSuccess && (
                  <div className="space-y-2 rounded-lg bg-zinc-50 p-3">
                    {sentGroup && <PoAttachment inquiry={sentGroup} />}
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
                        min={todayISO()}
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
                      disabled={
                        !orderPo.trim() ||
                        !orderDispatchDate ||
                        poIsMissing(sentPo.data)
                      }
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
        ) : sendScreen ? (
          // As items are added the item summary shrinks and scrolls, while the PO fields, Remarks and
          // the Send button stay pinned at the bottom of the screen; with few items nothing is pinned
          // and it all simply flows. 13rem is the header, title and bottom bar.
          <div
            className="flex min-h-0 flex-col gap-2"
            style={{ maxHeight: "calc(100dvh - 13rem)" }}
          >
            <Card className="flex min-h-0 flex-col rounded-xl">
              <CardContent className="flex min-h-0 flex-col space-y-1 p-3">
                <p className="text-xs font-medium text-zinc-700">
                  {lines.length} item{lines.length === 1 ? "" : "s"} in this
                  enquiry
                </p>
                <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
                  {lines.map((l) => (
                    <p
                      key={`${l.code}-${l.damagedStock ? "d" : "r"}-${l.preferredBatchNo ?? "a"}`}
                      className="flex justify-between gap-3 text-xs text-zinc-600"
                    >
                      <span className="min-w-0 truncate">{l.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {formatBoxQty(l.qty, l.piecesPerBox)}
                      </span>
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="shrink-0 space-y-2">
              <Card className="rounded-xl">
                <CardContent className="space-y-3 p-3">
                  <label className="block text-sm font-medium text-zinc-700">
                    Your PO number (optional)
                    <Input
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      className="mt-1.5"
                      placeholder="PO-2026-001"
                    />
                  </label>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-zinc-700">
                      Attach your PO (optional)
                    </p>
                    <input
                      ref={poInput}
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      className="hidden"
                      onChange={onPickPo}
                    />
                    {poFile ? (
                      <p className="flex items-center gap-2 text-sm break-all text-emerald-600">
                        <Paperclip className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1">{poFile.name}</span>
                        <button
                          aria-label="Remove the PO file"
                          onClick={() => setPoFile(null)}
                          className="shrink-0 p-1 text-zinc-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </p>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-auto"
                        onClick={() => poInput.current?.click()}
                      >
                        <Paperclip className="h-4 w-4" /> Choose a photo or PDF
                      </Button>
                    )}
                    {poFileError && (
                      <p className="text-xs text-red-600">{poFileError}</p>
                    )}
                  </div>
                  <label className="block text-sm font-medium text-zinc-700">
                    Remarks (optional)
                    <Input
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="mt-1.5"
                      placeholder="Other batch needed, delivery date, site, timing…"
                    />
                  </label>
                </CardContent>
              </Card>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                onClick={() => sendMutation.mutate()}
                loading={sendMutation.isPending}
                disabled={invalid}
              >
                Send enquiry ({lines.length} item{lines.length === 1 ? "" : "s"}
                )
              </Button>
              <p className="text-center text-xs text-zinc-500">
                Pacific will reply with a quotation showing the price.
              </p>
            </div>
          </div>
        ) : lines.length === 0 ? (
          <>
            <p className="pt-2 text-center text-sm text-zinc-500">
              Your enquiry list is empty. Add the items you want to ask about.
            </p>
            <AddItem />
          </>
        ) : (
          <>
            {/* The lines scroll inside their own box once there are more than two, so the item
                search below stays on screen however many are added. */}
            <div
              className={cn(
                "space-y-2",
                lines.length > 2 &&
                  "max-h-[16.5rem] overflow-y-auto overscroll-contain pr-1",
              )}
            >
              {lines.map((line, index) => (
                <Card
                  className="rounded-xl"
                  key={`${line.code}-${line.damagedStock ? "damaged" : "regular"}-${line.preferredBatchNo ?? "auto"}`}
                >
                  <CardContent className="space-y-1 p-2.5">
                    <div className="flex items-start gap-2">
                      <ClickableThumbnail
                        images={line.images ?? []}
                        className="h-9 w-9 shrink-0"
                        alt={line.name}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1.5">
                          {/* The whole name, wrapped: on a phone it shares the row only with
                              the thumbnail and the delete button, not the quantity boxes. */}
                          <p className="text-[13px] leading-tight font-medium break-words text-zinc-900">
                            {line.name}
                          </p>
                          {line.damagedStock && (
                            <Badge tone="warning" className="shrink-0">
                              Damaged
                            </Badge>
                          )}
                        </div>
                        {(line.code !== line.name || line.preferredBatchNo) && (
                          <p className="text-[11px] break-words text-zinc-500">
                            {line.code !== line.name && line.code}
                            {/* ISS-2026-00712 -- shown so a dealer who picked a specific
                              batch on the item page can see it stuck, before sending. */}
                            {line.preferredBatchNo && (
                              <>
                                {line.code !== line.name ? " · " : ""}Batch{" "}
                                {line.preferredBatchNo}
                              </>
                            )}
                          </p>
                        )}
                      </div>
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
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
                      className="w-full"
                      inputClassName="h-8 text-sm"
                    />
                    <AvailabilityNote
                      availability={availability.lines?.[index]}
                      checking={availability.isChecking}
                      piecesPerBox={line.piecesPerBox}
                    />
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

            {/* Sending happens on the next screen, which also asks for the PO number and PO file. */}
            <Button
              onClick={() => {
                setError(null);
                setStep("send");
              }}
              disabled={invalid}
            >
              Review &amp; send ({lines.length} item
              {lines.length === 1 ? "" : "s"})
            </Button>

            {/* Under the button on purpose: the lines and the button stay together, and more items
                can still be added below without scrolling past it. */}
            <AddItem />
          </>
        )}
      </div>
    </AppShell>
  );
}

const ADD_PAGE = 8;

/** "Add an item", always open under the enquiry list. Before anything is typed it lists the catalogue
 * (the first few items, "Show more" for the rest) so a dealer can add straight from it; typing two
 * letters narrows it by name or code. The results scroll inside their own box, so this panel stays
 * short; it sits below the enquiry list and the Send button, so those are never pushed out of reach.
 * Quantities are edited on the list above, where they can also be changed after adding. */
function AddItem() {
  const lines = useEnquiryList();
  const [query, setQuery] = React.useState("");
  const debounced = useDebouncedValue(query.trim(), 300);
  const searching = debounced.length >= 2;
  const term = searching ? debounced : undefined;

  // How many results are shown. Tied to the search it was raised for, so a different search starts
  // again from the first few without any reset step.
  const [expanded, setExpanded] = React.useState<{
    term: string | undefined;
    shown: number;
  }>({ term: undefined, shown: ADD_PAGE });
  const shown = expanded.term === term ? expanded.shown : ADD_PAGE;

  const results = useQuery({
    queryKey: ["enquiry-add-search", term ?? "", shown],
    queryFn: () => getCatalog({ search: term, limit: shown }),
    placeholderData: keepPreviousData,
  });
  // An exact item code (the dealer's own or the company's) isn't part of the name search.
  const byCode = useQuery({
    queryKey: ["enquiry-add-code", debounced],
    queryFn: () => resolveCode(debounced),
    enabled: searching && results.isSuccess && results.data.items.length === 0,
  });

  const found =
    results.data && results.data.items.length > 0
      ? results.data.items
      : searching && byCode.data
        ? [byCode.data]
        : [];
  const hasMore =
    !!results.data && results.data.items.length < results.data.total;
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

  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Add an item</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search item name or code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {!searching && (
          <p className="text-xs text-zinc-500">
            Pick from the list, or type at least 2 letters of the name or code.
          </p>
        )}
        {(results.isLoading || byCode.isLoading) && (
          <p className="text-xs text-zinc-500">
            {searching ? "Searching…" : "Loading items…"}
          </p>
        )}
        {searching &&
          results.isSuccess &&
          !results.isPlaceholderData &&
          found.length === 0 &&
          !byCode.isLoading && (
            <p className="text-xs text-zinc-500">
              No item matches “{debounced}”.
            </p>
          )}
        <div
          className={cn(
            "max-h-80 divide-y divide-zinc-100 overflow-y-auto overscroll-contain",
            results.isPlaceholderData && "opacity-60",
          )}
        >
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
                  </p>
                  {/* More stock already on an open purchase order, as days from today -- shown
                      here too so a dealer deciding what to add sees it before typing a quantity. */}
                  {!!item.inTransitQty && (
                    <p className="text-xs text-sky-700">
                      {item.inTransitQty} Box will be available{" "}
                      {arrivalPhrase(
                        daysUntil(item.inTransitEta),
                        item.inTransitEta ?? null,
                      )}
                      .
                    </p>
                  )}
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
          {hasMore && !byCode.data && (
            <div className="py-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={results.isFetching}
                onClick={() => setExpanded({ term, shown: shown + ADD_PAGE })}
              >
                Show more
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
