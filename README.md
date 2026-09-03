# Israel Counterparty Intelligence

One call to understand an Israeli business counterparty.

Public source: <https://github.com/itzikhr18/israel-counterparty-intelligence>

Run a free live preview in one command, without an account, API key, wallet, or payment:

```bash
npx --yes github:itzikhr18/israel-company-verify-buyer \
  --company-number 514744887
```

Public agent metadata is available at `/.well-known/x402`, `/llms.txt`, and `/README.md` in the
production deployment. The Mainnet and Testnet payment resources use the same business logic but
remain separate payment routes so Test USDC can never unlock the Mainnet resource.

The same verification engine is also exposed as a stateless Remote Streamable HTTP MCP server:

- `POST /mcp` - Base Mainnet, 0.05 USDC for company verification or 0.10 USDC for vendor payment-risk assessment.
- `POST /mcp/testnet` - Base Sepolia, 0.05 Test USDC per successful `verify_company` call.
- `POST /mcp/pilot` - invitation-only partner evaluation with a time-limited bearer token.
- Company and payment-risk previews, `preview_agent_payment_trust`, `describe_service`, and `get_schema` are free on both MCP endpoints.

This repository is a deliberately small MVP for External Paid Call #1. It resolves an Israeli
registered company, adds its public government-contract/support footprint, builds field-level
evidence, and returns a transparent heuristic risk signal. It is not a legal, credit, sanctions,
or investment service.

## Current scope

- `POST /v1/verify` - official company resolution and evidence.
- `POST /v1/verify/mainnet` - the same verification result, paid with real USDC on Base Mainnet.
- `POST /v1/pilot/verify` - invitation-only partner evaluation; never a public free route.
- `POST /v1/government-footprint` - public contracts and supports by exact company number.
- `POST /v1/counterparty-risk` - combined result and deterministic reason-coded score.
- `POST /v1/payment-risk/mainnet` - Mainnet pre-payment vendor triage with a `PROCEED`, `REVIEW`, or `BLOCK` result.
- `POST /v1/agent-payment-trust` - free dry-run x402 pre-sign firewall with `ALLOW`, `REVIEW`, or `DENY`; it never signs or submits a payment.
- `GET /health` - health check.
- `GET /openapi.json` - machine-readable contract.
- x402 v2 fixed-price protection and Bazaar metadata when `X402_ENABLED=true`.
- Remote Streamable HTTP MCP with paid `verify_company` plus free `preview_company`, `preview_agent_payment_trust`, `describe_service`, and `get_schema`.

Not included: dashboards, accounts, subscriptions, PDF reports, broad scraping, bank-account
ownership verification, invoice authenticity, UBO/PEP/sanctions certification, adverse-media
screening, creditworthiness, TASE enrichment, or a custom ML model.

## Verified Payee Firewall MVP

`preview_agent_payment_trust` evaluates exact x402 terms before a buyer wallet signs. It resolves
the claimed Israeli company, fetches `/.well-known/agent-payee.json` from the service origin with
SSRF and redirect protections, validates the manifest and EVM signature, checks the declared
payment destination, verifies the payment resource origin and buyer mandate, and creates a stable
SHA-256 fingerprint of the payment contract.

`ALLOW` is fail-closed: it requires an active resolved company, a valid domain-fetched manifest,
an authorized payment destination, a matching resource origin, and a complete buyer mandate.
`REVIEW` and `DENY` must not be signed automatically. Level 1 and Level 2 assurance do not prove
legal ownership of the recipient wallet. The manifest specification is published at
`/agent-payee-manifest-v0.1.md` and its JSON Schema at
`/.well-known/agent-payee-schema.json`.

Production status: **MAINNET LIVE - AWAITING FIRST EXTERNAL PAID CALL**. No internal Mainnet
payment is required for launch. The first genuine external Base Mainnet USDC payment is also the
first production end-to-end settlement and External Paid Call #1.

## Public sources

The company adapter uses the Ministry of Justice Companies Registrar open CKAN dataset on
`data.gov.il`. The government-footprint adapter uses the public BudgetKey table API. Source URLs,
retrieval time, source record identifiers, and confidence are returned in `evidence`.

The service returns `null` and `missing_data` when data is unavailable. It does not convert a
government contract into a trust endorsement and does not add risk points merely because a source
is missing.

## Local setup

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Run all checks:

```bash
npm run check
```

## Example

```bash
curl -X POST http://localhost:3000/v1/verify \
  -H 'content-type: application/json' \
  -d '{"company_number":"514744887","language":"en"}'
```

Name lookup is also supported:

```json
{
  "company_name": "MONDAY.COM",
  "city": "Tel Aviv",
  "language": "en"
}
```

When several candidates are plausible, the API returns `409 AMBIGUOUS_ENTITY` and candidates. It
never silently selects one. An invalid number returns `400`; no reliable entity returns `422` for
the two enrichment endpoints.

## x402 configuration

The implementation uses the official x402 v2 packages and Next.js `withX402`, so settlement occurs
only after a successful response. The default test setup is Base Sepolia through the public x402
test facilitator.

Required to enable payment:

```dotenv
X402_ENABLED=true
X402_PAY_TO=0xYourReceivingWallet
X402_NETWORK=eip155:84532
X402_ASSET=0x036CbD53842c5426634e7929541eC2318f3dCF7e
X402_FACILITATOR_URL=https://facilitator.payai.network
PUBLIC_BASE_URL=https://your-public-host.example
```

Prices are centralized in environment variables:

```dotenv
X402_VERIFY_PRICE=$0.10
X402_GOVERNMENT_PRICE=$0.35
X402_RISK_PRICE=$0.50
```

The independent Mainnet resource uses:

```dotenv
X402_MAINNET_ENABLED=true
X402_MAINNET_PAY_TO=0xYourReceivingWallet
X402_MAINNET_NETWORK=eip155:8453
X402_MAINNET_ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
X402_MAINNET_FACILITATOR_URL=https://facilitator.payai.network
X402_MAINNET_VERIFY_PRICE=$0.05
X402_MAINNET_PAYMENT_RISK_PRICE=$0.10
X402_MCP_TESTNET_VERIFY_PRICE=$0.05
X402_MCP_MAINNET_VERIFY_PRICE=$0.05
X402_MCP_TESTNET_PAYMENT_RISK_PRICE=$0.10
X402_MCP_MAINNET_PAYMENT_RISK_PRICE=$0.10
MAINNET_INTERNAL_TEST_PAYER=0xYourIsolatedMainnetTestWallet
```

Without a payment signature, a protected endpoint returns `402` with `PAYMENT-REQUIRED`. The
challenge includes Bazaar input/output metadata. A compatible paid client must echo that extension
in its payment payload. Catalog inclusion happens only after a facilitator processes a conforming
paid payload and is ultimately controlled by that facilitator.

The Base Sepolia and Base Mainnet network identifiers and USDC assets are validated as distinct
configuration values. Price, asset, network, facilitator and payTo are server-owned and cannot be
overridden by request input.

## MCP client setup

Production MCP URL:

```text
https://israel-counterparty-intelligence.vercel.app/mcp
```

The endpoint implements Streamable HTTP and x402 v2. Standard MCP clients can initialize the
server, list tools, and call the free tools. `preview_company` returns identity/status plus exact
reusable arguments for the next paid action. A paid `verify_company` call returns a structured
`PaymentRequired` result until the client retries it with `_meta["x402/payment"]`; a successful
settlement is returned in `_meta["x402/payment-response"]`. Use an x402-aware MCP client such as
`@x402/mcp` for automatic signing and retry. No buyer account or API key is required.

The production `PaymentRequired.resource.description` includes the canonical buyer guide:
https://israel-counterparty-intelligence.vercel.app/x402-buyer-quickstart.md. It contains a
Streamable HTTP client example, explicit Base Mainnet/USDC requirements, per-tool spend guards,
and the expected payment/settlement metadata. A normal MCP client without an x402 wallet bridge can
discover and call the free tools but cannot complete `verify_company` automatically.

Minimal client configuration for Claude and other clients that accept remote HTTP MCP servers:

```json
{
  "mcpServers": {
    "israel-business-intelligence": {
      "type": "http",
      "url": "https://israel-counterparty-intelligence.vercel.app/mcp"
    }
  }
}
```

LangChain uses the same URL with transport `http`; CrewAI and Google ADK use transport
`streamable-http`. Their standard MCP adapters can discover and call the free tools. Paid calls
require the x402 payment metadata round trip described above; no framework-specific SDK is needed.

An isolated, buyer-controlled supplier-onboarding composition is available in
[`examples/aerchain-adapter`](examples/aerchain-adapter/README.md). It includes a strict Base
Mainnet payment policy, registry-to-vendor mapping, settlement receipt handling, fixtures, and
tests. It does not alter the production service or represent public-registry evidence as full KYB.

## Partner pilot

The partner pilot is isolated from both paid routes. A valid bearer token can call the same
verification engine through `/mcp/pilot` or `/v1/pilot/verify` while payment is waived. The current
offer is limited to 100 successful verifications and a fixed expiration date. Each successful call
emits a `pilot_verification` event with a partner identifier and no raw token or raw IP address.

The in-process counter is a safety cap, not a globally durable billing ledger. The authoritative
pilot total is the centralized count of successful `pilot_verification` events. If the product
moves beyond a small evaluation, replace this mechanism with an atomic shared usage store before
selling metered plans.

Keep the raw bearer token outside the repository and configure only its SHA-256 digest. See
[the pilot runbook](docs/PILOT.md) for activation, monitoring, and shutdown steps.

## Smoke tests

Against a running unprotected service and the live public sources:

```bash
BASE_URL=http://localhost:3000 npm run smoke
```

Against a running x402-enabled service, without paying:

```bash
BASE_URL=http://localhost:3000 EXPECT_X402=true npm run smoke
```

The x402 smoke mode verifies HTTP 402, the payment header, protocol version 2, the exact configured
price, and Bazaar metadata. Base Sepolia already proves the complete settlement flow. Mainnet stays
live without an operator-funded self-payment and waits for a genuine external payer.

MCP discovery and free-tool smoke test:

```bash
MCP_URL=https://israel-counterparty-intelligence.vercel.app/mcp/testnet npm run smoke:mcp
```

The paid MCP smoke script is hard-restricted to `/mcp/testnet` and requires an isolated Base
Sepolia wallet file supplied outside the repository:

```bash
X402_TEST_WALLET_FILE=/secure/path/test-wallet.json npm run smoke:mcp:paid
```

## Risk scoring v0.1.0

- Entity not active: +40.
- Registry law-violation flag: +25.
- Annual report older than two years: +10.
- 0-19: LOW, 20-49: MEDIUM, 50-100: HIGH.
- Ambiguous identity is not scored.
- Missing critical identity data blocks scoring; missing enrichment lowers confidence.

Every risk response includes `reason_codes`, `explanation`, `confidence`, `scoring_version`, and an
inference evidence record. The safe interpretation is: no material public warning flags were found
in the sources checked - never that a transaction is safe.

## Reliability and privacy

- Typed adapters with Zod response validation.
- Abort timeouts and one bounded retry by default.
- Six-hour in-memory source cache.
- Per-instance in-memory rate limiting.
- JSON logs with request ID, timing, source calls, payment presence, confidence, error category, and
  a shortened one-way client fingerprint.
- Only a successful settlement on the exact Base Mainnet route, official Base USDC contract,
  configured amount and configured payTo can emit `external_paid_call`. Testnet and the configured
  internal test payers are excluded. The event is emitted by the post-settlement SDK hook and
  includes network, asset, payer, amount, transaction hash, resource and optional discovery source.
- No user database and no raw IP logging in application code.
- No secrets in the repository.
- Pilot authentication compares a SHA-256 token digest in constant time; the raw credential stays
  outside the repository.

In-memory cache and rate limiting are sufficient for the first paid-call experiment, not a
multi-region high-volume service. Add shared infrastructure only after real demand appears.

## Deployment

Build first:

```bash
npm run check
```

Then link and deploy from this directory:

```bash
vercel link
vercel deploy
vercel promote <validated-preview-url>
```

Configure runtime environment variables in Vercel rather than committing them. Keep x402 disabled
until the receiving wallet is correct. After enabling x402, redeploy and run the non-paying 402
smoke test. Do not manufacture a Mainnet settlement for activation or discovery.

## External Paid Call #1

1. Keep the public Mainnet endpoint and discovery metadata live.
2. Wait for a payer that is not controlled by the operator.
3. Require successful Base Mainnet settlement with real USDC and an HTTP 200 API response.
4. Exclude Testnet, internal wallets, smoke tests, crawlers and directory probes.
5. Emit `external_paid_call` with network, payer, amount, transaction hash, resource and timestamp.
6. Treat that same event as the first Mainnet end-to-end proof and External Paid Call #1.

Do not add features if no external paid call occurs after a reasonable discovery and outreach test.
Change the offer or stop.

## Policies

- [Terms](docs/TERMS.md)
- [Privacy notice](docs/PRIVACY.md)
- [Correction process](docs/CORRECTIONS.md)
- [Implementation analysis in Hebrew](docs/ANALYSIS_HE.md)
- [Current blockers](docs/BLOCKERS.md)
- [Paid settlement test](docs/PAID_SETTLEMENT_TEST.md)
