# System map — ICI

## Important HTTP surfaces

| Path                          | Role                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                           | Landing (honest status chip + link to `/proof`)                                                                                                                                                                                                                                                          |
| `/health`                     | Machine status + `payments.first_external_paid_call` / `second_external_paid_call` / `optional_second_paid_call`                                                                                                                                                                                         |
| `/proof`                      | Human settlement proof (reads `/health`)                                                                                                                                                                                                                                                                 |
| `/STATUS.md`                  | Public commercial status                                                                                                                                                                                                                                                                                 |
| `/mcp`                        | MCP endpoint                                                                                                                                                                                                                                                                                             |
| `/mcp.json`                   | MCP listing metadata                                                                                                                                                                                                                                                                                     |
| `/.well-known/x402`           | x402 discovery                                                                                                                                                                                                                                                                                           |
| `/v1/company-changes/mainnet` | Cheapest paid route (**$0.01**)                                                                                                                                                                                                                                                                          |
| `/v1/verify/mainnet`          | Verify route (**$0.05**) — preferred second canary                                                                                                                                                                                                                                                       |
| `/v1/payment-risk/mainnet`    | **$0.10**                                                                                                                                                                                                                                                                                                |
| `/v1/invoice-gate/mainnet`    | **$0.25**                                                                                                                                                                                                                                                                                                |
| `/v1/pilot/*` + `/mcp/pilot`  | Partner API key, no crypto: invoice gate, verify, payment risk, company changes; payment waived, metered per partner via `pilot_call` events and durable Upstash counters (`GET /v1/pilot/usage?month=`), month-end lines via `npm run pilot:invoice`; keys in env `PILOT_KEYS` ([PILOT.md](./PILOT.md)) |

## Where paid milestones are recorded

1. Runtime observes successful **external** Mainnet settle (payer ≠ receiving wallet).
2. First call → `/health.payments.first_external_paid_call` (process memory; Upstash if set; else operator sets `FIRST_EXTERNAL_PAID_CALL_TX`).
3. Second call → set `SECOND_EXTERNAL_PAID_CALL_TX` (and optional companions) so `/health.payments.second_external_paid_call` is durable.
4. Public proof UI: `public/proof.html` served at `/proof`.

## Deploy

- GitHub: `itzikhr18/israel-counterparty-intelligence`
- Hosting: Vercel production alias `israel-counterparty-intelligence.vercel.app`
- Typical path: commit → `git push origin main` → Vercel prod (or `npx vercel deploy --prod`)

## Local quality gates

```bash
npm run check   # format + lint + typecheck + test + build
```
