# Outreach CRM

**Updated:** 2026-09-25 early morning Asia/Jerusalem  
**Owner inbox:** `itzikhr18@gmail.com`  
**Canonical status:** [PROJECT_STATUS.md](./PROJECT_STATUS.md) · **Reply kit:** [REPLY_TEMPLATES.md](./REPLY_TEMPLATES.md)

**Goal now:** (1) Grow/Yaki call on Sunday 27.09 (learn + referral), (2) Israeli OEM channel: send the three Gmail drafts to Morning / iCount / Sumit from the **web UI** after pasting the partner link, (3) packaging is **done**: a partner API key unlocks all four tools without USDC, onboard with [PILOT.md](./PILOT.md) the same day a partner says yes. The second external settle is now a **passive** metric (owner has no external wallet; do not chase).  
**Do not spam today:** PayAPI, GoPlausible, Mesh, Dokka, Cardcom, Aerchain, Agent402 paid-canary asks.

Status legend: `waiting` · `auto-ack` · `human` · `cooling` · `closed` · `blocked`

## Hot / human

| Party         | Email                               | Last touch | Status    | Next action                                                                                                                          | Notes                                                                                                                                                                                                                                 |
| ------------- | ----------------------------------- | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grow / Yaki   | support@grow.business               | 2026-09-24 | **human** | Wait for Yaki to confirm 10:30 or 12:00 on Sun 27.09 (Chol HaMoed). Calendar hold + call prep already in the owner's Google Calendar | Reply sent 24.09 14:54 IDT proposing both slots, phone or video. Yaki = sales dept. Grow is receiving-side acquiring, not a product partner; possible ₪ payment-link vendor for us later. See [ICP_RESEARCH.md](./ICP_RESEARCH.md) §5 |
| Glama / Frank | frank@glama.ai (+ support@glama.ai) | 2026-09-23 | **human** | Wait listing refresh                                                                                                                 | Connector ownership verified; asked refresh for $0.01 path                                                                                                                                                                            |

## Drafted, not yet sent (owner action: open draft in Gmail web UI, replace `[קישור לדף השותפים]` with `https://israel-counterparty-intelligence.vercel.app/partner`, send)

| Party          | Email                  | Drafted    | Status    | Ask                                                                                                                                                                                    |
| -------------- | ---------------------- | ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Morning        | support@morning.co.il  | 2026-09-24 | **draft** | 20-min product/partnerships call + free pilot token, no crypto                                                                                                                         |
| iCount         | support@icount.co.il   | 2026-09-24 | **draft** | Same                                                                                                                                                                                   |
| SUMIT          | support@sumit.co.il    | 2026-09-24 | **draft** | Same                                                                                                                                                                                   |
| mcpservers.org | contact@mcpservers.org | 2026-09-25 | **draft** | Reply on the approval thread asking to remove or merge the older auto-crawled duplicate entry (stale “suspended” copy). Link-free on purpose; nothing to replace, just review and send |

These are support inboxes (no partnerships address is published); each draft asks to be forwarded. Drafts contain **no URL on purpose**: the Claude Gmail connector wraps even a bare hostname (verified again 2026-09-24 on a throwaway draft, deleted).

## Cooling / waiting (no same-day ping)

| Party           | Email                                       | Last touch | Status          | Next action            | Notes                                        |
| --------------- | ------------------------------------------- | ---------- | --------------- | ---------------------- | -------------------------------------------- |
| Mesh            | support@meshpayments.com                    | 2026-09-23 | waiting         | Wait ≤48h              | $0.05 second-settle + design-partner         |
| Dokka           | info@dokka.com                              | 2026-09-23 | waiting         | Wait ≤48h              | $0.05 design-partner canary                  |
| Cardcom         | support@secure.cardcom.co.il                | 2026-09-23 | auto-ack        | Wait ticket            | $0.01 then $0.05 follow-up                   |
| Aerchain        | support@aerchain.io                         | 2026-09-23 | auto-ack        | Wait ticket **107580** | Auto ack only                                |
| EasyCount / HYP | contact.ez@hyp.co.il, contact@ezcount.co.il | 2026-09-23 | waiting         | Wait ≤48h              | Design-partner + /proof                      |
| Nipendo         | support@nipendo.com                         | 2026-09-23 | auto-ack        | Wait ticket **524795** | Proof follow-up sent                         |
| Tipalti         | contact@tipalti.com                         | 2026-09-23 | waiting         | Wait                   | Israel AP enrichment                         |
| Stampli         | hello@stampli.com                           | 2026-09-23 | waiting         | Wait                   | Design-partner                               |
| Procee          | contact@procee.com                          | 2026-09-23 | waiting         | Wait                   | $0.01 follow-up                              |
| GoPlausible     | info@goplausible.com                        | 2026-09-23 | human + cooling | No ping                | Facilitator/Bazaar guidance already answered |
| PayAPI          | chet@payapi.market, hello@payapi.market     | 2026-09-23 | cooling         | No ping                | `notifications@` bounced earlier             |

## Closed / blocked on paid canary

| Party           | Email                          | Status                   | Notes                                                                                                      |
| --------------- | ------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Agent402 / Mike | mike@agent402.tools            | **closed** on paid trial | Indexed (9 tools). Router pays sellers only after `payTo` has settlement history. Do not re-ask for $0.05. |
| Agent Tools     | noreply@mail.agent-tools.cloud | cooling                  | Re-crawl verified $0.01 + MCP; no budget for paid trial; discovery copy fixed on our side                  |

## Rules for anyone continuing outreach

1. Clean links only. The Claude Gmail connector wraps every URL (even a bare `host/path`) in `https://www.google.com/url?q=…&source=gmail` at compose time, so “bare hostname” text does not help there. Email that carries a link to a directory or partner goes out from the Gmail web UI; the connector is fine for link-free replies.
2. Never ask anyone to pay **from** the receiving wallet `0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82`.
3. Point to `israel-counterparty-intelligence.vercel.app/proof` and `/health`.
4. Second canary copy-paste:
   - `POST https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet`
   - body `{}` → HTTP 402 → **0.05 USDC** on Base.
5. Partner access without crypto is ready (2026-09-25): a bearer key unlocks `POST /v1/pilot/verify`, `/v1/pilot/invoice-gate`, `/v1/pilot/payment-risk`, `/v1/pilot/company-changes` and the same four tools on `/mcp/pilot`, payment waived, usage metered per partner by `pilot_call` events. One key per partner in Vercel env `PILOT_KEYS` (JSON array; the old single-partner `PILOT_*` variables are ignored when it is set). The code defaults carry an expiry in the past, so **nothing is open until you set `PILOT_KEYS`**. Runbook: [PILOT.md](./PILOT.md). Reply kit: [REPLY_TEMPLATES.md](./REPLY_TEMPLATES.md) §7.
6. After any material reply or settle, update **this file** and [PROJECT_STATUS.md](./PROJECT_STATUS.md) the same day.
