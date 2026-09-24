# Project status — Israel Counterparty Intelligence (ICI)

**Updated:** 2026-09-24 ~14:30 Asia/Jerusalem  
**Audience:** any engineer, partner, or agent picking up this repo  
**Owner:** Itzik Harush (`itzikhr18@gmail.com`) · GitHub `itzikhr18`

This is the **canonical ops snapshot**. Prefer it over chat history. Re-check live `/health` and `/proof` before acting.

---

## 1. What this product is

Agent-native **Israeli supplier invoice gate**: before paying an Israeli counterparty, return **PAY / HOLD / BLOCK** with public Companies Registry evidence over **MCP + x402** (Base Mainnet USDC via Coinbase CDP). No API key. No subscription.

**Honesty rules (non-negotiable):**

- No fake customer logos / inflated volume
- No “we verified with the Tax Authority” claims (buyer-attested allocation only)
- **Never self-pay** from the receiving wallet — only external payers count

---

## 2. Live pointers

| What                                 | URL                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| Production host                      | https://israel-counterparty-intelligence.vercel.app/                             |
| Health (source of truth for settles) | https://israel-counterparty-intelligence.vercel.app/health                       |
| Settlement proof page                | https://israel-counterparty-intelligence.vercel.app/proof                        |
| 60-second buyer path                 | https://israel-counterparty-intelligence.vercel.app/buy                          |
| Partner one-pager                    | https://israel-counterparty-intelligence.vercel.app/partner                      |
| Public STATUS                        | https://israel-counterparty-intelligence.vercel.app/STATUS.md                    |
| MCP (streamable HTTP)                | https://israel-counterparty-intelligence.vercel.app/mcp                          |
| MCP metadata                         | https://israel-counterparty-intelligence.vercel.app/mcp.json                     |
| Glama connector (owned)              | https://glama.ai/mcp/connectors/io.github.itzikhr18/israel-business-intelligence |
| Repo                                 | https://github.com/itzikhr18/israel-counterparty-intelligence                    |

Start-here docs in-repo:

1. [PARTNER_HANDOFF.md](../PARTNER_HANDOFF.md) — partner entry
2. [docs/OUTREACH_CRM.md](./OUTREACH_CRM.md) — who was emailed / waiting
3. [docs/DISCOVERY_STATUS.md](./DISCOVERY_STATUS.md) — directories / discovery
4. [docs/REPLY_TEMPLATES.md](./REPLY_TEMPLATES.md) — reply kit
5. [docs/SYSTEM_MAP.md](./SYSTEM_MAP.md) — routes / deploy
6. [docs/ICP_RESEARCH.md](./ICP_RESEARCH.md) — who would actually pay, and why the x402 rail filters them out

---

## 3. Payments — current facts (from live `/health`)

| Signal                        | Value                                                                |
| ----------------------------- | -------------------------------------------------------------------- |
| Commercial charging           | **ON** (`paid_service_suspended: false`)                             |
| Facilitator                   | Coinbase CDP                                                         |
| Network                       | Base Mainnet `eip155:8453`                                           |
| Receiving wallet              | `0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82`                         |
| **First external paid call**  | **DONE + durable** (`source: env`)                                   |
| Amount / route                | **0.01 USDC** · `POST /v1/company-changes/mainnet`                   |
| TX                            | `0x5b68756c1b1713e46c5d137c91c92df3d1e2e4e71e83c7025a8b833a077bbbbd` |
| External payer                | `0x7e6b6556322c4e26c567a867964ac793f5ee2b1c`                         |
| Settled at (on-chain)         | **2026-09-23T09:57:29Z** · Base block 51684051                       |
| **Second external paid call** | **null** — still open                                                |
| Recommended 2nd path          | `POST /v1/verify/mainnet` → HTTP 402 → **0.05 USDC**                 |

After a real second external settle, set Vercel env `SECOND_EXTERNAL_PAID_CALL_TX` (and companion fields if used) so `/health` stays durable across cold starts.

Known drift: Vercel env `FIRST_EXTERNAL_PAID_CALL_AT` was pasted as `2026-09-21T21:12:09Z`, but the block timestamp of the TX above is `2026-09-23T09:57:29Z` (verified via `eth_getTransactionReceipt` + `eth_getBlockByNumber` on `mainnet.base.org`). Until the env is corrected and production redeployed, `/health` and `/proof` show the wrong date.

---

## 4. Paid price card (Mainnet USDC)

| Product                     | Endpoint                           | Price     |
| --------------------------- | ---------------------------------- | --------- |
| Company changes (cheapest)  | `POST /v1/company-changes/mainnet` | **$0.01** |
| Company verify (2nd canary) | `POST /v1/verify/mainnet`          | **$0.05** |
| Payment risk                | `POST /v1/payment-risk/mainnet`    | **$0.10** |
| Invoice gate                | `POST /v1/invoice-gate/mainnet`    | **$0.25** |

Unpaid POSTs must return **HTTP 402** with a real x402 challenge (not 503).

---

## 5. Discovery / listings (2026-09-23 evening)

| Surface                                                  | Status                        | Notes                                                                                                                                                                                  |
| -------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official MCP Registry                                    | Live **1.8.2**                | `io.github.itzikhr18/israel-business-intelligence`                                                                                                                                     |
| Glama connector                                          | **Ownership verified**        | Claimed via GitHub + `/.well-known/glama.json`; Frank notified for refresh                                                                                                             |
| Agent Tools                                              | Re-crawl verified $0.01 + MCP | Discovery copy inconsistency fixed; no paid trial expected                                                                                                                             |
| Agent402 (Mike)                                          | Indexed (9 tools)             | Will **not** fund paid trial until `payTo` has seller settlement history from their router — treat paid-canary asks as **closed**                                                      |
| PayAPI / GoPlausible / Mesh / Dokka / Cardcom / Aerchain | Cooling / waiting             | No same-day spam; use reply templates if they answer                                                                                                                                   |
| Grow (Yaki)                                              | **Call proposed: Sun 27.09**  | Yaki (sales) asked for a convenient time on Sunday 24.09 13:37 IDT; we owe a reply. Grow is receiving-side acquiring, not a product partner — see [ICP_RESEARCH.md](./ICP_RESEARCH.md) |
| Upstash Redis                                            | **Blocked**                   | Needs user REST URL + token for auto-durable next settles                                                                                                                              |
| Agent402 seller-payability (~$0.10)                      | **Blocked**                   | Needs funded **buyer** wallet ≠ receiving wallet                                                                                                                                       |

Glama claim file (keep published): `public/.well-known/glama.json` →  
https://israel-counterparty-intelligence.vercel.app/.well-known/glama.json

---

## 6. What to do next (priority order)

### P0 — business-moving

1. **Land second external Mainnet settle** ($0.05 verify path preferred) from a non-receiving wallet; lock on `/health`.
2. **Reply to Grow/Yaki with a Sunday 27.09 time** (Chol HaMoed Sukkot: propose a morning slot + alternative). Goal of the call: learn + referral, not a deal — prep in [ICP_RESEARCH.md](./ICP_RESEARCH.md) §5.
3. **Answer human replies within hours** using [REPLY_TEMPLATES.md](./REPLY_TEMPLATES.md); do not re-cold Mesh/Dokka/Cardcom/Aerchain/PayAPI/GoPlausible while cooling.

### P1 — durability / discovery

4. If credentials arrive: connect **Upstash** so the next settle auto-durables without env paste.
5. Confirm Glama listing refresh after Frank’s pass (payments-live / $0.01 path).
6. Optional browser submits still open: Smithery, mcpservers.org (see [MCP_DIRECTORY_SUBMISSIONS.md](./MCP_DIRECTORY_SUBMISSIONS.md)).

### Explicitly do **not**

- Self-pay from `0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82`
- Mass directory / cold-email spam
- Send link-bearing partner emails through the Claude Gmail connector: it rewrites **every** URL (even a bare `host/path`) to `https://www.google.com/url?q=…&source=gmail&ust=…` at compose time, in both the text and HTML parts. Verified on a throwaway draft 2026-09-23. GoPlausible flagged this pattern as suspicious. Send those from the Gmail web UI instead.
- Re-ask Agent402 for a paid canary

---

## 7. How to verify you’re looking at production

```bash
curl -s https://israel-counterparty-intelligence.vercel.app/health | jq '.payments | {paid_service_suspended, first_external_paid_call, second_external_paid_call}'
curl -sI https://israel-counterparty-intelligence.vercel.app/v1/company-changes/mainnet \
  -H 'content-type: application/json' --data '{}' | head -5   # expect HTTP 402
curl -s https://israel-counterparty-intelligence.vercel.app/.well-known/glama.json
```

---

## 8. Change log (ops, not product)

| When (IDT)         | Change                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-24 midday  | Grow/Yaki proposed a Sunday 27.09 call; ICP research written (`docs/ICP_RESEARCH.md`): paying segments need API key + ₪/$ billing, not USDC; owner has no external wallet, so the second settle cannot be manufactured honestly |
| 2026-09-23 night   | CI unblocked: 6 Markdown docs re-formatted with Prettier (`format:check` was the only failing step)                                                                                                                             |
| 2026-09-23 night   | First-settle timestamp verified on-chain (`2026-09-23T09:57:29Z`); env `FIRST_EXTERNAL_PAID_CALL_AT` still holds the wrong `2026-09-21` value — see §3                                                                          |
| 2026-09-23 night   | Root cause of Google-wrapped links found: the Gmail connector rewrites URLs on compose — see §6 “do not”                                                                                                                        |
| 2026-09-23 evening | Glama connector **ownership verified**; claim JSON published; Frank emailed for listing refresh                                                                                                                                 |
| 2026-09-23 evening | Removed leftover “awaiting first paid” copy from discovery surfaces (`glama.json` + submission docs)                                                                                                                            |
| 2026-09-23         | First external 0.01 USDC settle durable on `/health` via env; `/proof` + `/buy` live                                                                                                                                            |
| 2026-09-23         | Outreach wave + proof emails; cooling on several directories; Grow human thread open                                                                                                                                            |

When you change production posture, **update this file the same day** and bump the timestamp at the top.
