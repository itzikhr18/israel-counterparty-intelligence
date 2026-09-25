# Partner pilot runbook — API key, no crypto

**Audience:** the operator onboarding an Israeli AP / accounting / ERP partner (Morning, iCount, SUMIT, Grow-class) that cannot pay in USDC.  
**What the partner gets:** the full product over REST and MCP with a bearer key. Payment is waived; every successful call is metered per partner so a monthly invoice can be issued in ₪ or $.  
**Why it exists:** [ICP_RESEARCH.md](./ICP_RESEARCH.md) found that the segments that would pay need an API key and ₪/$ billing, not a Base wallet.

## What a pilot key covers

| Product                           | REST (`POST`)               | MCP tool on `/mcp/pilot`                               |
| --------------------------------- | --------------------------- | ------------------------------------------------------ |
| Invoice gate → PAY / HOLD / BLOCK | `/v1/pilot/invoice-gate`    | `authorize_israeli_invoice_payment_paid`               |
| Company verification              | `/v1/pilot/verify`          | `verify_israeli_company_paid` (alias `verify_company`) |
| Vendor payment risk               | `/v1/pilot/payment-risk`    | `assess_israeli_vendor_payment_risk_paid`              |
| Company changes                   | `/v1/pilot/company-changes` | `get_israeli_company_changes_paid`                     |

Request and response contracts are identical to the paid Mainnet routes, so a partner that later moves to x402 changes only the URL. Pilot responses add a `pilot` block (`partner_id`, `expires_at`, `call_limit`, `tools`) and the headers `x-pilot-partner`, `x-pilot-expires-at`, `x-pilot-call-limit`. The free tools (`describe_service`, `get_schema`, `get_sample_verification_report`) are also available on `/mcp/pilot`. `/openapi.json` documents the four REST routes under the `pilotBearer` security scheme.

## 1. Issue a key (two minutes)

```bash
KEY="ici_$(openssl rand -hex 24)"
echo "$KEY"                                      # hand this to the partner once, over a channel you trust
printf '%s' "$KEY" | sha256sum | cut -d' ' -f1   # only this digest is stored
```

Never commit, email in clear text, or log the raw key. The service stores and compares SHA-256 digests only.

## 2. Configure `PILOT_KEYS` in Vercel (production)

One JSON array, one object per partner:

```json
[
  {
    "partner_id": "morning",
    "token_sha256": "<sha256 of the raw key>",
    "expires_at": "2026-12-31T23:59:59.000Z",
    "call_limit": 500
  },
  {
    "partner_id": "icount",
    "token_sha256": "<sha256 of the raw key>",
    "expires_at": "2026-12-31T23:59:59.000Z",
    "call_limit": 500
  }
]
```

Rules enforced at boot: `partner_id` 2–80 characters from `[a-z0-9._-]` and unique; `token_sha256` 64 hex characters; `expires_at` ISO-8601 UTC; `call_limit` 1–100000 (default 500); at most 50 entries. A malformed value fails the deploy on purpose rather than silently opening or closing access.

From the linked clone with the Vercel CLI:

```bash
vercel env add PILOT_KEYS production --scope itzikhr18-6605s-projects   # paste the JSON on one line
vercel redeploy <current-production-url> --scope itzikhr18-6605s-projects
```

Or in the dashboard: Project → Settings → Environment Variables → `PILOT_KEYS` (Production) → Redeploy. When `PILOT_KEYS` is set, the single-partner variables `PILOT_TOKEN_SHA256`, `PILOT_PARTNER_ID`, `PILOT_EXPIRES_AT`, `PILOT_VERIFICATION_LIMIT` are ignored.

## 3. Verify the key works

```bash
BASE=https://israel-counterparty-intelligence.vercel.app
curl -s -i "$BASE/v1/pilot/company-changes" \
  -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
  --data '{"company_number":"514744887","lookback_days":30,"limit":5,"language":"en"}' | head -20
# expect HTTP 200, x-pilot-partner: morning, and a "pilot" block in the JSON body

curl -s -i "$BASE/v1/pilot/verify" -H 'content-type: application/json' --data '{}' | head -3
# expect HTTP 401 without a key
```

MCP: the same key as `Authorization: Bearer …` on `POST /mcp/pilot`; `tools/list` returns the four product tools plus the free ones. An expired key returns HTTP 410 with the partner named in `x-pilot-partner`.

## 4. What to send the partner

- Base URL, their raw key (once), the expiry, and the call allowance.
- REST: `/openapi.json` → the `/v1/pilot/*` operations. Invoice gate sample body: see `/v1/invoice-gate/preview` docs in the README.
- MCP client config (Claude Desktop, Cursor, any Streamable HTTP client):

```json
{
  "mcpServers": {
    "israel-counterparty-intelligence": {
      "type": "http",
      "url": "https://israel-counterparty-intelligence.vercel.app/mcp/pilot",
      "headers": { "Authorization": "Bearer <their key>" }
    }
  }
}
```

- The honesty boundaries, unchanged from the paid path: public Companies Registry evidence, buyer-attested allocation results are labeled and not independently authenticated, no bank-account ownership, no sanctions/PEP/UBO, not legal advice.

## 5. Meter and invoice

Every call logs one JSON line:

```json
{
  "event": "pilot_call",
  "partner_id": "morning",
  "tool": "invoice_gate",
  "status": "success",
  "local_sequence": 12,
  "call_limit": 500,
  "duration_ms": 840
}
```

`status: "failed"` calls do not count and do not consume the allowance. The in-process counter is a safety cap per serverless instance; the **authoritative monthly total is the number of `pilot_call` success events per `partner_id` in centralized logs**. Vercel retains runtime logs only briefly, so before the first billable month connect a Log Drain (Project → Settings → Log Drains) to a store you control, or export the count at least weekly. At month end: count `status=success` by `partner_id` and `tool`, apply the agreed price card, issue the invoice.

Price card for the invoice is the owner's decision. Starting points for the conversation are in [OEM_PARTNER_ONEPAGER.md](./OEM_PARTNER_ONEPAGER.md); the public USDC prices ($0.01 / $0.05 / $0.10 / $0.25) are the floor.

## 6. Rotate, extend, revoke

- **Rotate:** issue a new key, replace `token_sha256`, redeploy. The old key stops at once.
- **Extend or resize:** change `expires_at` or `call_limit`, redeploy.
- **Revoke one partner:** remove the entry (or move `expires_at` into the past), redeploy.
- **Close the pilot entirely:** remove `PILOT_KEYS`; the legacy defaults carry an expiry in the past, so every pilot request answers 410.

## Limits

- The per-partner rate-limit bucket (`RATE_LIMIT_REQUESTS` per `RATE_LIMIT_WINDOW_SECONDS`) applies on top of `call_limit`.
- Pilot routes are invitation-only. Their existence is documented on `/partner` and in `/openapi.json` so a partner's engineer can integrate, but keep them out of agent discovery surfaces (`llms.txt`, `agents.md`, the x402 discovery manifest, MCP directory listings) and never publish a key.
- The security release smoke (`scripts/security-release-smoke.mjs`) asserts that every pilot route answers 401 or 503 without a key.
