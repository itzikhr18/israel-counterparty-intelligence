interface LandingPageOptions {
  providerName: string;
  mcpPrice: string;
  paymentRiskPrice: string;
  companyChangesPrice: string;
  restPrice: string;
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
  const restPrice = escapeHtml(options.restPrice);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="An agent-native pre-sign payment firewall with structured Israeli company-registry evidence.">
  <title>${providerName}</title>
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
    .button { display: inline-flex; align-items: center; min-height: 46px; padding: 0 18px; border: 1px solid var(--line); border-radius: 10px; color: var(--text); font-weight: 680; text-decoration: none; }
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
    footer { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: 80px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
    @media (max-width: 760px) { nav { margin-bottom: 48px; } .grid { grid-template-columns: 1fr; } section { margin-top: 64px; } }
  </style>
</head>
<body>
  <main>
    <nav aria-label="Primary navigation">
      <span class="brand">Israel Business Intelligence MCP</span>
      <span class="status">Production live</span>
    </nav>

    <header class="hero">
      <div class="eyebrow">Verified payee firewall</div>
      <h1>Know who an agent will pay before its wallet signs.</h1>
      <p class="lead">Bind an Israeli legal entity, service domain, signed payee manifest, destination wallet, and buyer mandate into one machine-enforceable decision.</p>
      <div class="actions">
        <a class="button primary" href="/x402-buyer-quickstart.md">Run a free preview</a>
        <a class="button" href="/mcp.json">Inspect MCP metadata</a>
        <a class="button" href="/openapi.json">OpenAPI schema</a>
      </div>
      <div class="contract" aria-label="Payment contract">
        <span>Company changes ${companyChangesPrice} USDC</span><span>Verification ${mcpPrice} USDC</span><span>Payment risk ${paymentRiskPrice} USDC</span><span>Base Mainnet</span><span>x402 v2</span><span>No API key</span>
      </div>
    </header>

    <section aria-labelledby="use-cases">
      <h2 id="use-cases">Built for real counterparty workflows</h2>
      <p class="section-copy">Use the evidence as one input inside your existing decision process.</p>
      <div class="grid" style="margin-top: 20px">
        <article class="card"><h3>Supplier onboarding</h3><p>Confirm the Israeli legal entity before qualification, procurement, or vendor-master creation.</p></article>
        <article class="card"><h3>Company-change monitoring</h3><p>Check recent official filings and status-change events for an exact company number, newest first.</p></article>
        <article class="card"><h3>Agentic commerce</h3><p>Give an agent a structured jurisdiction-specific trust signal with sources and confidence.</p></article>
        <article class="card"><h3>Pre-sign payment firewall</h3><p>Fingerprint x402 terms and return ALLOW, REVIEW, or DENY before the buyer wallet signs.</p></article>
      </div>
    </section>

    <section aria-labelledby="connect">
      <h2 id="connect">Connect over MCP</h2>
      <p class="section-copy">Start with <code>preview_agent_payment_trust</code> before an x402 payment, <code>preview_israeli_company_free</code> for registry verification, <code>get_israeli_company_changes_paid</code> for recent corporate events, or <code>preview_israeli_vendor_payment_risk_free</code> before a conventional vendor payment.</p>
      <div class="code-card" style="margin-top: 20px">
        <div class="code-title">One-command free preview · public source on GitHub</div>
        <pre><code>npx --yes github:itzikhr18/israel-company-verify-buyer \\
  --company-number 514744887</code></pre>
      </div>
      <p class="section-copy" style="margin-top: 12px"><a href="https://github.com/itzikhr18/israel-company-verify-buyer" style="color: var(--accent)">Inspect the buyer bridge source and release</a></p>
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
        <pre><code>curl -i https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet \\
  -H 'content-type: application/json' \\
  --data '{"company_number":"514744887","language":"en"}'</code></pre>
      </div>
      <div class="code-card" style="margin-top: 16px">
        <div class="code-title">Inspect the $${paymentRiskPrice} vendor payment-risk challenge</div>
        <pre><code>curl -i https://israel-counterparty-intelligence.vercel.app/v1/payment-risk/mainnet \
  -H 'content-type: application/json' \
  --data '{"company_number":"514744887","invoice_company_number":"514744887","invoice_company_name":"מנדיי. קום בעמ"}'</code></pre>
      </div>
      <div class="code-card" style="margin-top: 16px">
        <div class="code-title">Inspect the $${companyChangesPrice} recent company-changes challenge</div>
        <pre><code>curl -i https://israel-counterparty-intelligence.vercel.app/v1/company-changes/mainnet \
  -H 'content-type: application/json' \
  --data '{"company_number":"514744887","lookback_days":366,"limit":25}'</code></pre>
      </div>
    </section>

    <section class="scope" aria-labelledby="scope">
      <h2 id="scope">Evidence scope</h2>
      Public Israeli company-registry evidence and buyer-provided transaction context only. This service does not verify bank-account ownership or invoice authenticity and is not full regulatory KYB, legal advice, sanctions screening, UBO or PEP research, credit advice, or a compliance certification.
    </section>

    <footer>
      <span>${providerName}</span>
      <span><a href="/?format=json">Machine-readable service manifest</a> · <a href="/health">Health</a> · <a href="/README.md">Documentation</a></span>
    </footer>
  </main>
</body>
</html>`;
}
