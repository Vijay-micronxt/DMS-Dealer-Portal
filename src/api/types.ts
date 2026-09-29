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
 * `dealerCode`, plus `price` (this dealer's tier rate) and `topBatches`. */
export type CatalogItem = {
  id: string;
  code: string;
  name: string;
  size: string | null;
  finish: string | null;
  color: string | null;
  series: string | null;
  seriesRef: string | null;
  category: string | null;
  swatch: string | null;
  stockQty: number;
  dealerPrice: number | null;
  price: number | null;
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
};

export type Inquiry = {
  id: string;
  number: string;
  date: string;
  dealerId: string;
  productId: string;
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
  /** Only present on the response to raise_inquiry -- a recent open duplicate's id, if any. */
  duplicateOf?: string | null;
};

export type OrderLine = {
  itemCode: string;
  qty: number;
  rate: number;
  weightPerBoxKg: number | null;
  totalWeightKg: number | null;
};

export type OrderStageEvent = {
  stage: string;
  at: string;
  by: string;
  note: string | null;
};

export type Order = {
  id: string;
  number: string;
  date: string;
  dealerId: string;
  sourceType: string;
  sourceRef: string;
  channel: string;
  lines: OrderLine[];
  total: number;
  stage: string;
  customerPo: string | null;
  expectedDispatch: string | null;
  vehicle: string | null;
  owner: string;
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
};

export type DealerDues = {
  outstanding: number;
};
