# Outreach CRM\n\n**Reply kit:** [REPLY_TEMPLATES.md](./REPLY_TEMPLATES.md) · **Discovery:** [DISCOVERY_STATUS.md](./DISCOVERY_STATUS.md)\n\n**Now:** wait ≤48h on hot $0.05 wave; Agent402 seller-payability **blocked** (no separate buyer wallet). — ICI (as of 2026-09-23 ~15:20 IDT)

**Owner inbox:** `itzikhr18@gmail.com`  
**Goal now:** second external Mainnet settle at **$0.05** via `POST /v1/verify/mainnet` (or any honest external paid call on a second path).  
**Do not spam today:** PayAPI, GoPlausible (already bumped after proof).

Status legend: `waiting` = no human product reply yet · `auto-ack` = ticket/bot only · `human` = real person replied · `cooling` = do not ping again same day · `bounced` = delivery failure

## Hot — waiting after $0.05 second-settle wave (sent ~15:17 IDT / 12:17 UTC)

| Party           | Email                                       | Last touch | Status             | Waiting? | Next action                                                                                   | Notes                                                 |
| --------------- | ------------------------------------------- | ---------- | ------------------ | -------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Mesh            | support@meshpayments.com                    | 2026-09-23 | waiting            | **YES**  | Wait ≤48h for human                                                                           | $0.05 second-settle ask + earlier design-partner note |
| Dokka           | info@dokka.com                              | 2026-09-23 | waiting            | **YES**  | Wait ≤48h                                                                                     | $0.05 design-partner canary                           |
| Cardcom         | support@secure.cardcom.co.il                | 2026-09-23 | auto-ack / waiting | **YES**  | Wait on ticket **639447**                                                                     | $0.01 ask then $0.05 follow-up                        |
| Aerchain        | support@aerchain.io                         | 2026-09-23 | auto-ack           | **YES**  | Wait human on ticket **107580**                                                               | Auto confirmation after $0.05 follow-up               |
| Agent402        | mike@agent402.tools                         | 2026-09-23 | waiting            | **YES**  | Wait; seller-payability blocked — no buyer wallet; optional (~$0.10) only with spend approval | Multiple $0.01 bumps + $0.05 second-settle ask        |
| EasyCount / HYP | contact.ez@hyp.co.il, contact@ezcount.co.il | 2026-09-23 | waiting            | YES      | Wait ≤48h                                                                                     | New design-partner ask + /proof /buy /partner         |

## Active threads (other)

| Party       | Email                                   | Last touch | Status             | Waiting? | Next action                               | Notes                                                       |
| ----------- | --------------------------------------- | ---------- | ------------------ | -------- | ----------------------------------------- | ----------------------------------------------------------- |
| Grow        | support@grow.business                   | 2026-09-23 | human → department | **YES**  | Wait department; no more same-day pings   | Limor clarified not merchant signup; proof sent             |
| Nipendo     | support@nipendo.com                     | 2026-09-23 | auto-ack           | **YES**  | Wait ticket **524795**                    | Proof follow-up sent after first settle                     |
| Tipalti     | contact@tipalti.com                     | 2026-09-23 | waiting            | YES      | Wait                                      | Israel AP enrichment + $0.01 follow-up                      |
| Stampli     | hello@stampli.com                       | 2026-09-23 | waiting            | YES      | Wait                                      | Design-partner + $0.01 follow-up                            |
| Procee      | contact@procee.com                      | 2026-09-23 | waiting            | YES      | Wait                                      | $0.01 follow-up                                             |
| Glama       | support@glama.ai                        | 2026-09-23 | auto-ack           | YES      | Wait ticket **#135941951**                | Connector refresh request                                   |
| GoPlausible | info@goplausible.com                    | 2026-09-23 | human + cooling    | soft     | **No ping today**                         | Facilitator/Bazaar guidance; proof+bump already sent        |
| PayAPI      | chet@payapi.market, hello@payapi.market | 2026-09-23 | cooling            | soft     | **No ping today**                         | Listed; `notifications@` bounced; proof+product update sent |
| PayAI       | info@payai.network                      | 2026-09-22 | waiting            | YES      | Prefer bump after ~36–48h from first send | Early outreach                                              |

## Rules for anyone continuing outreach

1. Bare hostnames only (Gmail wrappers look spammy).
2. Never ask them to pay the **receiving** wallet from an operator key.
3. Point to `israel-counterparty-intelligence.vercel.app/proof` and `/health`.
4. Second canary copy-paste:
   - `POST https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet`
   - body `{}` → HTTP 402 → **0.05 USDC** on Base.
