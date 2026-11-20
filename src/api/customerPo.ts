import { useQuery } from "@tanstack/react-query";
import { authedCall, authedUpload } from "@/lib/auth";

/** What the portal knows about a PO on an enquiry: whether one is on file, under what name, and
 * whether this site requires one before an order. Nothing about how the PO was checked is sent to
 * a dealer -- that is for Pacific's staff. */
export type MyPo = {
  required: boolean;
  attached: boolean;
  fileName: string | null;
};

export function getMyPo(inquiry: string): Promise<MyPo> {
  return authedCall("dms_erp.sales.dealer_portal_api.get_my_po", {
    method: "GET",
    params: { inquiry },
  });
}

export function attachMyPo(inquiry: string, file: File): Promise<MyPo> {
  return authedUpload("dms_erp.sales.dealer_portal_api.attach_po", file, {
    inquiry,
  });
}

export const myPoKey = (inquiry: string) => ["my-po", inquiry] as const;

/** The PO state of one enquiry. `enabled` is false until there is an enquiry to ask about. */
export function useMyPo(inquiry: string | null | undefined) {
  return useQuery({
    queryKey: myPoKey(inquiry ?? ""),
    queryFn: () => getMyPo(inquiry as string),
    enabled: !!inquiry,
  });
}

/** True when the Create order button must wait: the site requires a PO and none is on file yet.
 * While the state is still loading it does not block -- the server enforces the rule either way. */
export function poIsMissing(po: MyPo | undefined): boolean {
  return !!po && po.required && !po.attached;
}
