# Outreach CRM

**Updated:** 2026-09-24 ~14:30 Asia/Jerusalem  
**Owner inbox:** `itzikhr18@gmail.com`  
**Canonical status:** [PROJECT_STATUS.md](./PROJECT_STATUS.md) · **Reply kit:** [REPLY_TEMPLATES.md](./REPLY_TEMPLATES.md)

**Goal now:** second external Mainnet settle (**$0.05** via `POST /v1/verify/mainnet`) + advance the Grow/Yaki human thread.  
**Do not spam today:** PayAPI, GoPlausible, Mesh, Dokka, Cardcom, Aerchain, Agent402 paid-canary asks.

Status legend: `waiting` · `auto-ack` · `human` · `cooling` · `closed` · `blocked`

## Hot / human

| Party         | Email                               | Last touch | Status    | Next action                                                             | Notes                                                                                                                                                                                 |
| ------------- | ----------------------------------- | ---------- | --------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grow / Yaki   | support@grow.business               | 2026-09-24 | **human** | **Reply with a Sunday 27.09 time** (Chol HaMoed; propose morning + alt) | Yaki (sales dept) proposed Sunday; not FX acquiring; Grow = receiving side, possible ₪ acquiring vendor for us later, not a product partner. See [ICP_RESEARCH.md](./ICP_RESEARCH.md) |
| Glama / Frank | frank@glama.ai (+ support@glama.ai) | 2026-09-23 | **human** | Wait listing refresh                                                    | Connector ownership verified; asked refresh for $0.01 path                                                                                                                            |

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
5. After any material reply or settle, update **this file** and [PROJECT_STATUS.md](./PROJECT_STATUS.md) the same day.
