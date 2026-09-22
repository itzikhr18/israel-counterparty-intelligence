# OEM / design-partner one-pager

## Israel Counterparty Intelligence → DOKKA / Procee-class AP platforms

**Audience:** Product / partnerships at Israeli AP, procurement, or ERP-adjacent platforms (e.g. DOKKA, Procee, Priority integrators).  
**From:** Itzik Harush · itzikhr18@gmail.com · https://israel-counterparty-intelligence.vercel.app  
**Commercial status (honest):** Base Mainnet live via x402. **Awaiting first external paid call.** No customer logos. No claimed paid volume.

---

### The problem you already own

Israeli B2B AP is under pressure from **Israel Invoices / allocation numbers** (threshold now **over ₪5,000** for many authorized-dealer flows, with date-banded policy) plus agentic and automated payment paths. Humans get SaaS UX. **Agents need a deterministic jurisdiction gate** before USDC or bank rails move.

### What we sell (embeddable)

A **Verified Payee / invoice payment gate** for Israeli suppliers:

1. Free structural preview (VAT math + allocation applicability using buyer-attested conditions).
2. Paid gate returns **`PAY` / `HOLD` / `BLOCK`** with reason codes and public **Companies Registry** evidence.
3. Adjacent tools: company verification (**$0.05**), company changes (**$0.01**), vendor payment-risk (**$0.10**), invoice gate (**$0.25**) — Base Mainnet USDC, x402 v2, MCP + REST, **no API key**.

**Not claimed:** independent Tax Authority authentication of buyer-supplied allocation results; bank-account ownership; sanctions/PEP/UBO; credit scoring; legal advice.

### Why OEM instead of competing head-on

| You (DOKKA / Procee-class)             | Us                                             |
| -------------------------------------- | ---------------------------------------------- |
| Capture, match, ERP workflow, human AP | Micropay + agent-native PAY/HOLD/BLOCK         |
| Allocation / ITA workflows inside SaaS | Cheap pre-pay evidence for agents & automation |
| MRR seats                              | Spot x402 **or** monthly OEM embed             |

We are a **pre-payment intelligence sidecar**, not a replacement AP suite.

### Suggested commercial frame (discussion only)

| Package            | Indicative price                | Includes (negotiable)                                                                                                                                            |
| ------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Design partner** | Soft / credits                  | Sandbox + Mainnet MCP endpoint, joint success criteria, no exclusivity                                                                                           |
| **Platform / OEM** | **$1,500–$4,000 / month**       | Embed `authorize_israeli_invoice_payment_paid` (and optional verify/changes/risk), policy knobs, audit-oriented response shape, named slack/email, roadmap input |
| **Usage**          | Pass-through or prepaid credits | Keep agent x402 spot pricing public; OEM can resell under your SKU                                                                                               |

Prices are **proposals for conversation**, not a published rate card and not a claim of existing OEM revenue.

### Integration sketch (one afternoon)

- MCP: `https://israel-counterparty-intelligence.vercel.app/mcp`
- REST: `POST /v1/invoice-gate/mainnet` (and free `/v1/invoice-gate/preview`)
- Metadata: `/mcp.json`, `/.well-known/x402`, `/STATUS.md`
- Buyer wallet / agent: your runtime signs x402 terms, or we prepare private request JSON after free supplier match (`/trusted-wallet-guide.md`)

### Proof points you can verify yourself (no sales deck theater)

```bash
curl -s https://israel-counterparty-intelligence.vercel.app/health
curl -i https://israel-counterparty-intelligence.vercel.app/v1/company-changes/mainnet \
  -H 'content-type: application/json' \
  --data '{"company_number":"514744887","lookback_days":30,"limit":5,"language":"en"}'
```

Expect **HTTP 402** until a real buyer wallet pays **$0.01**. That is intentional.

### Ask

30-minute design-partner call: (1) where a HOLD should block payout in your workflow, (2) whether OEM MRR or pure pass-through x402 fits your packaging, (3) success metric for a 2–4 week embed pilot.

**Contact:** itzikhr18@gmail.com · GitHub `itzikhr18/israel-counterparty-intelligence`
