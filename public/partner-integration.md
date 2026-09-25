# Partner integration guide — Israel Counterparty Intelligence

For the engineer at a partner that received a pilot key. Time to a first PAY / HOLD / BLOCK decision: about 20 minutes. Hebrew overview for non-engineers: `/partner/he`.

## 0. What you received

| Item           | Value                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL       | `https://israel-counterparty-intelligence.vercel.app`                                                                                                   |
| Authentication | `Authorization: Bearer <your key>` on every pilot call                                                                                                  |
| Allowance      | `call_limit` calls for the pilot period, shown by `GET /v1/pilot/usage` and in the `x-pilot-call-limit` header                                          |
| Contracts      | Identical to the public routes; the machine-readable schema is at `/openapi.json` (operations under `/v1/pilot/*`)                                      |
| No key yet?    | `POST /v1/invoice-gate/preview` is free and has the same input shape; it checks the invoice arithmetic and allocation rules without the registry lookup |

Keep the key server-side. Never ship it in a browser or a mobile app.

## 1. Authenticate (one call)

```bash
export ICI_BASE=https://israel-counterparty-intelligence.vercel.app
export ICI_KEY=ici_...   # the key you received

curl -s "$ICI_BASE/v1/pilot/usage" -H "Authorization: Bearer $ICI_KEY"
```

`200` with `partner_id`, `call_limit`, `expires_at` and `usage` means you are in. `401` is a wrong or missing key, `410` means the pilot period has ended.

## 2. The invoice gate (the main call)

`POST /v1/pilot/invoice-gate` takes the invoice as your system already has it and returns one decision.

**Required fields**

| Field                     | Type             | Notes                                                                             |
| ------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| `supplier_company_number` | string, 9 digits | The supplier's company or VAT number as printed on the invoice                    |
| `invoice_number`          | string           | As printed                                                                        |
| `invoice_date`            | `YYYY-MM-DD`     | Must be 2025-01-01 or later; the allocation threshold depends on this date        |
| `amount_before_vat`       | number           | ILS                                                                               |
| `vat_amount`              | number           | ILS; `0` only for a zero-rated or exempt transaction, with `expected_vat_rate: 0` |
| `total_amount`            | number           | ILS                                                                               |

**Strongly recommended** (without them, invoices above the threshold return `HOLD` with `ALLOCATION_REQUIREMENT_CONTEXT_MISSING`)

| Field                               | Type             | Notes                                                       |
| ----------------------------------- | ---------------- | ----------------------------------------------------------- |
| `buyer_is_authorized_dealer`        | boolean          | Is the invoice recipient an authorized dealer (עוסק מורשה)? |
| `buyer_requested_allocation_number` | boolean          | Did the buyer ask the supplier for an allocation number?    |
| `allocation_number`                 | string, 9 digits | When present on the invoice                                 |

**Optional risk context**: `payment_details_changed`, `urgent_payment_request`, `first_time_vendor` (booleans), `vendor_email`, `invoice_website`, `invoice_city`, `supplier_name`, `buyer_vat_number`, `official_verification` (a result the buyer obtained from the Tax Authority; treated as buyer-attested), and `language` (`en` default, or `he` for Hebrew explanations).

### curl

```bash
curl -s "$ICI_BASE/v1/pilot/invoice-gate" \
  -H "Authorization: Bearer $ICI_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "supplier_company_number": "514744887",
    "invoice_number": "INV-2026-0912",
    "invoice_date": "2026-09-20",
    "amount_before_vat": 8000,
    "vat_amount": 1440,
    "total_amount": 9440,
    "buyer_is_authorized_dealer": true,
    "buyer_requested_allocation_number": true,
    "allocation_number": "123456789",
    "first_time_vendor": true,
    "language": "he"
  }'
```

### Node.js (fetch)

```js
const response = await fetch(`${process.env.ICI_BASE}/v1/pilot/invoice-gate`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.ICI_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(invoice), // the object shown in the curl example
});
const result = await response.json();
if (!response.ok)
  throw new Error(
    `${response.status} ${result.error?.code}: ${result.error?.message}`,
  );
switch (result.decision.action) {
  case "PAY":
    return release(invoice, result.request_id);
  case "HOLD":
    return routeToHuman(
      invoice,
      result.decision.reason_codes,
      result.decision.explanation,
    );
  case "BLOCK":
    return stop(
      invoice,
      result.decision.reason_codes,
      result.decision.explanation,
    );
}
```

### Python (requests)

```python
import os, requests

r = requests.post(
    f"{os.environ['ICI_BASE']}/v1/pilot/invoice-gate",
    headers={"Authorization": f"Bearer {os.environ['ICI_KEY']}"},
    json=invoice,  # the dict shown in the curl example
    timeout=20,
)
result = r.json()
if not r.ok:
    raise RuntimeError(f"{r.status_code} {result['error']['code']}: {result['error']['message']}")
action = result["decision"]["action"]  # "PAY" | "HOLD" | "BLOCK"
```

### What comes back

```json
{
  "request_id": "2a1cb5df-…",
  "decision": {
    "action": "HOLD",
    "automation_safe": false,
    "score": 35,
    "reason_codes": ["OFFICIAL_ALLOCATION_VERIFICATION_REQUIRED"],
    "explanation": "Hold payment until the buyer confirms the allocation number through their own authorized Tax Authority access; this API does not authenticate Tax Authority results."
  },
  "policy": {
    "allocation_threshold_ils": 5000,
    "amount_exceeds_threshold": true,
    "allocation_applicability": "REQUIRED",
    "missing_inputs": [],
    "source_url": "https://www.gov.il/he/service/request-assignment-number-for-tax-invoice"
  },
  "entity": {
    "legal_name": "מנדיי. קום בע״מ",
    "company_number": "514744887",
    "status": "פעילה"
  },
  "checks": [],
  "evidence": [],
  "checks_not_performed": ["bank_account_ownership"],
  "pilot": {
    "partner_id": "your-id",
    "call_limit": 500,
    "usage": {
      "durable": true,
      "period_total": 12,
      "month": "2026-10",
      "month_total": 12
    }
  },
  "checked_at": "2026-09-25T04:00:00.000Z"
}
```

**Wiring the decision into your workflow**

| `decision.action` | What it means                                                                                                              | Suggested handling                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAY`             | Arithmetic passed, allocation rules satisfied for this date and amount, supplier resolved and active, no risk signal fired | Release. Store `request_id`, `decision` and `evidence` with the payment for audit. `automation_safe: true` means no human step is needed                                                                                                                                                                                                                                                                         |
| `HOLD`            | Something must be confirmed by a person or by the buyer's own Tax Authority access                                         | Route to the AP reviewer with `reason_codes` and `explanation`. Frequent codes: `ALLOCATION_REQUIREMENT_CONTEXT_MISSING` (send the two buyer booleans and call again), `ALLOCATION_NUMBER_REQUIRED` (above the threshold, no number on the invoice), `OFFICIAL_ALLOCATION_VERIFICATION_REQUIRED` (number present; the buyer confirms it through the Tax Authority, then re-submits with `official_verification`) |
| `BLOCK`           | The invoice or the supplier fails a hard check                                                                             | Stop and show the explanation. Typical: `INVOICE_ARITHMETIC_MISMATCH` (VAT or total does not add up), `INVOICE_OR_OFFICIAL_DATA_MISMATCH`, `OFFICIAL_ALLOCATION_VERIFICATION_FAILED`, or a supplier that is not active in the registry                                                                                                                                                                           |

`policy.allocation_applicability` is `REQUIRED`, `NOT_REQUIRED` or `UNKNOWN`; `UNKNOWN` always yields `HOLD` and lists what is missing in `policy.missing_inputs`. The threshold is ₪10,000 for invoices dated from 2026-01-01 and ₪5,000 from 2026-06-01, compared strictly greater-than on the amount before VAT.

## 3. The other three tools (same key)

**Company verification** `POST /v1/pilot/verify` — `{ "company_number": "514744887", "language": "en" }` (or `company_name`, optionally `city`). Returns `resolution_status` (`RESOLVED`, `AMBIGUOUS` → HTTP 409 with `candidates`, `UNRESOLVED` → HTTP 422), `resolved_entity` (legal and English name, status, registered address, incorporation date, law-violation flag, latest annual report year), `confidence`, and field-level `evidence` with source URLs. Use it for supplier onboarding.

**Vendor payment risk** `POST /v1/pilot/payment-risk` — the supplier as your system knows it plus the identity printed on the payment request: `company_number` or `company_name`, `invoice_company_number`, `invoice_company_name`, `invoice_city`, `invoice_website`, `vendor_email`, `payment_details_changed`, `urgent_payment_request`, `first_time_vendor`. Returns `decision.action` `PROCEED` / `REVIEW` / `BLOCK` with `level`, `checks` (for example `INVOICE_COMPANY_NUMBER_MISMATCH`, `EMAIL_WEBSITE_DOMAIN_MISMATCH`, `ENTITY_NOT_ACTIVE`, `PAYMENT_DETAILS_CHANGED`). Use it when bank details change or a payment is rushed.

**Company changes** `POST /v1/pilot/company-changes` — `{ "company_number": "514744887", "lookback_days": 90, "limit": 25 }`. Returns `changes.events[]` (date, request type, category such as `FILING` or `COMPLIANCE`) from the official dataset, newest first. Use it for periodic re-screening of your supplier list.

## 4. MCP instead of REST

Any Streamable HTTP MCP client (Claude Desktop, Cursor, your own agent) can use the same key:

```json
{
  "mcpServers": {
    "israel-counterparty-intelligence": {
      "type": "http",
      "url": "https://israel-counterparty-intelligence.vercel.app/mcp/pilot",
      "headers": { "Authorization": "Bearer <your key>" }
    }
  }
}
```

Tools: `authorize_israeli_invoice_payment_paid`, `verify_israeli_company_paid` (alias `verify_company`), `assess_israeli_vendor_payment_risk_paid`, `get_israeli_company_changes_paid`, plus the free `describe_service`, `get_schema` and `get_sample_verification_report`. Payment is waived on this endpoint; each successful call counts against the same allowance.

## 5. Errors, retries, limits

| Status                      | Meaning                                                | Do                                                                                            |
| --------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `400 INVALID_INPUT`         | A field failed validation; `error.details` lists which | Fix the payload; do not retry as is                                                           |
| `401 PILOT_UNAUTHORIZED`    | Missing or wrong key                                   | Check the header; do not retry                                                                |
| `409`                       | Name resolved to several companies                     | Send `company_number` or add `city`                                                           |
| `410 PILOT_EXPIRED`         | Pilot period ended                                     | Contact the operator                                                                          |
| `422`                       | No reliable registry match                             | Treat as `HOLD` for a human                                                                   |
| `429 RATE_LIMITED`          | Too many requests in the window                        | Wait `retry-after` seconds, then retry                                                        |
| `429 PILOT_QUOTA_EXHAUSTED` | Allowance reached                                      | Contact the operator; not retryable                                                           |
| `502`                       | A public source was unavailable                        | Retry with backoff (for example 2 s, 8 s, 30 s); a failed call does not consume the allowance |

Calls are idempotent; retrying the same invoice is safe. Every response carries `x-request-id`; quote it when you report an issue. Each response also carries `x-pilot-partner`, `x-pilot-expires-at` and `x-pilot-call-limit`.

## 6. Usage and allowance

`GET /v1/pilot/usage` with your key returns `usage.period_total` (against `call_limit`), `usage.month_total`, and the split by tool. `usage.durable: true` means the count is stored centrally and survives deployments; the same numbers appear under `pilot.usage` in every response.

## 7. What this service is not

Public Companies Registry evidence only. It does not authenticate Tax Authority results (buyer-attested results are labeled as such), does not verify bank-account ownership, and does not check sanctions, PEP, UBO or credit. Treat `PAY` as decision support inside your own controls, not as a guarantee.

## 8. Go-live checklist

1. Key stored server-side; `GET /v1/pilot/usage` returns `200`.
2. The invoice gate is called with the two buyer booleans, so above-threshold invoices do not stall on `ALLOCATION_REQUIREMENT_CONTEXT_MISSING`.
3. `PAY` / `HOLD` / `BLOCK` mapped to release / review queue / stop, with `request_id` stored.
4. `502` and `429 RATE_LIMITED` retried with backoff; other errors surfaced.
5. Someone watches `usage.period_total` against `call_limit` before the pilot ends.

Questions: itzikhr18@gmail.com, or the Israeli-market overview at `/partner/he`.
