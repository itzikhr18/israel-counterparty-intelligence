interface LandingPageOptions {
  providerName: string;
  mcpPrice: string;
  paymentRiskPrice: string;
  companyChangesPrice: string;
  invoiceGatePrice: string;
  restPrice: string;
}

export interface PreviewPageResult {
  resolutionStatus: "RESOLVED" | "AMBIGUOUS" | "NOT_FOUND";
  company: {
    legalName: string;
    companyNumber: string;
    status: string;
  } | null;
  candidates: Array<{
    legalName: string;
    companyNumber: string;
    status: string;
  }>;
  confidence: number;
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

export function renderLandingPage(options: LandingPageOptions): string {
  const providerName = escapeHtml(options.providerName);
  const mcpPrice = escapeHtml(options.mcpPrice);
  const paymentRiskPrice = escapeHtml(options.paymentRiskPrice);
  const companyChangesPrice = escapeHtml(options.companyChangesPrice);
  const invoiceGatePrice = escapeHtml(options.invoiceGatePrice);
  const restPrice = escapeHtml(options.restPrice);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Check an Israeli supplier invoice before payment. VAT arithmetic, allocation-number applicability, company-registry evidence, and a PAY, HOLD, or BLOCK decision for AI agents.">
  <meta name="keywords" content="verify Israeli tax invoice before payment, Israel Invoices allocation number, Israeli supplier payment gate, accounts payable AI agent, Israel company registry, Israeli VAT invoice">
  <link rel="canonical" href="https://israel-counterparty-intelligence.vercel.app/">
  <title>Israeli Invoice Payment Gate for AI Agents · ${providerName}</title>
  <style>
    :root { color-scheme: dark; --bg: #07110f; --panel: #0d1c18; --line: #24433a; --text: #effbf6; --muted: #a9c3b8; --accent: #61e6ad; --accent-dark: #082119; }
    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(circle at 80% 0%, #153b2e 0, var(--bg) 38rem); color: var(--text); font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 72px; }
    nav, .actions, .contract, .steps { display: flex; gap: 12px; flex-wrap: wrap; }
    nav { justify-content: space-between; align-items: center; margin-bottom: 68px; }
    nav a, footer a { color: var(--muted); text-decoration: none; }
    nav a:hover, footer a:hover { color: var(--text); }
    .brand { color: var(--text); font-weight: 720; letter-spacing: -.02em; }
    .status { display: inline-flex; gap: 8px; align-items: center; color: var(--accent); font-size: 14px; font-weight: 650; }
    .status::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 14px var(--accent); }
    .hero { max-width: 850px; }
    .eyebrow { color: var(--accent); font-size: 13px; font-weight: 760; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 12px 0 20px; max-width: 820px; font-size: clamp(42px, 7vw, 76px); line-height: 1.02; letter-spacing: -.055em; }
    h2 { margin: 0 0 12px; font-size: 27px; letter-spacing: -.03em; }
    h3 { margin: 0 0 8px; font-size: 17px; }
    .lead { max-width: 730px; color: var(--muted); font-size: clamp(18px, 2.5vw, 22px); }
    .actions { margin: 30px 0 28px; }
    .button { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 0 18px; border: 1px solid var(--line); border-radius: 10px; color: var(--text); font: inherit; font-weight: 680; text-decoration: none; cursor: pointer; }
    .button.primary { border-color: var(--accent); background: var(--accent); color: #04110c; }
    .button:hover { transform: translateY(-1px); }
    .contract { color: var(--muted); font-size: 14px; }
    .contract span { padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; background: rgba(13, 28, 24, .72); }
    section { margin-top: 86px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .card, .code-card { border: 1px solid var(--line); border-radius: 16px; background: rgba(13, 28, 24, .78); }
    .card { padding: 22px; }
    .card p, .section-copy { margin: 0; color: var(--muted); }
    .code-card { overflow: hidden; }
    .code-title { padding: 12px 16px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 13px; }
    pre { margin: 0; padding: 20px; overflow-x: auto; color: #c9f8e3; font: 13px/1.7 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .steps { counter-reset: step; }
    .step { flex: 1 1 210px; padding: 20px; border-left: 2px solid var(--line); }
    .step::before { counter-increment: step; content: "0" counter(step); display: block; margin-bottom: 12px; color: var(--accent); font-size: 13px; font-weight: 760; }
    .scope { padding: 22px; border: 1px solid #5b4930; border-radius: 14px; background: #211a11; color: #ddcdb3; }
    .preview-panel, .invoice-panel { max-width: 860px; padding: 28px; border: 1px solid var(--line); border-radius: 18px; background: rgba(13, 28, 24, .88); }
    .invoice-panel { border-color: #41685b; }
    .invoice-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 22px; }
    .field { display: grid; gap: 6px; }
    .field.full, .invoice-form .form-actions { grid-column: 1 / -1; }
    .field label { font-weight: 680; }
    .field small { color: var(--muted); font-size: 13px; }
    .field input, .field select { width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid #41685b; border-radius: 10px; background: #07110f; color: var(--text); font: inherit; }
    .field input:focus, .field select:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
    .form-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .form-note { margin: 0; color: var(--muted); font-size: 13px; }
    .preview-form { display: grid; grid-template-columns: 1fr auto; gap: 12px; margin-top: 20px; }
    .preview-form label { grid-column: 1 / -1; font-weight: 680; }
    .preview-form input { min-width: 0; min-height: 48px; padding: 0 14px; border: 1px solid #41685b; border-radius: 10px; background: #07110f; color: var(--text); font: inherit; }
    .preview-form input:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
    .hint { grid-column: 1 / -1; margin: 0; color: var(--muted); font-size: 14px; }
    footer { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: 80px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
    @media (max-width: 760px) { nav { margin-bottom: 48px; } .grid, .invoice-form { grid-template-columns: 1fr; } section { margin-top: 64px; } .preview-panel, .invoice-panel { padding: 22px; } .preview-form { grid-template-columns: 1fr; } .preview-form label, .hint, .field.full, .invoice-form .form-actions { grid-column: auto; } }
  </style>
</head>
<body>
  <main>
    <nav aria-label="Primary navigation">
      <span class="brand">Israel Business Intelligence MCP</span>
      <span class="status">Production live</span>
    </nav>

    <header class="hero">
      <div class="eyebrow">Official-source Israeli business intelligence</div>
      <h1>Stop a bad Israeli invoice before an agent pays it.</h1>
      <p class="lead">Check VAT arithmetic and allocation-number requirements, resolve the supplier, and return PAY, HOLD, or BLOCK. Structured evidence and deterministic decisions for AI agents.</p>
      <div class="actions">
        <a class="button primary" href="#invoice-preview">Check an invoice free</a>
        <a class="button" href="/mcp.json">Inspect MCP metadata</a>
        <a class="button" href="/openapi.json">OpenAPI schema</a>
      </div>
      <div class="contract">
        <span>Invoice gate ${invoiceGatePrice} USDC</span><span>Company changes ${companyChangesPrice} USDC</span><span>Verification ${mcpPrice} USDC</span><span>Payment risk ${paymentRiskPrice} USDC</span><span>Base Mainnet</span><span>x402 v2</span><span>No API key</span>
      </div>
    </header>

    <section aria-labelledby="why-number-one">
      <h2 id="why-number-one">One Israel-specific toolchain, from identity to payment</h2>
      <p class="section-copy">Start with a free invoice or registry preview. Run the full invoice payment gate for ${invoiceGatePrice} USDC, recent company changes for ${companyChangesPrice}, full verification for ${mcpPrice}, or vendor-risk triage for ${paymentRiskPrice}. No subscription and no API key.</p>
    </section>

    <section id="invoice-preview" aria-labelledby="invoice-preview-title">
      <div class="invoice-panel">
        <div class="eyebrow">Free invoice check · no wallet required</div>
        <h2 id="invoice-preview-title">Check an Israeli invoice before payment</h2>
        <p class="section-copy">Enter the invoice figures and two buyer confirmations. We check VAT arithmetic, the total, and whether an Israel Invoices allocation number is required for the date, value, VAT component, and buyer conditions.</p>
        <form class="invoice-form" action="/invoice-preview" method="post">
          <div class="field">
            <label for="supplier-company-number">Supplier company or VAT number</label>
            <input id="supplier-company-number" name="supplier_company_number" type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]{9}" minlength="9" maxlength="9" placeholder="514744887" required>
          </div>
          <div class="field">
            <label for="invoice-number">Invoice number</label>
            <input id="invoice-number" name="invoice_number" type="text" autocomplete="off" maxlength="100" placeholder="INV-2026-001" required>
          </div>
          <div class="field">
            <label for="invoice-date">Invoice date</label>
            <input id="invoice-date" name="invoice_date" type="date" min="2025-01-01" required>
          </div>
          <div class="field">
            <label for="vat-rate">Expected VAT rate</label>
            <select id="vat-rate" name="expected_vat_rate"><option value="18" selected>18%</option><option value="0">0% — exempt or zero-rated only</option></select>
          </div>
          <div class="field">
            <label for="buyer-authorized-dealer">Is the buyer an authorized dealer?</label>
            <select id="buyer-authorized-dealer" name="buyer_is_authorized_dealer" required><option value="" selected disabled>Select an answer</option><option value="true">Yes</option><option value="false">No</option></select>
            <small>Buyer-attested. Required to determine allocation-number applicability.</small>
          </div>
          <div class="field">
            <label for="buyer-requested-allocation">Did the buyer request an allocation number?</label>
            <select id="buyer-requested-allocation" name="buyer_requested_allocation_number" required><option value="" selected disabled>Select an answer</option><option value="true">Yes</option><option value="false">No</option></select>
            <small>Allocation can also be requested voluntarily below the threshold.</small>
          </div>
          <div class="field">
            <label for="amount-before-vat">Amount before VAT (ILS)</label>
            <input id="amount-before-vat" name="amount_before_vat" type="number" inputmode="decimal" min="0.01" max="1000000000" step="0.01" placeholder="6000.00" required>
          </div>
          <div class="field">
            <label for="vat-amount">VAT amount (ILS)</label>
            <input id="vat-amount" name="vat_amount" type="number" inputmode="decimal" min="0" max="1000000000" step="0.01" placeholder="1080.00" required>
          </div>
          <div class="field">
            <label for="total-amount">Invoice total (ILS)</label>
            <input id="total-amount" name="total_amount" type="number" inputmode="decimal" min="0.01" max="1000000000" step="0.01" placeholder="7080.00" required>
          </div>
          <div class="field">
            <label for="allocation-number">Allocation number <small>(if shown)</small></label>
            <input id="allocation-number" name="allocation_number" type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]{9}" minlength="9" maxlength="9" placeholder="123456789">
          </div>
          <div class="form-actions">
            <button class="button primary" type="submit">Check invoice free</button>
            <p class="form-note">Buyer answers are treated as declarations. The free check never authorizes payment or contacts the Tax Authority.</p>
          </div>
        </form>
      </div>
    </section>

    <section id="free-preview" aria-labelledby="free-preview-title">
      <div class="preview-panel">
        <div class="eyebrow">Free · no wallet required</div>
        <h2 id="free-preview-title">Check an Israeli company now</h2>
        <p class="section-copy">Enter a nine-digit Israeli company number. The free preview returns the matched legal name and current registry status without exposing the paid evidence report.</p>
        <form class="preview-form" action="/preview" method="get">
          <label for="company-number">Israeli company number</label>
          <input id="company-number" name="company_number" type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]{9}" minlength="9" maxlength="9" placeholder="514744887" aria-describedby="company-number-hint" required>
          <button class="button primary" type="submit">Check company free</button>
          <p class="hint" id="company-number-hint">Try 514744887 to preview a known public company record.</p>
        </form>
      </div>
    </section>

    <section aria-labelledby="use-cases">
      <h2 id="use-cases">Built for real counterparty workflows</h2>
      <p class="section-copy">Use the evidence as one input inside your existing decision process.</p>
      <div class="grid" style="margin-top: 20px">
        <article class="card"><h3>Supplier onboarding</h3><p>Confirm the Israeli legal entity before qualification, procurement, or vendor-master creation.</p></article>
        <article class="card"><h3>Company-change monitoring</h3><p>Check recent official filings and status-change events for an exact company number, newest first.</p></article>
        <article class="card"><h3>Agentic commerce</h3><p>Give an agent a structured jurisdiction-specific trust signal with sources and confidence.</p></article>
        <article class="card"><h3>Invoice payment gate</h3><p>Check VAT math, allocation-number rules, supplier identity, and payment-risk signals before funds move.</p></article>
        <article class="card"><h3>Pre-sign payment firewall</h3><p>Fingerprint x402 terms and return ALLOW, REVIEW, or DENY before the buyer wallet signs.</p></article>
      </div>
    </section>

    <section aria-labelledby="connect">
      <h2 id="connect">Connect over MCP</h2>
      <p class="section-copy">Start with <code>preview_israeli_invoice_payment_gate_free</code> for an invoice, then use <code>authorize_israeli_invoice_payment_paid</code>. Company verification, changes, vendor risk, and the <code>preview_agent_payment_trust</code> x402 pre-sign firewall remain available.</p>
      <div class="code-card" style="margin-top: 20px">
        <div class="code-title">Continue with the invoice JSON downloaded after the free check</div>
        <pre tabindex="0"><code>npx --yes https://israel-counterparty-intelligence.vercel.app/israel-company-verify-buyer-0.4.0.tgz --invoice-file invoice-request.json</code></pre>
      </div>
      <p class="section-copy" style="margin-top: 12px">Free by default. Add <code>--pay</code> only to authorize one invoice report, capped at 0.25 USDC, using your agent's own wallet. The fee buys evidence; the decision may still be HOLD or BLOCK. <a href="/x402-buyer-quickstart.md" style="color: var(--accent)">Purchase and wallet guide</a> · <a href="https://github.com/itzikhr18/israel-counterparty-intelligence/tree/main/buyer-bridge" style="color: var(--accent)">Inspect buyer source</a></p>
    </section>

    <section aria-labelledby="flow">
      <h2 id="flow">From request to evidence</h2>
      <div class="steps">
        <div class="step"><h3>Submit identity</h3><p class="section-copy">Use an Israeli company number or a legal name with optional context.</p></div>
        <div class="step"><h3>Approve payment</h3><p class="section-copy">Your buyer-controlled wallet validates the fixed x402 contract.</p></div>
        <div class="step"><h3>Receive evidence</h3><p class="section-copy">Get structured registry fields, sources, confidence, and missing-data disclosure.</p></div>
      </div>
    </section>

    <section aria-labelledby="rest">
      <h2 id="rest">REST is available too</h2>
      <div class="code-card">
        <div class="code-title">Inspect the ${restPrice} Mainnet payment challenge without paying</div>
        <pre tabindex="0"><code>curl -i https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet \\
  -H 'content-type: application/json' \\
  --data '{"company_number":"514744887","language":"en"}'</code></pre>
      </div>
      <div class="code-card" style="margin-top: 16px">
        <div class="code-title">Run the free invoice structural preview</div>
        <pre tabindex="0"><code>curl -X POST https://israel-counterparty-intelligence.vercel.app/v1/invoice-gate/preview \
  -H 'content-type: application/json' \
  --data '{"supplier_company_number":"514744887","invoice_number":"INV-1","invoice_date":"2026-09-04","amount_before_vat":6000,"vat_amount":1080,"total_amount":7080,"buyer_is_authorized_dealer":true,"buyer_requested_allocation_number":true,"allocation_number":"123456789"}'</code></pre>
      </div>
      <div class="code-card" style="margin-top: 16px">
        <div class="code-title">Inspect the $${paymentRiskPrice} vendor payment-risk challenge</div>
        <pre tabindex="0"><code>curl -i https://israel-counterparty-intelligence.vercel.app/v1/payment-risk/mainnet \
  -H 'content-type: application/json' \
  --data '{"company_number":"514744887","invoice_company_number":"514744887","invoice_company_name":"מנדיי. קום בעמ"}'</code></pre>
      </div>
      <div class="code-card" style="margin-top: 16px">
        <div class="code-title">Inspect the $${companyChangesPrice} recent company-changes challenge</div>
        <pre tabindex="0"><code>curl -i https://israel-counterparty-intelligence.vercel.app/v1/company-changes/mainnet \
  -H 'content-type: application/json' \
  --data '{"company_number":"514744887","lookback_days":366,"limit":25}'</code></pre>
      </div>
    </section>

    <section class="scope" aria-labelledby="scope">
      <h2 id="scope">Evidence scope</h2>
      Public Israeli company-registry evidence and buyer-provided transaction context only. Direct Tax Authority verification requires authorized access; buyer-supplied results are clearly labeled and never presented as independently authenticated. The service does not verify bank-account ownership and is not legal, tax, accounting, credit, or compliance advice.
    </section>

    <footer>
      <span>${providerName}</span>
      <span><a href="/?format=json">Machine-readable service manifest</a> · <a href="/health">Health</a> · <a href="/README.md">Documentation</a></span>
    </footer>
  </main>
</body>
</html>`;
}

export function renderPreviewPage(options: {
  providerName: string;
  companyNumber: string;
  result?: PreviewPageResult;
  error?: string;
}): string {
  const providerName = escapeHtml(options.providerName);
  const error = options.error ? escapeHtml(options.error) : null;
  const result = options.result;
  const resolved = result?.company;
  const confidence = result ? `${Math.round(result.confidence * 100)}%` : null;
  const checkedAt = result
    ? escapeHtml(
        new Date(result.checkedAt).toLocaleString("en-GB", {
          timeZone: "Asia/Jerusalem",
        }),
      )
    : null;

  const candidates = result?.candidates.length
    ? `<div class="candidates"><h2>Possible matches</h2>${result.candidates
        .map(
          (candidate) =>
            `<article><strong>${escapeHtml(candidate.legalName)}</strong><span>${escapeHtml(candidate.companyNumber)} · ${escapeHtml(candidate.status)}</span></article>`,
        )
        .join("")}</div>`
    : "";

  const resultContent = error
    ? `<div class="notice error" role="alert"><strong>We could not run this preview.</strong><span>${error}</span></div>`
    : resolved && result
      ? `<div class="result" aria-live="polite">
          <div class="result-status">Company found</div>
          <h1>${escapeHtml(resolved.legalName)}</h1>
          <dl>
            <div><dt>Company number</dt><dd>${escapeHtml(resolved.companyNumber)}</dd></div>
            <div><dt>Registry status</dt><dd>${escapeHtml(resolved.status)}</dd></div>
            <div><dt>Match confidence</dt><dd>${confidence}</dd></div>
            <div><dt>Checked</dt><dd>${checkedAt}</dd></div>
          </dl>
        </div>`
      : result
        ? `<div class="notice" aria-live="polite"><strong>${result.resolutionStatus === "AMBIGUOUS" ? "More than one possible company was found." : "No reliable company match was found."}</strong><span>${result.resolutionStatus === "AMBIGUOUS" ? "Choose an exact company number from the possible matches below." : "Check the company number and try again."}</span></div>${candidates}`
        : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Free company preview · ${providerName}</title>
  <style>
    :root { color-scheme: dark; --bg: #07110f; --panel: #0d1c18; --line: #24433a; --text: #effbf6; --muted: #a9c3b8; --accent: #61e6ad; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 80% 0%, #153b2e 0, var(--bg) 38rem); color: var(--text); font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(760px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 72px; }
    nav { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 58px; }
    a { color: var(--accent); }
    .brand { color: var(--text); font-weight: 720; text-decoration: none; }
    .back { color: var(--muted); text-decoration: none; }
    .result, .notice, .candidates { padding: 28px; border: 1px solid var(--line); border-radius: 18px; background: rgba(13, 28, 24, .88); }
    .result-status { color: var(--accent); font-size: 13px; font-weight: 760; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 10px 0 24px; font-size: clamp(32px, 7vw, 52px); line-height: 1.08; letter-spacing: -.04em; }
    h2 { margin: 0 0 14px; font-size: 22px; }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0; }
    dl div, .candidates article { padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: #091612; }
    dt { color: var(--muted); font-size: 13px; }
    dd { margin: 4px 0 0; font-weight: 680; overflow-wrap: anywhere; }
    .notice { display: grid; gap: 6px; }
    .notice span { color: var(--muted); }
    .notice.error { border-color: #74443d; background: #241411; }
    .candidates { margin-top: 16px; }
    .candidates article { display: grid; gap: 3px; margin-top: 10px; }
    .candidates span { color: var(--muted); }
    .offer { margin-top: 22px; padding: 24px; border: 1px solid #41685b; border-radius: 16px; background: rgba(20, 48, 39, .82); }
    .offer h2 { margin-bottom: 6px; }
    .offer p { margin: 0 0 18px; color: var(--muted); }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .button { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 10px; color: var(--text); font-weight: 680; text-decoration: none; }
    .button.primary { border-color: var(--accent); background: var(--accent); color: #04110c; }
    .scope { margin-top: 18px; color: var(--muted); font-size: 13px; }
    @media (max-width: 560px) { nav { margin-bottom: 38px; } .result, .notice, .candidates { padding: 22px; } dl { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <nav><a class="brand" href="/">${providerName}</a><a class="back" href="/#free-preview">← New search</a></nav>
    ${resultContent}
    ${resolved ? `<section class="offer"><h2>Need the complete evidence?</h2><p>Unlock recent official company changes for $0.01 USDC or the complete field-level registry report for $0.05 USDC.</p><div class="actions"><a class="button primary" href="/x402-buyer-quickstart.md">Get the full report</a><a class="button" href="/openapi.json">API details</a></div></section>` : ""}
    <p class="scope">Free preview only: legal identity, registry status, and match confidence. No address, source URLs, filing details, or full verification evidence are included. Not legal, credit, sanctions, or investment advice.</p>
  </main>
</body>
</html>`;
}
