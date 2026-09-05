export interface InvoicePreviewPageResult {
  action: "PAY" | "HOLD" | "BLOCK";
  score: number;
  reasonCodes: string[];
  explanation: string;
  allocationRequired: boolean | null;
  allocationApplicability: "REQUIRED" | "NOT_REQUIRED" | "UNKNOWN";
  allocationMissingInputs: string[];
  allocationThresholdIls: number;
  invoiceDate: string;
  amountBeforeVat: number;
  vatAmount: number;
  totalAmount: number;
  checks: Array<{
    code: string;
    status: string;
    claimed: unknown;
    observed: unknown;
  }>;
  checkedAt: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return escapeHtml(String(value));
}

const CHECK_LABELS: Record<string, string> = {
  VAT_ARITHMETIC: "VAT calculation",
  INVOICE_TOTAL_ARITHMETIC: "Invoice total",
  ALLOCATION_NUMBER_PRESENT: "Allocation number",
  BUYER_AUTHORIZED_DEALER: "Buyer is an authorized dealer",
  BUYER_REQUESTED_ALLOCATION_NUMBER: "Buyer requested allocation number",
};

const REASON_LABELS: Record<string, string> = {
  INVOICE_ARITHMETIC_MISMATCH:
    "One or more invoice amounts do not add up. Correct them before payment.",
  ALLOCATION_NUMBER_REQUIRED:
    "An allocation number is required for this invoice value and date.",
  ALLOCATION_REQUIREMENT_CONTEXT_MISSING:
    "Buyer status or allocation-request information is missing. Confirm both before payment.",
  PAID_REGISTRY_GATE_REQUIRED:
    "The figures passed. Supplier registry verification is still required before payment.",
};

export function renderInvoicePreviewPage(options: {
  providerName: string;
  result?: InvoicePreviewPageResult;
  error?: string;
  invoiceRequest?: Record<string, unknown>;
}): string {
  const providerName = escapeHtml(options.providerName);
  const result = options.result;
  const error = options.error ? escapeHtml(options.error) : null;
  const purchaseSteps = options.invoiceRequest
    ? `<form action="/invoice-preview" method="post"><input type="hidden" name="invoice_request" value="${escapeHtml(JSON.stringify(options.invoiceRequest))}"><button class="button primary" type="submit" name="action" value="download">1. Download this invoice request</button></form>
    <p>2. In the folder containing the download, run this free check with Node.js 20.9+:</p>
    <pre tabindex="0"><code>npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz --invoice-file invoice-request.json</code></pre>
    <p>3. Only when ready, add <code>--pay</code> to authorize one report, capped at 0.25 USDC. Your agent needs its own Base USDC wallet configured in its secret environment. Never share its private key here.</p>
    <p>The bridge checks invoice structure and resolves the supplier for free before signing. A paid report may still return HOLD or BLOCK; the fee buys evidence, not a guaranteed approval. We do not independently verify Tax Authority results or bank ownership.</p>
    ${result?.allocationRequired ? "<p><strong>Official allocation verification is still needed.</strong> Without it, the full gate will hold payment even after you purchase the supplier evidence.</p>" : ""}
    <p>This is an agent/CLI purchase flow, not browser-wallet or card checkout. The downloaded JSON contains your invoice data; keep it private.</p>
    <a class="button" href="/x402-buyer-quickstart.md">Wallet setup and integration guide</a>`
    : "";
  const statusClass = result?.action.toLocaleLowerCase("en") ?? "error";
  const actionTitle =
    result?.action === "BLOCK"
      ? "Do not pay yet"
      : result?.allocationApplicability === "UNKNOWN"
        ? "Confirm the buyer conditions"
        : result?.action === "HOLD"
          ? "Hold for the next check"
          : "Ready for the paid supplier gate";
  const resultHtml = error
    ? `<section class="result error" role="alert"><div class="eyebrow">Input problem</div><h1>We could not check this invoice</h1><p>${error}</p></section>`
    : result
      ? `<section class="result ${statusClass}" aria-live="polite">
          <div class="eyebrow">Free invoice result · ${result.action}</div>
          <h1>${actionTitle}</h1>
          <p>${escapeHtml(result.explanation)}</p>
          <div class="summary">
            <div><span>Allocation requirement</span><strong>${result.allocationRequired === true ? "Required" : result.allocationRequired === false ? "Not required" : "Need buyer answers"}</strong></div>
            <div><span>Current threshold</span><strong>₪${result.allocationThresholdIls.toLocaleString("en-US")}</strong></div>
            <div><span>Amount before VAT</span><strong>₪${result.amountBeforeVat.toLocaleString("en-US")}</strong></div>
            <div><span>Invoice total</span><strong>₪${result.totalAmount.toLocaleString("en-US")}</strong></div>
          </div>
          <div class="checks"><h2>Checks performed</h2>${result.checks
            .map(
              (check) =>
                `<div class="check"><span>${escapeHtml(CHECK_LABELS[check.code] ?? check.code)}</span><strong class="${check.status.toLocaleLowerCase("en")}">${escapeHtml(check.status)}</strong><small>Invoice: ${formatValue(check.claimed)} · Expected: ${formatValue(check.observed)}</small></div>`,
            )
            .join("")}</div>
          <div class="reasons">${result.reasonCodes
            .map((code) => `<p>${escapeHtml(REASON_LABELS[code] ?? code)}</p>`)
            .join("")}</div>
        </section>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Free Israeli invoice check · ${providerName}</title>
  <style>
    :root { color-scheme: dark; --bg: #07110f; --panel: #0d1c18; --line: #24433a; --text: #effbf6; --muted: #a9c3b8; --accent: #61e6ad; --warn: #f3c96b; --danger: #ff8c7d; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 80% 0%, #153b2e 0, var(--bg) 38rem); color: var(--text); font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(820px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 72px; }
    nav { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 48px; }
    a { color: var(--accent); }
    .brand { color: var(--text); font-weight: 720; text-decoration: none; }
    .back { color: var(--muted); text-decoration: none; }
    .result, .offer { padding: 28px; border: 1px solid var(--line); border-radius: 18px; background: rgba(13, 28, 24, .9); }
    .result.hold { border-color: #6b5c35; }
    .result.block, .result.error { border-color: #74443d; }
    .eyebrow { color: var(--accent); font-size: 13px; font-weight: 760; letter-spacing: .1em; text-transform: uppercase; }
    .block .eyebrow, .error .eyebrow { color: var(--danger); }
    .hold .eyebrow { color: var(--warn); }
    h1 { margin: 10px 0 12px; font-size: clamp(34px, 7vw, 54px); line-height: 1.08; letter-spacing: -.04em; }
    h2 { margin: 26px 0 10px; font-size: 20px; }
    p { color: var(--muted); }
    .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 24px; }
    .summary div, .check { padding: 15px; border: 1px solid var(--line); border-radius: 12px; background: #091612; }
    .summary span, .check span, .check small { display: block; color: var(--muted); }
    .summary strong { display: block; margin-top: 3px; font-size: 19px; }
    .check { display: grid; grid-template-columns: 1fr auto; gap: 4px 14px; margin-top: 9px; }
    .check small { grid-column: 1 / -1; overflow-wrap: anywhere; }
    .match, .pass { color: var(--accent); }
    .mismatch, .missing { color: var(--danger); }
    .reasons { margin-top: 20px; }
    .reasons p { margin: 8px 0; padding-left: 14px; border-left: 2px solid var(--line); }
    .offer { margin-top: 18px; }
    .offer h2 { margin-top: 0; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
    .button { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 10px; color: var(--text); font-weight: 680; text-decoration: none; }
    .button.primary { border-color: var(--accent); background: var(--accent); color: #04110c; }
    .scope { margin-top: 18px; color: var(--muted); font-size: 13px; }
    pre { overflow-x: auto; white-space: pre-wrap; overflow-wrap: anywhere; background: #07110f; padding: 16px; border-radius: 10px; }
    button { font: inherit; cursor: pointer; }
    @media (max-width: 600px) { nav { margin-bottom: 34px; } .result, .offer { padding: 22px; } .summary { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <nav><a class="brand" href="/">${providerName}</a><a class="back" href="/#invoice-preview">← Check another invoice</a></nav>
    ${resultHtml}
    ${result ? `<section class="offer"><h2>${result.action === "BLOCK" ? "Correct the invoice first" : result.allocationApplicability === "UNKNOWN" ? "Complete the buyer answers first" : "Continue with this invoice · 0.25 USDC"}</h2><p>${result.action === "BLOCK" ? "Return to the invoice and correct the fields identified above before any further verification." : result.allocationApplicability === "UNKNOWN" ? "Confirm whether the buyer is an authorized dealer and requested an allocation number. Paying for the full gate before that would only return HOLD." : "The paid gate resolves the supplier against the Israeli company registry and combines the invoice with vendor-risk signals for $0.25 USDC. No subscription or API key."}</p>${result.action === "BLOCK" || result.allocationApplicability === "UNKNOWN" ? `<a class="button primary" href="/#invoice-preview">Return to invoice form</a>` : purchaseSteps}</section>` : ""}
    <p class="scope">This free structural check is not authorization to pay and does not contact the Israel Tax Authority. Direct official verification requires authorized access.</p>
  </main>
</body>
</html>`;
}
