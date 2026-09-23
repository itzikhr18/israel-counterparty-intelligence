# Partner Handoff — Israel Counterparty Intelligence (ICI)

**Updated:** 2026-09-23 (Asia/Jerusalem)  
**Owner:** Itzik Harush (`itzikhr18@gmail.com`)  
**Repo:** https://github.com/itzikhr18/israel-counterparty-intelligence  
**Live:** https://israel-counterparty-intelligence.vercel.app/

This is the **single entry document** for a partner or helper. Start here, then open:

- [docs/OUTREACH_CRM.md](./docs/OUTREACH_CRM.md) — who we emailed, who we wait on
- [docs/SYSTEM_MAP.md](./docs/SYSTEM_MAP.md) — routes, payments, deploy
- Public status: https://israel-counterparty-intelligence.vercel.app/STATUS.md

---

## מה המוצר (עברית)

שער תשלום לסוכני AI / מערכות AP: לפני שמשלמים לספק ישראלי, השירות בודק זהות חברה מול רשם החברות הציבורי ומחזיר PAY / HOLD / BLOCK על חשבונית (מע״מ, מספר הקצאה לפי הקשר קונה — **בלי** לטעון אימות רשות המסים עצמאי). התשלום ל־API הוא **x402** ב־**Base Mainnet** ב־USDC דרך **Coinbase CDP**. אין מנוי ואין API key.

---

## Live URLs

| What | URL |
| --- | --- |
| Site | https://israel-counterparty-intelligence.vercel.app/ |
| Health (JSON) | https://israel-counterparty-intelligence.vercel.app/health |
| Settlement proof | https://israel-counterparty-intelligence.vercel.app/proof |
| Public STATUS | https://israel-counterparty-intelligence.vercel.app/STATUS.md |
| MCP | https://israel-counterparty-intelligence.vercel.app/mcp |
| MCP metadata | https://israel-counterparty-intelligence.vercel.app/mcp.json |
| x402 discovery | https://israel-counterparty-intelligence.vercel.app/.well-known/x402 |
| Cheapest paid ($0.01) | `POST /v1/company-changes/mainnet` |
| Second canary ($0.05) | `POST /v1/verify/mainnet` |
| Buyer quickstart | https://israel-counterparty-intelligence.vercel.app/x402-buyer-quickstart.md |

---

## מצב עסקי עכשיו (2026-09-23)

| Signal | Status |
| --- | --- |
| Mainnet charging | **ON** (Coinbase CDP facilitator) |
| First external paid call | **DONE + durable** |
| Amount / network | **0.01 USDC** on Base (`eip155:8453`) |
| TX | `0x5b68756c1b1713e46c5d137c91c92df3d1e2e4e71e83c7025a8b833a077bbbbd` |
| Proof page | Live at `/proof` (BaseScan links, external-payer framing) |
| Second external paid call | **NOT YET** (`/health.payments.second_external_paid_call = null`) |
| Optional second path | `POST /v1/verify/mainnet` → HTTP 402 for **0.05 USDC** |
| Receiving wallet | `0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82` |
| Fake logos / inflated volume | **Never claimed** |

**Hard rule:** never pay from the receiving/operator wallet (“self-pay”). Only external payers count.

---

## What we shipped recently (same day)

1. Durable first external settle recorded on `/health` (env-backed).
2. Top-tier `/proof` page (live status from `/health`, BaseScan TX/payer/receiver).
3. Fixed dishonest public copy that still said “awaiting first paid” (STATUS, mcp.json, llms, landing, well-known).
4. CI green after Prettier on proof files.
5. `/health` can show `second_external_paid_call` via `SECOND_EXTERNAL_PAID_CALL_TX` after a real second settle.
6. Second-settle ($0.05) outreach sent to Mesh, Dokka, Cardcom, Aerchain, Agent402 Mike (see CRM).

---

## Architecture (short)

- **App:** Next.js on **Vercel**
- **Payments:** x402 v2 → Coinbase CDP facilitator → Base Mainnet USDC
- **Evidence:** Israeli Companies Registry open data (public), not Tax Authority login
- **Agent surface:** MCP streamable HTTP + HTTP paid routes
- **Discovery:** `/.well-known/x402`, Bazaar extensions in 402 body, `/llms.txt`, agent cards

---

## Env var names (no secrets in this doc)

| Name | Purpose |
| --- | --- |
| `FIRST_EXTERNAL_PAID_CALL_TX` (+ companions) | Durable first settle on `/health` |
| `SECOND_EXTERNAL_PAID_CALL_TX` (+ companions) | Durable second settle on `/health` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional auto-durable store (**not configured yet**) |
| `FIRST_PAID_CALL_WEBHOOK_URL` / `NOTIFY_EMAIL` | Optional notify on first paid |
| CDP / x402 facilitator + pay-to vars | Live charging (set in Vercel; do not paste here) |

---

## Blockers

1. **Second external settle** still missing (waiting on design-partner canaries).
2. **Upstash** not connected → next settles need env paste or process memory until configured.
3. Gmail often wraps URLs — partners must copy **bare hostnames**.

---

## How a partner can help in 48 hours

1. Open `/proof` + `/health` and confirm first TX on BaseScan.
2. Read [docs/OUTREACH_CRM.md](./docs/OUTREACH_CRM.md) — answer any human reply fast; do **not** spam PayAPI/GoPlausible today.
3. If you have a Base USDC wallet that is **not** the receiving wallet: pay once `POST /v1/verify/mainnet` at $0.05, then set `SECOND_EXTERNAL_PAID_CALL_TX`.
4. Optional: create free Upstash Redis and add the two REST env vars on Vercel.
5. Keep honesty: no fake logos, no Tax Authority “we verified” claims, no self-pay.

---

## Deploy / backup

```bash
git clone https://github.com/itzikhr18/israel-counterparty-intelligence.git
cd israel-counterparty-intelligence
npm ci
npm test
# production is Vercel project linked to this repo; push to main deploys
```

This handoff pack is committed on `main` so GitHub is the backup of record.
