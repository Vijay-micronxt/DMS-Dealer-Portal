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

/** Sets/changes the email `loginWithPassword` (lib/auth) resolves by -- required
 * before setMyPassword will accept a password at all (see that function's own
 * docstring server-side). Rejected if another dealer already has this email. */
export function updateMyEmail(email: string): Promise<DealerProfile> {
  return authedCall("dms_erp.sales.dealer_portal_api.update_my_email", {
    method: "POST",
    params: { email },
  });
}
