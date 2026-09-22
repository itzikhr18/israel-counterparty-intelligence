# Service status — 23 September 2026

Canonical short status for buyers and agents: **[STATUS.md](/STATUS.md)**.

Paid reports and x402 Mainnet payments are **available**. Free previews remain available. Public commercial posture: **MAINNET LIVE — awaiting first EXTERNAL paid call** (no fake logos; no claimed paid volume).

- Unpaid requests to paid Mainnet routes return HTTP **402** with an x402 v2 `PAYMENT-REQUIRED` challenge (not 503).
- Paid MCP tools advertise payment metadata when a purchase is required.
- Wallet handoff preparation is available for buyer-controlled wallets.
- Facilitator: authenticated Coinbase CDP on Base Mainnet (`eip155:8453`).
- Security hardenings from the 7 September 2026 containment release remain in place (bounded JSON, public-manifest SSRF controls, facilitator settlement checks, rate-limit identity hardening). See `docs/SECURITY_CONTAINMENT_2026-09-07.md`.
- Cheapest paid inspect path: company-changes at **$0.01** USDC — see [STATUS.md](/STATUS.md) for the exact curl.

Do not send funds outside the x402 challenge flow. Machine-readable status: [/health](/health) and [x402 discovery](/.well-known/x402).
