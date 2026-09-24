import { useSyncExternalStore } from "react";
import { ApiError, callMethod } from "@/lib/erp-client";

type AuthedCallOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  params?: Record<string, unknown>;
};

const USER_KEY = "dealer.auth.user";
const TOKENS_KEY = "dealer.auth.tokens";
const DEVICE_KEY = "dealer.auth.device_id";

type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };

export type DealerUser = {
  /** The dealer-portal User id (a synthetic email — never shown, never the login identifier). */
  id: string;
  /** The Customer id this session is scoped to (backend field `user.dealer` — see
   * DmsErpService dms_erp/auth/utils.py build_user_profile). Every dealer_portal_api call
   * is implicitly scoped to this id server-side; the frontend never sends it. */
  dealerId: string;
  /** The dealer's own display name (backend: the portal User's full_name, seeded from
   * Customer.customer_name at account creation). */
  name: string;
  initials: string;
};

type BackendUser = {
  name: string;
  full_name: string;
  dealer: string | null;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: BackendUser;
};

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

let current: DealerUser | null = null;
let tokens: Tokens | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const rawUser = window.localStorage.getItem(USER_KEY);
    if (rawUser) current = JSON.parse(rawUser) as DealerUser;
    const rawTokens = window.localStorage.getItem(TOKENS_KEY);
    if (rawTokens) tokens = JSON.parse(rawTokens) as Tokens;
  } catch {
    current = null;
    tokens = null;
  }
}

function deviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dealer-web-${crypto.randomUUID()}`;
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = [parts[0]?.[0], parts[1]?.[0]].filter(
    (c): c is string => !!c,
  );
  return (letters.join("") || name.slice(0, 2)).toUpperCase();
}

function mapBackendUser(u: BackendUser): DealerUser {
  if (!u.dealer) {
    // Should never happen from verify_otp (it only ever mints dealer-linked accounts),
    // but this is the one place a mismatch would surface, so fail loudly rather than
    // silently rendering a portal for an account that isn't actually a dealer.
    throw new ApiError("This account is not linked to a dealer.", 0);
  }
  return {
    id: u.name,
    dealerId: u.dealer,
    name: u.full_name,
    initials: initialsFrom(u.full_name),
  };
}

function persistSession(nextTokens: Tokens, user: DealerUser) {
  current = user;
  tokens = nextTokens;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.localStorage.setItem(TOKENS_KEY, JSON.stringify(nextTokens));
  }
  emit();
}

function clearSession() {
  current = null;
  tokens = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(TOKENS_KEY);
  }
  emit();
}

let refreshInFlight: Promise<string | null> | null = null;

/** Returns a valid access token, refreshing it first if it's near expiry. A single
 * in-flight refresh is shared across concurrent callers -- several authedCall()s firing
 * together near expiry would otherwise each try to rotate the same single-use refresh
 * token, and only the first would succeed. */
export async function ensureFreshAccessToken(): Promise<string | null> {
  hydrate();
  if (!tokens) return null;
  if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      // dms_erp.auth.api.refresh_token is guest-allowed shared infra -- same endpoint
      // staff logins use. It isn't under the dealer_portal_api prefix, but the
      // middleware's dealer-scope guard only ever fires for a call carrying a resolved
      // Bearer session; this call carries none (it authenticates by refresh token, in
      // the request body), so it's never subject to that gate either way.
      const res = await callMethod<RefreshResponse>(
        "dms_erp.auth.api.refresh_token",
        {
          method: "POST",
          params: { refresh_token: tokens!.refreshToken },
        },
      );
      if (!current) return null;
      const nextTokens: Tokens = {
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        expiresAt: Date.now() + res.expires_in * 1000,
      };
      persistSession(nextTokens, current);
      return nextTokens.accessToken;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Step 1 of login (BRD C.13) -- sends a 6-digit code over WhatsApp to the given phone
 * number if (and only if) it matches a dealer. Always resolves the same way regardless
 * of whether the phone is actually registered -- the backend deliberately never reveals
 * that, so the UI's next step is always "enter the code we sent", never a branch on
 * whether the number was found. */
export async function requestOtp(phone: string): Promise<void> {
  await callMethod("dms_erp.auth.dealer_api.request_otp", {
    method: "POST",
    params: { phone },
  });
}

/** Step 2 of login -- verifies the code and, on success, signs the dealer in. */
export async function verifyOtp(
  phone: string,
  otp: string,
): Promise<DealerUser> {
  const res = await callMethod<TokenResponse>(
    "dms_erp.auth.dealer_api.verify_otp",
    {
      method: "POST",
      params: { phone, otp, device_id: deviceId() },
    },
  );
  const user = mapBackendUser(res.user);
  persistSession(
    {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: Date.now() + res.expires_in * 1000,
    },
    user,
  );
  return user;
}

export function signOut() {
  hydrate();
  if (tokens) {
    callMethod("dms_erp.auth.api.logout", {
      method: "POST",
      params: { refresh_token: tokens.refreshToken },
    }).catch(() => {});
  }
  clearSession();
}

export function getUser(): DealerUser | null {
  hydrate();
  return current;
}

const PENDING: unique symbol = Symbol("auth-pending");

/**
 * This is a client-only SPA (no SSR), so localStorage is always available once
 * mounted -- but the very first render (before any effect has run) still needs a
 * state distinct from "confirmed logged out" so route guards can wait for hydration
 * instead of bouncing straight to /login on every page load.
 */
export function useAuth() {
  const snapshot = useSyncExternalStore<DealerUser | null | typeof PENDING>(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => getUser(),
    () => PENDING,
  );
  const authPending = snapshot === PENDING;
  const user = authPending ? null : snapshot;
  return { user, authPending, requestOtp, verifyOtp, signOut };
}

/** For api/*.ts callers: the current access token, refreshing first if needed. Throws
 * if there's no session at all (callers should already be behind ProtectedRoute). */
export async function authToken(): Promise<string> {
  const token = await ensureFreshAccessToken();
  if (!token) throw new ApiError("Not signed in.", 401);
  return token;
}

/** Every dealer_portal_api/dealer_api call needs a Bearer token -- this is the one
 * place that injects it, so every src/api/*.ts wrapper stays a plain one-liner. */
export async function authedCall<T>(
  path: string,
  opts: AuthedCallOptions = {},
): Promise<T> {
  const token = await authToken();
  return callMethod<T>(path, { ...opts, token });
}
