# Agents — Israel Counterparty Intelligence

Short, copy-pasteable guide for AI agents and marketplace canaries.

**Live:** https://israel-counterparty-intelligence.vercel.app  
**Status:** MAINNET LIVE — first external paid call confirmed (do not pay from the receiving wallet). Proof: /proof.

## Discover

| What                            | URL                            |
| ------------------------------- | ------------------------------ |
| Health (honest payments status) | `/health`                      |
| x402 discovery                  | `/.well-known/x402`            |
| MCP streamable HTTP             | `/mcp`                         |
| MCP metadata                    | `/mcp.json`                    |
| Agent card                      | `/.well-known/agent-card.json` |
| llms.txt                        | `/llms.txt`                    |
| STATUS                          | `/STATUS.md`                   |
| OpenAPI                         | `/openapi.json`                |

Free MCP metadata: call `describe_service` — it exposes `preferred_first_paid_path` → company-changes at **$0.01 USDC**.

## Preferred first paid path ($0.01)

- **REST:** `POST /v1/company-changes/mainnet`
- **MCP tool:** `get_israeli_company_changes_paid`
- **Network:** Base Mainnet `eip155:8453`
- **Asset:** USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Pay to (receiving wallet):** `0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82`
- **Facilitator:** Coinbase CDP
- **Amount:** `10000` atomic (= $0.01 USDC)
- **Empty body OK:** `{}` defaults `company_number` to public sample `514744887`

### 1) Challenge (expect HTTP 402)

```bash
curl -i https://israel-counterparty-intelligence.vercel.app/v1/company-changes/mainnet \
  -H 'content-type: application/json' \
  --data '{}'
```

Read `PAYMENT-REQUIRED` (header) or the JSON body (full PaymentRequired + `extensions.bazaar` + `canary` hints).

### 2) Pay and retry

1. Sign the exact x402 v2 terms with a **buyer-controlled** wallet.
2. Retry the **identical** POST with the payment signature header your client uses.
3. Never settle from the receiving/operator wallet — those payments are rejected as “external.”

Optional buyer bridge:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz
```

Guides: `/x402-buyer-quickstart.md` · `/trusted-wallet-guide.md`

## Other paid Mainnet products

| Product              | Endpoint                        | Price |
| -------------------- | ------------------------------- | ----- |
| Company verification | `POST /v1/verify/mainnet`       | $0.05 |
| Vendor payment risk  | `POST /v1/payment-risk/mainnet` | $0.10 |
| Invoice payment gate | `POST /v1/invoice-gate/mainnet` | $0.25 |

Free (no wallet): invoice preview, company preview, `preview_agent_payment_trust`.

## Honesty boundaries

- No Tax Authority calls; buyer-attested TA results are never presented as independently authenticated.
- No fake customer logos. First external paid call is confirmed (see /proof); do not invent extra volume.
- Confirm `/health` → `paid_service_suspended: false` and unpaid paid-routes return **402** (not 503) before paying.
