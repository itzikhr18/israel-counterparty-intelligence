# Discovery status — 2026-09-23 (no cold email / no self-pay)

## Live surfaces (verified HTTP 200)

| Path                                                    | Status                      |
| ------------------------------------------------------- | --------------------------- |
| `/` `/buy` `/proof` `/partner` `/health`                | 200                         |
| `/mcp.json` `/.well-known/mcp.json` `/.well-known/x402` | 200                         |
| `/server.json` (MCP registry card)                      | **200** (shipped `abedf53`) |
| `/STATUS.md` `/llms.txt` `/agents.md`                   | 200                         |

`/health`: `first_external_paid_call` durable; `second_external_paid_call` **null**.

## Official MCP Registry

- Name: `io.github.itzikhr18/israel-business-intelligence`
- **Latest on registry: 1.8.2** (already active) — no republish required this pass.
- Note: `mcp-publisher validate` rejects descriptions **>100 chars**; keep `server.json` description ≤100 if republishing.

## Directories

| Surface                            | Status                           | Blocker / next                                                     |
| ---------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| MCP.Directory                      | Submitted earlier today (review) | Wait approval email to itzikhr18@gmail.com                         |
| Glama connector                    | Already indexed                  | Optional GitHub-login claim/refresh (needs browser login)          |
| Smithery / mcpservers.org / 402.ad | Not completed this pass          | Needs browser + logged-in session / captcha                        |
| Agent402 seller-payability         | **Blocked**                      | Needs ~$0.10 from a **non-receiving** buyer wallet (user has none) |
| Upstash auto-durability            | **Blocked**                      | Needs user Redis REST credentials                                  |

## Explicitly not done (by policy)

- No further cold email to Mesh / Dokka / Cardcom / Aerchain / Mike / PayAPI / GoPlausible today
- No self-pay from receiving wallet

## Copy honesty (2026-09-23 evening)

Aligned remaining `awaiting first external paid call` strings in `glama.json` + submission docs with live `/proof`, `/mcp.json`, and `/STATUS.md`.
