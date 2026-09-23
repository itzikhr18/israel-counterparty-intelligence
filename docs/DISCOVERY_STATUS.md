# Discovery status — 2026-09-23 evening (Asia/Jerusalem)

Canonical ops snapshot: [PROJECT_STATUS.md](./PROJECT_STATUS.md)

## Live surfaces (verified)

| Path                                     | Status                  |
| ---------------------------------------- | ----------------------- |
| `/` `/buy` `/proof` `/partner` `/health` | 200                     |
| `/mcp` `/mcp.json` `/.well-known/x402`   | 200                     |
| `/.well-known/glama.json`                | 200 (Glama claim token) |
| `/STATUS.md` `/llms.txt` `/agents.md`    | 200                     |

`/health`: `first_external_paid_call` durable; `second_external_paid_call` **null**.

## Official MCP Registry

- Name: `io.github.itzikhr18/israel-business-intelligence`
- Latest published: **1.8.2** (active)
- Note: keep `server.json` description ≤100 chars if republishing (`mcp-publisher validate`)

## Directories

| Surface                            | Status                              | Next                                                                                                         |
| ---------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Glama connector                    | **Ownership verified** (2026-09-23) | Wait Frank refresh; listing https://glama.ai/mcp/connectors/io.github.itzikhr18/israel-business-intelligence |
| Agent Tools                        | Re-crawled; $0.01 + MCP OK          | No paid trial; cool                                                                                          |
| Agent402                           | Indexed (9 tools)                   | Paid canary **closed** (router policy)                                                                       |
| MCP.Directory                      | Submitted earlier                   | Wait approval email                                                                                          |
| Smithery / mcpservers.org / 402.ad | Not finished                        | Needs human browser / captcha                                                                                |
| Agent402 seller-payability         | **Blocked**                         | Needs ~$0.10 from non-receiving buyer wallet                                                                 |
| Upstash auto-durability            | **Blocked**                         | Needs Redis REST credentials from owner                                                                      |

## Explicitly not done (by policy)

- No further cold email to Mesh / Dokka / Cardcom / Aerchain / Mike / PayAPI / GoPlausible while cooling
- No self-pay from receiving wallet
- No Google-wrapped links in outbound mail (bare hostnames only)

## Copy honesty

Removed leftover “awaiting first external paid call” strings from `glama.json` + submission docs. Live `/mcp.json` already said first paid confirmed.
