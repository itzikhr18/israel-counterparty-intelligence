# Israel Company Verify Buyer

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
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.3.0.tgz \
  --company-number 514744887
```

To request the paid report, provide the private key through the buyer's secret manager and add
`--pay`:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.3.0.tgz \
  --company-number 514744887 --pay
```

Free pre-payment risk preview:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.3.0.tgz \
  --payment-risk --company-number 514744887 --invoice-company-number 514744887
```

Add `--pay` to request the paid `PROCEED`, `REVIEW`, or `BLOCK` assessment. The private key is read
only from `BUYER_PRIVATE_KEY`; it is never accepted as a command-line argument or printed.

Use `--sample` for a static full-report example that does not make a live lookup or payment.

Free x402 pre-sign dry-run:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.3.0.tgz \
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
