# Invoice revenue funnel

## Measurement boundary

Revenue means a successful, external Base USDC settlement, not an initialize request,
tool listing, payment challenge, test call, or a directory listing.
No self-payments are used to activate discovery.

The 2026-09-05 audit returned 14 initialize and 13 tools/list events classified external
from a 24-hour MCP log query, and no measured preview/payment events. These are events,
not unique users or proof of buyer intent. Historical invoice tools and the browser form
were absent from funnel telemetry, so the data cannot establish a complete conversion rate.

## Improvements

- Browser invoice result carries the same validated invoice into a private JSON download.
- Version 0.4 buyer bridge supports invoice preview and one explicitly authorized invoice
  report capped at 0.25 USDC. The default is free; supplier resolution is checked for free
  before signing. BLOCK or unknown applicability prevents the paid call.
- The paid result can still HOLD/BLOCK; missing official verification is disclosed before purchase.
- Browser events do not contain invoice, company, wallet, or network identifiers.
- MCP now measures invoice preview and payment steps.

## Read observed receipts

```powershell
vercel logs --environment production --no-branch --since 24h --limit 1000 --json | node scripts/revenue-funnel.mjs
```

Query limits and plan retention can omit rows. Narrow the time window or query
`external_paid_call` separately for receipts. The summary deduplicates settlement transaction
hashes, excludes internal/pilot traffic and reports gross USDC, not profit or lifetime revenue.
Do not infer zero demand from no returned rows.

Use `BUYER_INTERNAL_SMOKE=1` only in internal free bridge checks so they do not become
apparent buyer activity. Never run an internal paid purchase.

## Next decision

Prioritize qualified agent integrations and distribution if discovery stops at tool listing.
If users reach invoice download but not the paid tool, reduce wallet/setup friction (for example
buyer-controlled browser wallet checkout). If paid challenges occur without settlement, investigate
buyer-wallet/facilitator errors. Avoid changing prices without purchase evidence.

At 0.25 USDC per invoice, 100 USDC gross requires 400 paid reports, before costs.
High-volume repeat integrations matter more than vanity directory counts.
