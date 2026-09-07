# Service status — 7 September 2026

Paid reports and x402 payments are temporarily suspended pending commercial-readiness review. Free previews remain available. Do not sign or send a payment.

- All seven paid REST routes return HTTP 503 with `PAID_SERVICE_SUSPENDED`, without payment requirements or report data. This applies to mainnet and testnet, unsigned requests and requests carrying payment headers.
- All five paid MCP tool names, including the `verify_company` alias, return an error without a payment challenge. The mainnet and testnet tool lists retain all 13 names.
- Free invoice checks, limited previews, sample reports and schemas remain available. An invitation-only pilot remains separately authenticated; suspension does not grant pilot access.
- Published prices, schemas and buyer examples are reference material while service is suspended. They do not mean that purchases are available.
- The suspension is independent of x402 environment flags. Resumption requires a separately reviewed release after the outstanding hosting, legal/accounting, security and payment-record requirements are closed.

The application cannot prevent a person from transferring funds directly on a blockchain. Do not transfer funds to a previously advertised address. No successful settlement or commercial readiness is claimed by this status page.

Machine-readable current status: [/health](/health) and [service manifest](/?format=json).
