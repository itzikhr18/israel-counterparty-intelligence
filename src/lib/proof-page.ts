import { config, paymentEnvironments } from "@/lib/config";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderProofPage(options?: { providerName?: string }): string {
  const providerName = escapeHtml(
    options?.providerName ?? config.PROVIDER_NAME,
  );
  const receivingWallet = escapeHtml(paymentEnvironments.mainnet.payTo);
  const network = escapeHtml(paymentEnvironments.mainnet.network);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Live Base Mainnet settlement proof for Israel Counterparty Intelligence.">
  <meta name="theme-color" content="#111111">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="https://israel-counterparty-intelligence.vercel.app/proof">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <title>Settlement proof · ${providerName}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f7f5;
      --surface: #ffffff;
      --text: #161616;
      --muted: #5c5c5c;
      --line: #e4e4e0;
      --ok: #1a7f4b;
      --warn: #8a6d1d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(720px, calc(100% - 40px));
      margin: 0 auto;
      padding: 48px 0 80px;
    }
    nav {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
      margin-bottom: 56px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-size: 14px;
    }
    nav a { color: var(--muted); text-decoration: none; }
    nav a:hover { color: var(--text); }
    .brand { color: var(--text); font-weight: 600; letter-spacing: -0.01em; }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(28px, 4vw, 36px);
      font-weight: 650;
      letter-spacing: -0.03em;
      line-height: 1.15;
    }
    .lede {
      margin: 0 0 40px;
      color: var(--muted);
      font-size: 15px;
      max-width: 38rem;
    }
    .status-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      align-items: center;
      margin-bottom: 28px;
      font-size: 13px;
      color: var(--muted);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--text);
      font-weight: 600;
    }
    .pill::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #b0b0b0;
    }
    .pill.ok { color: var(--ok); }
    .pill.ok::before { background: var(--ok); }
    .pill.warn { color: var(--warn); }
    .pill.warn::before { background: var(--warn); }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 16px 18px;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid var(--line);
      font-size: 14px;
    }
    tr:last-child th, tr:last-child td { border-bottom: none; }
    th {
      width: 34%;
      color: var(--muted);
      font-weight: 550;
      background: #fafaf8;
    }
    td { font-weight: 500; overflow-wrap: anywhere; }
    code {
      font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: var(--text);
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 20px;
      margin-top: 28px;
      font-size: 14px;
    }
    .links a { color: var(--text); text-decoration: underline; text-underline-offset: 3px; }
    .links a:hover { color: var(--muted); }
    footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <main>
    <nav aria-label="Primary">
      <a class="brand" href="/">${providerName}</a>
      <a href="/">Home</a>
    </nav>

    <h1>Settlement proof</h1>
    <p class="lede">Live Base Mainnet evidence for the first external x402 payment. Values come from same-origin <a href="/health">/health</a> and refresh about every 15 seconds.</p>

    <div class="status-row" aria-live="polite">
      <span id="poll-status" class="pill warn">Loading</span>
      <span id="poll-age">—</span>
    </div>

    <table>
      <tbody>
        <tr>
          <th scope="row">Transaction</th>
          <td><code id="tx-hash">—</code></td>
        </tr>
        <tr>
          <th scope="row">Amount</th>
          <td id="amount">—</td>
        </tr>
        <tr>
          <th scope="row">Network</th>
          <td id="network-label">${network} · Base</td>
        </tr>
        <tr>
          <th scope="row">Receiving wallet</th>
          <td><code id="pay-to">${receivingWallet}</code></td>
        </tr>
        <tr>
          <th scope="row">payments.first_external_paid_call</th>
          <td id="first-status">—</td>
        </tr>
        <tr>
          <th scope="row">Resource</th>
          <td><code id="resource">—</code></td>
        </tr>
      </tbody>
    </table>

    <div class="links">
      <a id="basescan" href="https://basescan.org/" target="_blank" rel="noopener noreferrer">View on Basescan</a>
      <a href="/health">Open /health</a>
      <a href="/STATUS.md">STATUS</a>
    </div>

    <footer>
      Same-origin health only. No redirect wrappers. Poll interval ~15s · cache: no-store.
    </footer>
  </main>
  <script>
(function () {
  var pollMs = 15000;
  var statusEl = document.getElementById("poll-status");
  var ageEl = document.getElementById("poll-age");
  var txEl = document.getElementById("tx-hash");
  var amountEl = document.getElementById("amount");
  var networkEl = document.getElementById("network-label");
  var firstStatusEl = document.getElementById("first-status");
  var resourceEl = document.getElementById("resource");
  var basescanEl = document.getElementById("basescan");
  var payToEl = document.getElementById("pay-to");
  var lastOkAt = null;

  function render(data) {
    var payments = (data && data.payments) || {};
    var first = payments.first_external_paid_call || null;
    if (payments.receiving_wallet) {
      payToEl.textContent = payments.receiving_wallet;
    }
    if (first && first.tx_hash) {
      txEl.textContent = first.tx_hash;
      amountEl.textContent = (first.amount_usdc || "—") + " USDC";
      networkEl.textContent = (first.network || payments.mainnet_network || "eip155:8453") + " · Base";
      firstStatusEl.textContent = first.durable ? "present · durable" : "present";
      resourceEl.textContent = first.route || first.resource || "—";
      basescanEl.href = "https://basescan.org/tx/" + first.tx_hash;
    } else {
      txEl.textContent = "none";
      amountEl.textContent = "—";
      networkEl.textContent = (payments.mainnet_network || "eip155:8453") + " · Base";
      firstStatusEl.textContent = "null";
      resourceEl.textContent = "—";
      basescanEl.href = "https://basescan.org/";
    }
    statusEl.textContent = "Live";
    statusEl.className = "pill ok";
    lastOkAt = Date.now();
    ageEl.textContent = "Updated just now";
  }

  function tickAge() {
    if (!lastOkAt) return;
    var sec = Math.round((Date.now() - lastOkAt) / 1000);
    ageEl.textContent = sec < 2 ? "Updated just now" : ("Updated " + sec + "s ago");
  }

  function load() {
    fetch("/health", { cache: "no-store", headers: { accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(render)
      .catch(function (err) {
        statusEl.textContent = "Unavailable";
        statusEl.className = "pill warn";
        firstStatusEl.textContent = String(err && err.message ? err.message : err);
      });
  }

  load();
  setInterval(load, pollMs);
  setInterval(tickAge, 1000);
})();
  </script>
</body>
</html>`;
}
