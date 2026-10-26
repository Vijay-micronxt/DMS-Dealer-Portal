export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type ProductImage = {
  image: string;
  imageType: string;
  isPrimary: boolean;
};

export type BatchSummary = {
  batchNumber: string;
  itemCode: string;
  itemName: string;
  boxes: number;
};

/** dms_erp.sales.dealer_portal_api's catalog entry -- catalog.api.get_product's shape
 * with the full per-dealer `dealerCodes` list stripped down to just this dealer's own
 * `dealerCode`, plus `topBatches`. There is deliberately no price here: Pacific's
 * price to a dealer depends on delivery and other details, so it appears only on a
 * quotation. */
export type CatalogItem = {
  id: string;
  code: string;
  name: string;
  size: string | null;
  finish: string | null;
  color: string | null;
  /** ISS-2026-00632 — secondary colour/design descriptors, filterable in Browse. */
  colourAttribute1: string | null;
  colourAttribute2: string | null;
  designAttribute1: string | null;
  designAttribute2: string | null;
  series: string | null;
  seriesRef: string | null;
  category: string | null;
  swatch: string | null;
  /** Client finding "stock accuracy" — damage/insurance-claim and display-bay stock already
   * excluded server-side (dms_erp.warehouse.utils.sellable_stock_for_item); the raw staff-facing
   * total is never sent to a dealer session. See getExcludedStock for the "View more" breakdown
   * of what this excludes. */
  availableStockQty: number;
  status: string;
  isReorderable: boolean;
  isSellable: boolean;
  piecesPerBox: number | null;
  sqftPerBox: number | null;
  weightPerBoxKg: number | null;
  leadTimeDays: number | null;
  altItemId: string | null;
  images: ProductImage[];
  hsnCode: string | null;
  dealerCode: string | null;
  topBatches: BatchSummary[];
  /** ISS-2026-00644 — every sellable item now shows up in Browse, assigned or not;
   * this is what actually distinguishes an orderable item from one that can only be
   * enquired on (raiseInquiry still works either way; convertToOrder doesn't). */
  orderable: boolean;
  /** Only on suggestAlternatives results: the alternative Pacific staff chose for the item. */
  isRecommended?: boolean;
};

export type Inquiry = {
  id: string;
  number: string;
  date: string;
  dealerId: string;
  /** null for a Custom Style enquiry (ISS-2026-00636) -- see requestedStyle. */
  productId: string | null;
  /** The item's name, when it has one different from its code. */
  productName?: string | null;
  /** ISS-2026-00636 -- the style name typed through WhatsApp's "Custom Style"
   * option, when the enquiry has no catalog item; null otherwise. */
  requestedStyle: string | null;
  qty: number;
  weightPerBoxKg: number | null;
  totalWeightKg: number | null;
  status: string;
  source: string;
  expectedDelivery: string | null;
  followUpDate: string | null;
  assignedTo: string | null;
  remarks: string | null;
  whatsappReplied: boolean;
  customerPo: string | null;
  /** ISS-2026-00644 -- false for an item not in your assigned catalog (and for a Custom
   * Style enquiry): it can be enquired on, but Pacific can't quote it for ordering yet. */
  orderable: boolean;
  /** Several items raised together share one group id (the first enquiry's number). */
  requestGroup: string | null;
  /** The quotation Pacific prepared for this enquiry -- where the dealer sees the price and
   * accepts it to place the order. null until one is sent. */
  linkedQuotation: string | null;
  /** Only present on the response to raise_inquiry -- a recent open duplicate's id, if any. */
  duplicateOf?: string | null;
};

/** One enquiry as the dealer made it. Items sent together from the enquiry list are ONE enquiry
 * holding all of them (each still its own record on Pacific's side, which is why `items` carries a
 * status per item). A lone item is an enquiry of one. */
export type Enquiry = {
  /** The group id for items sent together, or the item's own enquiry number. */
  id: string;
  number: string;
  date: string;
  createdAt: string;
  /** The shared status, or "Mixed" when the items are in different states. */
  status: string;
  itemCount: number;
  remarks: string | null;
  /** Quotations Pacific prepared for this enquiry's items (usually one). */
  linkedQuotations: string[];
  items: Inquiry[];
};

export type QuotationLine = {
  itemCode: string;
  itemName: string;
  qty: number;
  /** The rate before any discount. */
  priceListRate: number;
  discountPercentage: number;
  rate: number;
  amount: number;
  deliveryDate: string | null;
  weightPerBoxKg: number | null;
  totalWeightKg: number | null;
};

export type QuotationTax = {
  description: string;
  rate: number;
  amount: number;
};

/** What Pacific is offering: items, rates, tax, freight, and until when. Accepting it
 * (with the dealer's own PO number) is what places the order. */
export type Quotation = {
  id: string;
  number: string;
  date: string;
  validTill: string | null;
  status: string;
  /** Open, not expired, not already ordered -- the backend decides, not the client clock. */
  canAccept: boolean;
  lines: QuotationLine[];
  netTotal: number;
  taxes: QuotationTax[];
  totalTaxesAndCharges: number;
  freight: number;
  deliveryPincode: string | null;
  /** Items + tax + freight. */
  totalPayable: number;
  inquiryIds: string[];
};

export type Invoice = {
  id: string;
  date: string;
  type: string;
  netTotal: number;
  taxTotal: number;
  grandTotal: number;
  vehicleNo: string | null;
  lrNo: string | null;
};

export type InvoiceDetail = Invoice & {
  dueDate: string | null;
  poNumber: string | null;
  address: string | null;
  remarks: string | null;
  transport: Record<string, string | null>;
  items: {
    itemCode: string;
    itemName: string;
    qty: number;
    uom: string | null;
    rate: number;
    amount: number;
    /** The batch this line was supplied from, when the invoice records one. */
    batchNo: string | null;
  }[];
  taxes: { description: string; rate: number; amount: number }[];
  receipts: {
    id: string;
    date: string;
    mode: string | null;
    referenceNo: string | null;
    amount: number;
  }[];
};

export type OrderLine = {
  itemCode: string;
  qty: number;
  rate: number;
  /** After any line discount -- what this line actually costs. rate × qty ignores the discount. */
  amount?: number;
  weightPerBoxKg: number | null;
  totalWeightKg: number | null;
};

export type OrderStageEvent = {
  stage: string;
  at: string;
  note: string | null;
};

export type Order = {
  id: string;
  number: string;
  date: string;
  dealerId: string;
  sourceType: string;
  sourceRef: string;
  lines: OrderLine[];
  /** Items total before tax. */
  netTotal?: number;
  /** GST and any other charges on the order (rate is 0 where the amount is fixed). */
  taxes?: { description: string; rate: number; amount: number }[];
  totalTaxesAndCharges?: number;
  /** Items + tax: what the order comes to. */
  total: number;
  stage: string;
  customerPo: string | null;
  expectedDispatch: string | null;
  vehicle: string | null;
  history: OrderStageEvent[];
};

export type DealerProfile = {
  id: string;
  name: string;
  phone: string | null;
  /** The dealer portal's second login identifier (see lib/auth's
   * loginWithPassword) -- null until the dealer sets one themselves. */
  email: string | null;
  classification: string | null;
  /** Whether this portal account has a password set -- drives the post-OTP
   * "set an email + password" prompt (components/SetCredentialsPrompt). */
  hasPassword: boolean;
};

export type DealerDues = {
  outstanding: number;
};
