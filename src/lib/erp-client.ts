/**
 * Thin client for the dms_erp Frappe backend's whitelisted-method calling convention.
 * See DmsErpService/docs/API.md ("Dealer Portal" section) for the endpoint map this
 * talks to. Mirrors the staff app's (pacific-tileflow) lib/erp-client.ts byte-for-byte
 * on purpose -- both apps talk to the same backend calling convention, so there's no
 * reason for the low-level transport to diverge.
 */

export function apiBase(): string | null {
  const raw = import.meta.env.VITE_ERP_API_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

export function isApiConfigured(): boolean {
  return apiBase() !== null;
}

export class ApiError extends Error {
  httpStatus: number;
  exceptionType: string | null;

  constructor(
    message: string,
    httpStatus: number,
    exceptionType: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.httpStatus = httpStatus;
    this.exceptionType = exceptionType;
  }
}

type CallOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  params?: Record<string, unknown>;
  token?: string | null;
};

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function extractServerMessage(body: unknown): string | null {
  if (body === null || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const raw = record["_server_messages"];
  if (typeof raw !== "string") return null;
  try {
    const outer = JSON.parse(raw) as unknown[];
    const first = outer[0];
    if (typeof first !== "string") return null;
    const inner = JSON.parse(first) as { message?: string };
    return inner.message ?? null;
  } catch {
    return null;
  }
}

/**
 * Shared by callMethod and uploadFile — parses the raw fetch Response, throws ApiError on a
 * non-OK status (unwrapping Frappe's server message when present), and unwraps the
 * `{"message": ...}` envelope on success when present, otherwise returns the body as-is.
 */
async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Non-JSON body (an HTML error page from a proxy/gateway, a plain-text 502, etc.) --
      // there's no server message to extract, so this is the same fallback the !res.ok
      // branch below would produce for a body that parsed to something message-less.
      throw new ApiError(`Request failed (${res.status})`, res.status);
    }
  }

  if (!res.ok) {
    const serverMessage = extractServerMessage(parsed);
    const record =
      parsed !== null && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    const exceptionType =
      typeof record["exc_type"] === "string" ? record["exc_type"] : null;
    const fallback =
      typeof record["exception"] === "string"
        ? record["exception"]
        : `Request failed (${res.status})`;
    throw new ApiError(serverMessage ?? fallback, res.status, exceptionType);
  }

  if (
    parsed !== null &&
    typeof parsed === "object" &&
    "message" in (parsed as Record<string, unknown>)
  ) {
    return (parsed as Record<string, unknown>)["message"] as T;
  }
  return parsed as T;
}

/**
 * Calls one whitelisted method.
 */
export async function callMethod<T>(
  path: string,
  opts: CallOptions = {},
): Promise<T> {
  const base = apiBase();
  if (!base) {
    throw new ApiError("VITE_ERP_API_BASE_URL is not configured.", 0);
  }
  const method = opts.method ?? "GET";
  const params = opts.params ?? {};
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  let url = `${base}/api/method/${path}`;
  const init: RequestInit = { method, headers };
  if (method === "GET") {
    url += toQueryString(params);
  } else {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(params);
  }

  const res = await fetch(url, init);
  return handleResponse<T>(res);
}

/**
 * Some list endpoints on this backend return a bare array; others return a paginated envelope
 * (`{ items, total, limit, offset }`). Normalize either shape to a plain array so callers don't
 * crash calling `.find`/`.map` on a non-array.
 */
export function unwrapList<T>(res: T[] | { items: T[] }): T[] {
  return Array.isArray(res) ? res : res.items;
}
