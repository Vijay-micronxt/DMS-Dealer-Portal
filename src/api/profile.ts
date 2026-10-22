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

/** Sets this dealer's own email -- the identifier for email + password sign-in. */
export function updateMyEmail(email: string): Promise<DealerProfile> {
  return authedCall("dms_erp.sales.dealer_portal_api.update_my_email", {
    method: "POST",
    params: { email },
  });
}

/** Sets/changes this dealer's portal password. Needs an email on file first. */
export function setMyPassword(password: string): Promise<{ success: boolean }> {
  return authedCall("dms_erp.auth.dealer_api.set_my_password", {
    method: "POST",
    params: { password },
  });
}
