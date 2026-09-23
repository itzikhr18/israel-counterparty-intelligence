# Service status — 23 September 2026

Canonical short status for buyers and agents: **[STATUS.md](/STATUS.md)**.

Paid reports and x402 Mainnet payments are **available** again after commercial-readiness / Bazaar resume approval. Free previews remain available. Public commercial posture: **MAINNET LIVE — awaiting first EXTERNAL paid call** (no fake logos; no claimed paid volume).

- Unpaid requests to paid Mainnet routes return HTTP **402** with an x402 v2 `PAYMENT-REQUIRED` challenge (not 503).
- Paid MCP tools again advertise payment metadata when a purchase is required.
- Wallet handoff preparation is available again for buyer-controlled wallets.
- Facilitator: authenticated Coinbase CDP on Base Mainnet (`eip155:8453`).
- Security hardenings from the 7 September 2026 containment release remain in place (bounded JSON, public-manifest SSRF controls, facilitator settlement checks, rate-limit identity hardening). See `docs/SECURITY_CONTAINMENT_2026-09-07.md`.
- Published prices and buyer examples describe live purchasable routes. Confirm live status before paying.
- Cheapest paid inspect path: company-changes at **$0.01** USDC — see [STATUS.md](/STATUS.md) and [agents.md](/agents.md) for the exact curl (`{}` body ok). Receiving-wallet self-pay is never counted as External Paid #1.

## 402 Index / discovery notes (23 Sep 2026 IDT)

- Live unpaid POSTs to `/v1/verify/mainnet`, `/v1/payment-risk/mainnet`, `/v1/company-changes/mainnet`, and `/v1/invoice-gate/mainnet` return **402** with Base Mainnet USDC (`eip155:8453`) requirements. `/health` reports `paid_service_suspended: false`.
- During the paid-service suspension window, those routes returned **HTTP 503**, which 402 Index recorded as **DOWN** (39 consecutive failures; last 503 probe ~23:14 UTC on 22 Sep 2026). That was expected containment behavior, not a broken challenge shape.
- After resume, a 402 Index re-register probe observed **HTTP 402**, parsed `accepts[]` (exact / Base Mainnet USDC / known asset), and flipped listing health to **healthy**. `x402_payment_valid` may lag one indexer cycle even when verification reports `assetKnown: true`.
- Coinbase Bazaar may still show a stale Sepolia `/v1/verify` row until a **genuine external** Mainnet settlement is indexed. Do **not** fake a paid call or spend operator Mainnet USDC just to refresh catalogs.
- Resource `description` strings in `PAYMENT-REQUIRED` are capped at **500 characters** so CDP `/verify` does not reject echoed `resource.description` (known facilitator schema limit).

Do not send funds outside the x402 challenge flow. Machine-readable status: [/health](/health) and [x402 discovery](/.well-known/x402).

<!-- Discovery / indexer operational notes (402 Index, Bazaar lag, facilitator description caps) may be appended below by the parallel fix branch without removing the STATUS.md link above. -->
