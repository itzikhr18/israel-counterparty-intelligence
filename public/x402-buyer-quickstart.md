# x402 v2 Buyer Quickstart

Use this guide to run a free preview or pay for one complete verification with a buyer-controlled
wallet. The service never asks for an API key or custody of the buyer's private key.

## Invoice gate: from free check to one paid report

Start at [the free invoice form](https://israel-counterparty-intelligence.vercel.app/#invoice-preview).
Complete the invoice and buyer answers, then download `invoice-request.json` from the result.
Keep this file private: it contains your invoice data. Requires Node.js 20.9+.

In the download folder, run the invoice preview for free, with no wallet:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz --invoice-file invoice-request.json
```

When the buyer has already configured its wallet in its own secret environment, explicitly
authorize one invoice report, capped at **0.25 USDC**:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz --invoice-file invoice-request.json --pay
```

This pays for the report, **not the supplier invoice**. The bridge first runs the free structural
check and resolves the supplier for free; it refuses to sign if the invoice is blocked, buyer
conditions are unknown, or the supplier cannot be resolved.
The same invoice JSON is passed to the paid tool without retyping.

The paid result is decision support and can still be HOLD or BLOCK. If official allocation
verification is required but missing, the gate will still HOLD after purchase. Buyer-provided
official results are not independently authenticated. Bank ownership is not verified.
This is an agent/CLI flow, not a browser-wallet or card checkout.

For a buyer-managed automation, provision `BUYER_PRIVATE_KEY` using your existing local secret
manager; the bridge reads it locally to sign and never sends the key to this service.
Do not paste keys into chat, forms, source code, or invoice JSON. No wallet is needed for free checks.
Source: [versioned bridge in the main repository](https://github.com/itzikhr18/israel-counterparty-intelligence/tree/main/buyer-bridge).

## Company verification: one-command buyer bridge

Run a free live identity/status preview without a wallet:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz \
  --company-number 514744887
```

When `BUYER_PRIVATE_KEY` is already configured in the buyer's secret environment, add `--pay` to
authorize one payment capped at 0.05 USDC:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz \
  --company-number 514744887 --pay
```

The bridge always runs the free preview first. It blocks payment unless the company resolves, and
its policy rejects every network except Base Mainnet, every asset except native Base USDC, and every
amount above 0.05 USDC. Use `--sample` to inspect a static full-report example without a live lookup
or payment.

For a free vendor payment-risk preview, add transaction context:

```bash
npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz \
  --payment-risk --company-number 514744887 --invoice-company-number 514744887
```

Adding `--pay` authorizes the separate payment-risk tool with its own strict 0.10 USDC cap. It
returns `PROCEED`, `REVIEW`, or `BLOCK` with deterministic reason codes and explicit checks not
performed. It does not verify bank-account ownership or invoice authenticity.

## Free pre-sign x402 firewall

Before a separate agent wallet signs a third-party x402 payment, run a dry-run with the company and
the exact `PaymentRequired` terms. Version 0.3 exits with status `0` only for `ALLOW`, and status `2`
for `REVIEW` or `DENY`. The command never signs or submits the third-party payment.

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

The service fetches `/.well-known/agent-payee.json` from the service origin, refuses unsafe or
private destinations, verifies the manifest signature, compares the declared company with the
Israeli registry, checks the payment destination and buyer mandate, and fingerprints the payment
terms. Level 1 or 2 assurance is technical and registry-corroborated; it is not legal wallet
ownership. Manifest specification: `/agent-payee-manifest-v0.1.md`.

## Production payment contract

- MCP endpoint: `https://israel-counterparty-intelligence.vercel.app/mcp`
- REST endpoint: `https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet`
- Network: Base Mainnet (`eip155:8453`)
- Asset: native Base USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Price: `0.05 USDC` per successful `verify_company` call
- Payment-risk price: `0.10 USDC` per successful `assess_israeli_vendor_payment_risk_paid` call
- Company-changes price: `0.01 USDC` per successful `get_israeli_company_changes_paid` call
- Invoice-gate price: `0.25 USDC` per successful `authorize_israeli_invoice_payment_paid` call (including a valid HOLD/BLOCK report)
- Protocol: x402 v2, exact EVM payment
- Authentication: none

The buyer needs its own Base Mainnet wallet and enough native USDC for the call.
An external wallet or account provider may impose its own fees. Do not paste a
private key into a website or send it to this service.

## MCP: automatic payment and retry

Install the official MCP/x402 client packages in the buyer application:

```bash
npm install @modelcontextprotocol/sdk @x402/core @x402/evm @x402/mcp viem
```

Create a wallet account in the buyer's own secret-management environment, then wrap a standard MCP
client with the x402 v2 payment client:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapMCPClientWithPayment } from "@x402/mcp";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.BUYER_PRIVATE_KEY;
if (!privateKey?.startsWith("0x"))
  throw new Error("BUYER_PRIVATE_KEY is required");

const account = privateKeyToAccount(privateKey as `0x${string}`);
const baseMcpClient = new Client({ name: "buyer-agent", version: "1.0.0" });
const paymentClient = new x402Client()
  .registerPolicy((_version, requirements) =>
    requirements.filter(
      (requirement) =>
        "amount" in requirement &&
        requirement.network === "eip155:8453" &&
        requirement.asset.toLowerCase() ===
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" &&
        BigInt(requirement.amount) <= 50_000n,
    ),
  )
  .register("eip155:8453", new ExactEvmScheme(account));

const client = wrapMCPClientWithPayment(baseMcpClient, paymentClient, {
  autoPayment: true,
  onPaymentRequested: async ({ paymentRequired }) =>
    paymentRequired.accepts.some(
      (requirement) =>
        "amount" in requirement &&
        requirement.network === "eip155:8453" &&
        BigInt(requirement.amount) <= 50_000n,
    ),
});

await client.connect(
  new StreamableHTTPClientTransport(
    new URL("https://israel-counterparty-intelligence.vercel.app/mcp"),
  ),
);

const result = await client.callTool("verify_israeli_company_paid", {
  company_number: "514744887",
  language: "en",
});

console.log(result.content);
console.log(result.paymentResponse?.transaction);
```

The first paid tool call receives a structured x402 v2 `PaymentRequired`. The wrapper signs the selected
requirement, retries the same call with `_meta["x402/payment"]`, and exposes the settlement receipt
from `_meta["x402/payment-response"]`.

## REST: protocol sequence

Send the request once without a payment header to receive HTTP `402` and the base64-encoded
`PAYMENT-REQUIRED` header. An x402 v2 HTTP client must select an acceptable requirement, sign it,
and retry the identical request with `PAYMENT-SIGNATURE`. A successful paid response is HTTP `200`
and includes `PAYMENT-RESPONSE` with the settlement receipt.

```bash
curl -i https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet \
  -H 'content-type: application/json' \
  --data '{"company_number":"514744887","language":"en"}'
```

Expected unpaid result: HTTP `402`, x402 version `2`, Base Mainnet, native USDC, amount `50000`
(USDC has six decimals), and the server-owned receiving address. Reject the payment if any of those
values differ.

## Successful-call checklist

A completed call has all of the following:

1. The buyer signed the x402 v2 requirement with its own external wallet.
2. The facilitator verified the signature.
3. The service returned a successful MCP tool result or REST HTTP `200`.
4. `x402/payment-response` or `PAYMENT-RESPONSE` reports a successful settlement and transaction.
5. The Base Mainnet transaction transferred real USDC to the advertised receiving address.

If the client can list MCP tools but stops at `PaymentRequired`, it is not yet using an x402-aware
MCP payment wrapper or its payment policy rejected the network, asset, or 0.05 USDC amount.
