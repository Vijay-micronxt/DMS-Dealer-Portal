# Pacific Dealer Portal

Dealer-facing self-service web app (BRD C.13) — mobile-first, phone+OTP login, no
password. Browse the catalog, raise an enquiry, convert an in-stock enquiry to an
order with your own PO number, and track orders/enquiries and outstanding dues.

Talks to the `dms_erp` Frappe backend's **Dealer Portal** API surface
(`dms_erp.auth.dealer_api.*` for login, `dms_erp.sales.dealer_portal_api.*` for
everything else — see `DmsErpService/docs/API.md`'s "Dealer Portal" section for the
full endpoint reference). A dealer-portal session is scoped server-side to that
prefix only; this app never sends a dealer id of its own, the backend always resolves
it from the authenticated session.

## Stack

- Vite + React 19 + TypeScript
- TanStack Router (file-based routes) + TanStack Query
- Tailwind CSS v4
- No SSR — a client-only SPA, appropriate for a mobile web portal behind a login wall

Deliberately mirrors the staff app's (`pacific-tileflow`) `lib/erp-client.ts` calling
convention byte-for-byte, since both apps talk to the same backend. `lib/auth.ts`
follows the same session/token-storage shape but authenticates by phone + OTP instead
of username + password.

## Getting started

```bash
npm install   # or bun install
cp .env.example .env.local
# edit .env.local: VITE_ERP_API_BASE_URL=https://your-site.example.com
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — typecheck, then production build to `dist/`
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint (includes Prettier formatting rules)
- `npm run format` — Prettier write

## Project layout

```
src/
  api/            thin wrappers over dealer_portal_api / dealer_api, one file per area
  components/     AppShell (mobile bottom-nav shell) + components/ui (Button, Input, Card, Badge, Spinner)
  lib/
    erp-client.ts   generic callMethod() wrapper for the Frappe whitelisted-method convention
    auth.ts         phone+OTP session (request_otp/verify_otp), token refresh, useAuth()
    utils.ts        cn(), formatCurrency(), formatDate()
  routes/         TanStack Router file-based routes (login, catalog, catalog/$item,
                  inquiries, inquiries/$id, orders, orders/$id, profile)
```

## Auth model

1. `POST dms_erp.auth.dealer_api.request_otp` — phone number, sends a 6-digit code
   over WhatsApp. Always returns the same response, registered or not.
2. `POST dms_erp.auth.dealer_api.verify_otp` — phone + code + device_id → access/refresh
   token pair, same shape as staff login. `user.dealer` in the response is the
   `Customer` id this session is scoped to.
3. Every subsequent call carries `Authorization: Bearer <access_token>`. The backend's
   middleware confines a dealer-only session to `dealer_api.*`/`dealer_portal_api.*` —
   calling anything else (including the staff `auth.api.me`) is rejected, so this app
   never calls that endpoint; the signed-in dealer's profile comes from
   `dealer_portal_api.my_profile` instead.

## Status

Initial scaffold — the full BRD C.13 flow (catalog browse/search, item detail with
top batches, raise-enquiry, convert-to-order with PO number, enquiry/order history,
dues, profile) is wired against the live API contract in `docs/API.md`. Not yet done:
real device testing, offline/error-boundary polish, and visual design beyond a plain
Tailwind pass.
