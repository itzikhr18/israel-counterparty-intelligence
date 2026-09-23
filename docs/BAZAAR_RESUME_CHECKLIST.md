# Coinbase Bazaar resume checklist

## Why readiness CI failed under suspension

Coinbase Bazaar `validate_endpoint` requires unpaid `POST` to return **HTTP 402** with a valid x402 v2 `PAYMENT-REQUIRED` challenge (accepts, network, asset, amount, payTo, Bazaar extension).

While suspended, production returned **HTTP 503** with `PAID_SERVICE_SUSPENDED` for all paid Mainnet routes: `src/lib/service-availability.ts` hard-coded `PAID_SERVICE_SUSPENDED = true` (see `docs/SECURITY_CONTAINMENT_2026-09-07.md`). Discovery at `/.well-known/x402` advertised `endpoints: []`.

That was **not** a wrong URL, CORS, or CI script bug. Catalog / buyer discoverability stays blocked until this resume release is merged, deployed, and verified.

## Safe local confirmation (no payment)

```bash
curl -sS -D - -o /tmp/body.json -X POST \
  https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet \
  -H 'content-type: application/json' --data '{}'
# Expect while suspended: HTTP 503 + {"error":{"code":"PAID_SERVICE_SUSPENDED",...}}

npm run bazaar:check
# Expect valid/accepted=false and a console diagnosis pointing at suspension.
```

After resume, the same unpaid POST must return **402** and `PAYMENT-REQUIRED` (do not send Mainnet USDC during this check).

## Resume gates (user / operator only)

Do **not** resume by toggling `X402_*` env alone. The containment release keeps suspension independent of those flags.

1. Written commercial-readiness / launch approval covering hosting, legal/accounting, privacy, and payment-record requirements listed in `docs/SECURITY_CONTAINMENT_2026-09-07.md`. **Operator approval recorded 23 September 2026 (itzikhr18 / יצחק): reopen Mainnet payments per this checklist.**
2. Confirm Vercel env for Mainnet (not committed secrets):
   - `X402_MAINNET_ENABLED=true`
   - `X402_MAINNET_PAY_TO` = intended receiving wallet
   - `X402_MAINNET_NETWORK=eip155:8453`
   - `X402_MAINNET_ASSET` = Base Mainnet USDC
   - Facilitator: CDP credentials present if `X402_MAINNET_FACILITATOR_PROVIDER` is `cdp` or `auto` with keys configured
3. Open a reviewed release that sets `PAID_SERVICE_SUSPENDED = false` in `src/lib/service-availability.ts`, updates `public/service-status.md`, `public/llms.txt`, and landing copy, and keeps security hardenings from the containment commit.
4. Deploy to Vercel. Verify unpaid POST returns **402** (not 503) on:
   - `/v1/invoice-gate/mainnet`
   - `/v1/company-changes/mainnet`
   - `/v1/verify/mainnet`
   - `/v1/payment-risk/mainnet`
5. Confirm `/.well-known/x402` lists those resources again (`paid_service_suspended: false`).
6. Run `npm run bazaar:check` and re-dispatch **Coinbase Bazaar readiness**. Aim for `valid` + `accepted`; indexing/active may lag until a conforming facilitator settlement occurs (first genuine external paid call — not an operator self-payment).
7. Keep free previews working; do not advertise purchasable routes until step 4 passes.

## Out of scope for a CI-only fix

Secrets, Vercel project settings, Coinbase CDP account linkage, and legal/commercial approval cannot be completed from the readiness workflow alone.

## GoPlausible / Bazaar enrichment (post-listing branding)

Listing still requires one successful CDP-facilitated settlement that echoes `extensions.bazaar`. Enrichment is separate and free: GoPlausible (and similar agent crawlers) read root HTML metadata plus well-known agent files from the **same origin** as the paid endpoints.

Required probes (must be real JSON/text, never SPA `index.html`):

- `GET /` with generic `Accept: */*` → `text/html` including `og:title` / `og:description`
- `GET /.well-known/x402`
- `GET /.well-known/agent-card.json`
- `GET /.well-known/agent.json`
- `GET /.well-known/ai-plugin.json`
- `GET /.well-known/mcp.json`
- `GET /llms.txt`

Operator check: `npm run bazaar:check` (includes enrichment probes after the CDP validate loop).
