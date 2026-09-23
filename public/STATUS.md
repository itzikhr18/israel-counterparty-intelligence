# STATUS — Israel Counterparty Intelligence

**Updated:** 23 September 2026 (Asia/Jerusalem)  
**Live site:** https://israel-counterparty-intelligence.vercel.app  
**Rule:** No fake customer logos. No claimed paid volume until External Paid Call #1 settles.

## Current posture

| Signal                 | Value                                                                |
| ---------------------- | -------------------------------------------------------------------- |
| Commercial status      | **MAINNET LIVE — awaiting first EXTERNAL paid call**                 |
| Paid service suspended | `false` (confirm live `/health`)                                     |
| Facilitator            | Authenticated Coinbase CDP (`api.cdp.coinbase.com/platform/v2/x402`) |
| Network                | Base Mainnet `eip155:8453`                                           |
| Asset                  | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`                    |
| Receiving wallet       | `0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82`                         |
| Protocol               | x402 v2                                                              |

Machine-readable checks:

- Health JSON: [/health](https://israel-counterparty-intelligence.vercel.app/health)
- x402 discovery: [/.well-known/x402](https://israel-counterparty-intelligence.vercel.app/.well-known/x402)
- MCP metadata: [/mcp.json](https://israel-counterparty-intelligence.vercel.app/mcp.json)
- Agent-oriented summary: [/llms.txt](https://israel-counterparty-intelligence.vercel.app/llms.txt)
- Longer ops note: [/service-status.md](https://israel-counterparty-intelligence.vercel.app/service-status.md)

Unpaid POSTs to paid Mainnet routes must return **HTTP 402** with `PAYMENT-REQUIRED` (not 503).

## Live prices (Base Mainnet USDC)

| Product                    | Endpoint                           | Price     |
| -------------------------- | ---------------------------------- | --------- |
| Company changes (cheapest) | `POST /v1/company-changes/mainnet` | **$0.01** |
| Company verification       | `POST /v1/verify/mainnet`          | **$0.05** |
| Vendor payment risk        | `POST /v1/payment-risk/mainnet`    | **$0.10** |
| Invoice payment gate       | `POST /v1/invoice-gate/mainnet`    | **$0.25** |

Free (no wallet): invoice structural preview, company identity preview, `preview_agent_payment_trust`.

## Bazaar / discovery readiness

- Coinbase Bazaar commercial-readiness resume was approved; paid charging is on.
- HTTP + MCP `extensions.bazaar` declarations validate with CDP (`valid` + simulation `accepted`). Catalog `indexed/active` still waits for the first **external** Mainnet settlement that echoes the bazaar extension (do not operator-self-pay).
- GoPlausible-style enrichment files are published on this origin (real JSON/text, not SPA HTML): `/.well-known/agent-card.json`, `/.well-known/agent.json`, `/.well-known/ai-plugin.json`, `/.well-known/mcp.json`, plus `/.well-known/x402` and `/llms.txt`. Generic `Accept` on `/` returns HTML with OpenGraph tags for crawler branding.
- Operator check (repo): `npm run bazaar:check` / `scripts/bazaar-readiness.mjs` against production (includes enrichment probes).

## How a buyer makes the first $0.01 call

Cheapest honest path = **company-changes** at **$0.01 USDC**.

1. Confirm health is green and `paid_service_suspended` is false:
   ```bash
   curl -s https://israel-counterparty-intelligence.vercel.app/health
   ```
2. Inspect the payment challenge **without paying** (expect HTTP 402):
   ```bash
   curl -i https://israel-counterparty-intelligence.vercel.app/v1/company-changes/mainnet \
     -H 'content-type: application/json' \
     --data '{"company_number":"514744887","lookback_days":30,"limit":5,"language":"en"}'
   ```
3. Pay only with a **buyer-controlled** x402-capable wallet that enforces the returned terms. Guides:
   - [x402 buyer quickstart](https://israel-counterparty-intelligence.vercel.app/x402-buyer-quickstart.md)
   - [Trusted / independent wallet guide](https://israel-counterparty-intelligence.vercel.app/trusted-wallet-guide.md)
   - Optional bridge package: `npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz`
4. MCP equivalent: connect to `https://israel-counterparty-intelligence.vercel.app/mcp` and call `get_israeli_company_changes_paid` (preferred first-paid MCP tool).

A successful **external** settlement (non-operator wallet) is External Paid Call #1.

## Marketplace canary readiness

- Listed on PayAPI Market (form accepted; awaiting their wallet canary).
- Challenge fields: HTTP **402**, Base Mainnet USDC, `extra.name` = `USD Coin`, `payTo` = operator receiving wallet.
- `POST /v1/company-changes/mainnet` with `{}` or omitted `company_number` uses public sample **514744887** so a paid canary still returns product (not a validation 400).
- Do **not** self-pay from the operator wallet; External Paid Call #1 must be an external payer.

## What we do **not** claim

- Customer logos, case studies, or ARR/MRR traction.
- Independent Israel Tax Authority authentication of buyer-supplied allocation results.
- Bank-account ownership, sanctions/PEP/UBO, credit scoring, or legal advice.
