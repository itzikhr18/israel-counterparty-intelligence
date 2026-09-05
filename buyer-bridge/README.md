# Israel Company Verify Buyer

## Invoice gate (v0.4)

Download your invoice JSON from the [free invoice check](https://israel-counterparty-intelligence.vercel.app/#invoice-preview), then:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz --invoice-file invoice-request.json
```

Add `--pay` only to authorize one report capped at 0.25 USDC, with the buyer's wallet already
configured in its own secret environment. No payment occurs by default. Structural errors,
missing buyer conditions, and unresolved suppliers block signing. A paid report may still return
HOLD or BLOCK and does not independently authenticate Tax Authority results or bank ownership.
Use the versioned production package for invoice support; the separate legacy buyer repository
may be an older version. Never put secrets in the invoice JSON.

Payment-aware command-line bridge for the Israel Business Intelligence remote MCP server.

Public source and one-command GitHub install:

```bash
npx --yes github:itzikhr18/israel-company-verify-buyer \
  --company-number 514744887
```

The default mode performs only a free live preview. A real Base Mainnet payment can happen only
when both `--pay` and a valid `BUYER_PRIVATE_KEY` are present. The bridge accepts only native Base
USDC and network `eip155:8453`. It caps company verification at `0.05 USDC` and vendor payment-risk
assessment at `0.10 USDC`. Version 0.3 also exposes a dry-run pre-sign gate for third-party x402
payments. The gate never signs or submits the vendor payment.

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz \
  --company-number 514744887
```

To request the paid report, provide the private key through the buyer's secret manager and add
`--pay`:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz \
  --company-number 514744887 --pay
```

Free pre-payment risk preview:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz \
  --payment-risk --company-number 514744887 --invoice-company-number 514744887
```

Add `--pay` to request the paid `PROCEED`, `REVIEW`, or `BLOCK` assessment. The private key is read
only from `BUYER_PRIVATE_KEY`; it is never accepted as a command-line argument or printed.

Use `--sample` for a static full-report example that does not make a live lookup or payment.

Free x402 pre-sign dry-run:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz \
  --agent-payment-trust \
  --company-number 514744887 \
  --service-url https://merchant.example/pay \
  --payment-network eip155:8453 \
  --payment-asset 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --payment-amount 50000 \
  --payment-pay-to 0x1111111111111111111111111111111111111111 \
  --payment-resource-url https://merchant.example/pay
```

The command exits with status `0` only for `ALLOW`. `REVIEW` and `DENY` return status `2`, making
the command suitable as a pre-sign policy hook. The importable `enforceAgentPaymentTrust` function
uses the same fail-closed rule.
