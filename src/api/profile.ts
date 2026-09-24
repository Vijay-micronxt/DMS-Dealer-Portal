import { authedCall } from "@/lib/auth";
import type { DealerDues, DealerProfile } from "@/api/types";

export function myProfile(): Promise<DealerProfile> {
  return authedCall("dms_erp.sales.dealer_portal_api.my_profile", {
    method: "GET",
  });
}

export function myDues(): Promise<DealerDues> {
  return authedCall("dms_erp.sales.dealer_portal_api.my_dues", {
    method: "GET",
  });
}
