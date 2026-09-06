# Agentskills.co.il MCP submission package

Use this package on `https://agentskills.co.il/he/mcp/submit`. The listing is for the existing MCP server, not a duplicate wrapper skill.

## Listing fields

- Name: `Israel Invoice Payment Gate and Company Intelligence`
- MCP server URL: `https://israel-counterparty-intelligence.vercel.app/mcp`
- Website: `https://israel-counterparty-intelligence.vercel.app/`
- Repository: `https://github.com/itzikhr18/israel-counterparty-intelligence`
- Metadata: `https://israel-counterparty-intelligence.vercel.app/mcp.json`
- Transport: `Streamable HTTP`
- Authentication: `No API key for discovery and free tools; paid tools use x402 v2`
- Independent-wallet guide: `https://israel-counterparty-intelligence.vercel.app/trusted-wallet-guide.md` (buyer may use its own trusted x402 client; seller wallet package is optional)
- Category: `Accounting` (secondary: `Government Services`, `Tax and Finance`)
- License: `MIT`
- Language: `English API and structured output; Israeli/Hebrew company records are preserved`

## Short description - Hebrew

שער תשלום לחשבוניות ספק ישראליות עבור סוכני AI. בודק חישובי מע"מ, תנאי מספר הקצאה לפי תאריך, סכום והצהרות קונה, מצליב את הספק מול מרשם החברות ומחזיר PAY, HOLD או BLOCK. תצוגה מקדימה חינמית; כלים מלאים בתשלום USDC זעיר דרך x402, ללא מנוי וללא מפתח API.

## Short description - English

Pre-payment gate for Israeli supplier invoices and AI agents. Checks VAT arithmetic and allocation-number applicability using date, amount, VAT component, and buyer-attested conditions; resolves the supplier against public company-registry evidence; and returns PAY, HOLD, or BLOCK. Free preview plus pay-per-call x402 tools, with no subscription or API key.

## Search tags

`israel`, `invoice`, `supplier`, `accounts-payable`, `vat`, `allocation-number`, `israel-invoices`, `company-registry`, `vendor-risk`, `payment-gate`, `procurement`, `mcp`, `x402`, `pay-hold-block`

## Recommended first call

1. Call `preview_israeli_invoice_payment_gate_free` with the invoice figures and buyer allocation conditions.
2. If the structural preview is `BLOCK` or allocation applicability is `UNKNOWN`, stop and complete the inputs. Resolve the supplier with the free company preview before purchase.
3. Only with a real need for the evidence and buyer approval of one 0.25 USDC report, use `authorize_israeli_invoice_payment_paid` or the equivalent REST route with the buyer's trusted wallet. The wallet must enforce its own payment policy. A paid report can still be HOLD or BLOCK.

## Evidence and safety boundary

- Allocation thresholds use a strictly-greater-than comparison.
- Mandatory applicability also depends on a VAT component, an authorized-dealer buyer, and a buyer request.
- Missing buyer context fails safely to `HOLD`.
- Buyer-supplied Tax Authority results are labeled `BUYER_ATTESTED` and are not independently authenticated.
- Direct Tax Authority verification requires authorized access.
- The service is decision support, not tax, legal, accounting, credit, sanctions, PEP, UBO, or bank-account-ownership certification.

## Prices

- Invoice payment gate: `0.25 USDC`
- Vendor payment risk: `0.10 USDC`
- Full company verification: `0.05 USDC`
- Company changes: `0.01 USDC`
- Network: `Base Mainnet`
- Protocol: `x402 v2`

## Reviewer test

- Open the website and complete the free browser invoice check without a wallet.
- Connect to the MCP endpoint and list tools.
- Call `describe_service` and `preview_israeli_invoice_payment_gate_free` without payment.
- An unpaid paid-tool call must return a structured x402 v2 payment requirement, not a result.
- The free browser result offers a private independent-wallet request download, after a free exact supplier match. Downloading is not payment approval. No funded reviewer test is requested.
