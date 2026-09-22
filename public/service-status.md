# Service status — 23 September 2026

Paid reports and x402 Mainnet payments are **available** again after commercial-readiness / Bazaar resume approval. Free previews remain available.

- Unpaid requests to paid Mainnet routes return HTTP **402** with an x402 v2 `PAYMENT-REQUIRED` challenge (not 503).
- Paid MCP tools again advertise payment metadata when a purchase is required.
- Wallet handoff preparation is available again for buyer-controlled wallets.
- Security hardenings from the 7 September 2026 containment release remain in place (bounded JSON, public-manifest SSRF controls, facilitator settlement checks, rate-limit identity hardening). See `docs/SECURITY_CONTAINMENT_2026-09-07.md`.
- Published prices and buyer examples describe live purchasable routes. Confirm live status before paying.

Do not send funds outside the x402 challenge flow. Machine-readable status: [/health](/health) and [x402 discovery](/.well-known/x402).
