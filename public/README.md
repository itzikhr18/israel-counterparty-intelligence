# Israel Company Verify

Verify an Israeli company and return structured public registry data with evidence.

Status: **MAINNET LIVE - AWAITING FIRST EXTERNAL PAID CALL**

This x402 v2 service has a production Base Mainnet resource and a separate Base Sepolia test resource. It is designed for agents searching for:

- verify Israeli company
- Israel company verification
- Recent official Israeli company filing and status-change events
- Israeli supplier due diligence
- Israel KYB
- Israeli business verification
- Israel counterparty intelligence

## Production resource

- Method: `POST`
- URL: `https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet`
- Price: `$0.05`
- Asset: Real USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Network: Base Mainnet (`eip155:8453`)
- Facilitator: authenticated Coinbase CDP (`https://api.cdp.coinbase.com/platform/v2/x402`)
- Receiving wallet: `0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82`

No self-payment or operator-funded Mainnet activation is required. The first genuine external
Base Mainnet USDC payer will be the first production end-to-end settlement and External Paid Call
#1.

## Vendor payment-risk resource

- Method: `POST`
- URL: `https://israel-counterparty-intelligence.vercel.app/v1/payment-risk/mainnet`
- Price: `$0.10`
- Asset: Real USDC on Base Mainnet (`eip155:8453`)
- Result: deterministic `PROCEED`, `REVIEW`, or `BLOCK` decision with reason codes and evidence

The service compares invoice identity and contact-domain signals with the resolved public-registry
record and considers buyer-observed payment changes, urgency, and first-time-vendor context. It does
not verify bank-account ownership, invoice authenticity, sanctions, PEPs, UBOs, adverse media, or
creditworthiness.

## Israeli invoice payment gate

- Free preview: `POST https://israel-counterparty-intelligence.vercel.app/v1/invoice-gate/preview`
- Paid gate: `POST https://israel-counterparty-intelligence.vercel.app/v1/invoice-gate/mainnet`
- Price: `$0.25` real USDC on Base Mainnet
- MCP: `preview_israeli_invoice_payment_gate_free`, then `authorize_israeli_invoice_payment_paid`
- Result: deterministic `PAY`, `HOLD`, or `BLOCK` with reason codes

The gate checks VAT and total arithmetic, the date-sensitive Israel Invoices allocation-number
threshold, supplier public-registry identity, and vendor-risk signals. Direct verification through
the Israel Tax Authority requires an authorized dealer or representative login/connection.
Buyer-supplied results are labeled `BUYER_ATTESTED` and are never described as independently
authenticated.

## Company changes resource

- URL: `https://israel-counterparty-intelligence.vercel.app/v1/company-changes/mainnet`
- Price: `$0.01`
- Input: exact nine-digit Israeli company number, optional `lookback_days` and `limit`
- Output: recent official filing and status-change events, newest first, with source evidence
- Coverage: approximately one year, subject to the official source dataset
- Asset: Real USDC on Base Mainnet (`eip155:8453`)

## Israel Business Intelligence MCP

- Name: `Israel Business Intelligence MCP`
- Production URL: `https://israel-counterparty-intelligence.vercel.app/mcp`
- Testnet URL: `https://israel-counterparty-intelligence.vercel.app/mcp/testnet`
- Transport: Remote Streamable HTTP MCP
- Protocol: MCP with x402 v2 tool payments
- Recommended paid tool: `verify_israeli_company_paid` - 0.05 USDC on Base Mainnet
- Recommended free preview: `preview_israeli_company_free`
- Recommended paid payment-risk tool: `assess_israeli_vendor_payment_risk_paid` - 0.10 USDC
- Low-cost paid changes tool: `get_israeli_company_changes_paid` - 0.01 USDC
- Free payment-risk preview: `preview_israeli_vendor_payment_risk_free`
- Free invoice preview: `preview_israeli_invoice_payment_gate_free`
- Paid invoice gate: `authorize_israeli_invoice_payment_paid` - 0.25 USDC
- Free sample: `get_sample_verification_report` - complete static response shape, no live lookup
- Compatibility names: `verify_company`, `preview_company`
- Free metadata tools: `describe_service`, `get_schema`
- Registry metadata: `https://israel-counterparty-intelligence.vercel.app/mcp.json`

The MCP tool is a thin wrapper around the same verification engine and schema used by the REST
resource. It does not duplicate or broaden the underlying business-intelligence logic.

## Active discovery channels

- Agent Tools: `https://agent-tools.cloud/api/v1/services/israel-counterparty-intelligence-vercel-app-sub393`
- 402 Index: `https://402index.io/service/fa0902ac-90a7-431a-8979-97da22a12911`
- x402scan resource ID: `e9b83616-3c3e-483a-81a2-a93c2b85dd7e`
- PayAI discovery for the Base Sepolia test resource: `https://facilitator.payai.network/discovery/resources`
- Coinbase Bazaar readiness: the automated check validates every Mainnet resource; catalog activation
  requires a conforming payment settled by the authenticated Coinbase CDP facilitator.

## Test resource

- Method: `POST`
- URL: `https://israel-counterparty-intelligence.vercel.app/v1/verify`
- Price: `$0.10`
- Asset: Test USDC
- Network: Base Sepolia (`eip155:84532`)
- Facilitator: `https://facilitator.payai.network`
- PayAI resource ID: `6a91c9587356b8e8001ae3e5`
- OpenAPI: `https://israel-counterparty-intelligence.vercel.app/openapi.json`
- x402 manifest: `https://israel-counterparty-intelligence.vercel.app/.well-known/x402`

## Inspect the x402 challenge

Mainnet, without making a payment:

```bash
curl -i -X POST \
  'https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet' \
  -H 'content-type: application/json' \
  -d '{"company_number":"514744887","language":"en"}'
```

Base Sepolia test resource:

```bash
curl -i -X POST \
  'https://israel-counterparty-intelligence.vercel.app/v1/verify' \
  -H 'content-type: application/json' \
  -d '{"company_number":"514744887","language":"en"}'
```

Each unpaid request returns HTTP `402` and a `PAYMENT-REQUIRED` header containing its exact price,
USDC contract, network, receiving wallet, and Bazaar input/output schema. Test USDC cannot satisfy
the Mainnet resource.

## Discover through PayAI

```bash
curl -s 'https://facilitator.payai.network/discovery/resources' \
  | jq '.items[] | select(.resource == "https://israel-counterparty-intelligence.vercel.app/v1/verify")'
```

## Call Mainnet after signing an x402 v2 payment

Buyer quickstart (MCP and REST):
https://israel-counterparty-intelligence.vercel.app/x402-buyer-quickstart.md

One-command buyer bridge:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.3.0.tgz \
  --company-number 514744887
```

The command above is free. Add `--pay` only when the buyer has configured `BUYER_PRIVATE_KEY` in
its secret environment and explicitly wants the 0.05 USDC complete report.

Use an x402 v2 client to sign the selected `accepts` requirement, then retry the same request with
the returned base64 payment payload:

```bash
curl -X POST \
  'https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet' \
  -H 'content-type: application/json' \
  -H 'PAYMENT-SIGNATURE: <base64-x402-v2-payment-payload>' \
  -d '{"company_number":"514744887","language":"en"}'
```

For MCP clients, configure the production Streamable HTTP URL above. Initialization, tool discovery,
`preview_israeli_company_free`, `get_sample_verification_report`, `describe_service`, and `get_schema`
do not require payment. A resolved preview returns an exact `next_action` with reusable verification
arguments. A call to `verify_israeli_company_paid` returns an
x402 v2 `PaymentRequired` tool result and must be retried with `_meta["x402/payment"]`. The signed
payment is verified and settled through the authenticated Coinbase CDP facilitator before the tool
result is released.

## Response

A successful response contains resolved Israeli company data, confidence, evidence records,
missing-data disclosure, and a request ID. The service is public-information business intelligence,
not legal, credit, sanctions, or investment advice.
