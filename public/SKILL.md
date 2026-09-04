---
name: israel-company-intelligence
description: Gate Israeli invoices before payment, verify Israeli companies, screen suppliers, and monitor registry changes. Use for Israel Invoices allocation-number checks, VAT arithmetic, supplier payments, company lookup, KYB pre-checks, procurement, and invoice-risk triage.
---

# Israel Company Intelligence

Use this service when the target company or supplier is registered in Israel and the task needs machine-readable public-registry evidence.

## Best tool by intent

- Need to check an Israeli tax invoice before payment: call `preview_israeli_invoice_payment_gate_free`, then `authorize_israeli_invoice_payment_paid` for 0.25 USDC. It returns `PAY`, `HOLD`, or `BLOCK` and fails safely when buyer allocation context is missing.
- Need a free identity/status check: call `preview_israeli_company_free`.
- Need recent official filing or status-change events: call `get_israeli_company_changes_paid` for 0.01 USDC on Base Mainnet.
- Need the complete field-level registry evidence report: call `verify_israeli_company_paid` for 0.05 USDC on Base Mainnet.
- Need a decision immediately before paying an Israeli supplier: call `preview_israeli_vendor_payment_risk_free`, then `assess_israeli_vendor_payment_risk_paid` for 0.10 USDC.
- Need to inspect x402 terms before signing: call `preview_agent_payment_trust`; it never signs or submits a payment.

## Connection

- MCP endpoint: `https://israel-counterparty-intelligence.vercel.app/mcp`
- REST discovery: `https://israel-counterparty-intelligence.vercel.app/.well-known/x402`
- OpenAPI: `https://israel-counterparty-intelligence.vercel.app/openapi.json`
- Free browser preview: `https://israel-counterparty-intelligence.vercel.app/#free-preview`

## Input guidance

Prefer an exact nine-digit Israeli company number. A legal company name is also accepted for verification. For invoice checks above the date-sensitive threshold, provide `buyer_is_authorized_dealer` and `buyer_requested_allocation_number`; both are buyer-attested. Reuse the exact arguments returned by the free preview when upgrading to a paid report.

## Evidence boundary

The service provides Israeli public company-registry evidence and buyer-supplied transaction context. Allocation thresholds are applied as strictly greater than the applicable amount; the rule also depends on a VAT component, an authorized-dealer buyer, and a buyer request. Direct Tax Authority verification requires authorized access. Buyer-supplied Tax Authority results are labeled `BUYER_ATTESTED` and are not independently authenticated. It does not verify bank-account ownership and is not sanctions, PEP, UBO, credit, legal, tax, accounting, or Full Regulatory KYB certification.
