import { useQuery } from "@tanstack/react-query";
import { myProfile } from "@/api/profile";
import { useAuth } from "@/lib/auth";
import type { DealerPermission } from "@/api/types";

/** What the signed-in person may do, from `my_profile` (24 Nov 2026 dealer roles: each phone
 * number at a dealer signs in as its own person with its own role).
 *
 * This only decides what to SHOW -- the server refuses every gated call itself, so a stale or
 * missing answer can never grant anything. While the profile is loading, or if the backend is
 * an older one that sends no `permissions`, everything counts as allowed: hiding a tab or a
 * button on a guess would be worse than showing one the server then refuses.
 *
 * Keyed by the portal user so a second person signing in on the same browser never inherits the
 * first one's answer. */
export function usePermissions() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["my-profile", "permissions", user?.id ?? null],
    queryFn: myProfile,
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const granted = query.data?.permissions;
  return {
    role: query.data?.role ?? null,
    can: (permission: DealerPermission) =>
      granted === undefined ? true : granted.includes(permission),
  };
}
