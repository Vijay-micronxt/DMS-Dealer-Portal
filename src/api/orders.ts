import { authedCall } from "@/lib/auth";
import type { Order, Paginated } from "@/api/types";

export function listMyOrders(params: {
  stage?: string | undefined;
  /** ISS "only show pending orders" — true hides Delivered/Cancelled when `stage` is left
   * unset. Ignored once `stage` names a specific stage (including Delivered/Cancelled
   * themselves, picked explicitly from a tab). */
  excludeCompleted?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}): Promise<Paginated<Order>> {
  return authedCall("dms_erp.sales.dealer_portal_api.list_my_orders", {
    method: "GET",
    params: {
      stage: params.stage,
      exclude_completed: params.excludeCompleted,
      limit: params.limit,
      offset: params.offset,
    },
  });
}

export function getMyOrder(order: string): Promise<Order> {
  return authedCall("dms_erp.sales.dealer_portal_api.get_my_order", {
    method: "GET",
    params: { order },
  });
}

// ISS-2026-00634: dealer self-cancel is immediate within the first 24 hours of
// the order being placed; past that window the backend queues it as a Pending
// Approval Request for Management instead of refusing it outright (see
// dealer_portal_api.cancel_my_order) — `cancelled` discriminates which happened.
export type CancelOrderResult =
  | { cancelled: true; approvalRequired: false; order: Order }
  | {
      cancelled: false;
      approvalRequired: true;
      approval: { id: string; status: string };
    };

export function cancelMyOrder(order: string): Promise<CancelOrderResult> {
  return authedCall("dms_erp.sales.dealer_portal_api.cancel_my_order", {
    method: "POST",
    params: { order },
  });
}
