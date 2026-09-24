import { authedCall } from "@/lib/auth";
import type { Order, Paginated } from "@/api/types";

export function listMyOrders(params: {
  stage?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}): Promise<Paginated<Order>> {
  return authedCall("dms_erp.sales.dealer_portal_api.list_my_orders", {
    method: "GET",
    params,
  });
}

export function getMyOrder(order: string): Promise<Order> {
  return authedCall("dms_erp.sales.dealer_portal_api.get_my_order", {
    method: "GET",
    params: { order },
  });
}
