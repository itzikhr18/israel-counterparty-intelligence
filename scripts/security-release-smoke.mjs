import assert from "node:assert/strict";

// No wallet, keys, signing SDK, settlement calls or real invoices. This checks
// containment using public reads and deliberately invalid payment markers.
const base = new URL(process.argv[2] ?? "http://127.0.0.1:3017");
assert(
  (base.protocol === "http:" && base.hostname === "127.0.0.1") ||
    base.origin === "https://israel-counterparty-intelligence.vercel.app",
  "Use the authorized local build or existing production origin only",
);
const evidence = [];
const invoice = {
  supplier_company_number: "514744887",
  invoice_number: "SYNTHETIC-SECURITY-RELEASE-20260907",
  invoice_date: "2026-09-07",
  amount_before_vat: 6000,
  vat_amount: 1080,
  total_amount: 7080,
};
let id = 0;
async function request(path, options = {}) {
  const started = performance.now();
  let response;
  let raw;
  try {
    response = await fetch(new URL(path, base), {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "x-discovery-source": "internal-conversion-audit",
        "user-agent": "ICI-Security-Containment-Smoke/1.0",
        ...options.headers,
      },
    });
    raw = await response.text();
  } catch (error) {
    // Keep the failed boundary in the evidence too. Do not turn a timeout into
    // PASS or silently repeat potentially stateful operations.
    evidence.push({
      path,
      status: response?.status ?? null,
      elapsed_ms: Math.round(performance.now() - started),
      error: error.name,
    });
    throw new Error(`${path}: ${error.message}`, { cause: error });
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  evidence.push({
    path,
    status: response.status,
    elapsed_ms: Math.round(performance.now() - started),
    payment_header:
      response.headers.has("payment-required") ||
      response.headers.has("payment-response"),
  });
  return { response, body };
}
function suspended({ response, body }) {
  assert.equal(response.status, 503);
  assert.equal(body.error?.code, "PAID_SERVICE_SUSPENDED");
  assert.equal(body.payment_attempted, false);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  for (const key of [
    "payment-required",
    "payment-response",
    "x-payment-response",
  ])
    assert.equal(response.headers.has(key), false);
}
async function rpc(path, method, params) {
  const { response, body } = await request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  assert.equal(response.status, 200, `MCP ${path} ${method}`);
  assert.equal(body.error, undefined);
  return body.result;
}
try {
  const health = await request("/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.body.payments.paid_service_suspended, true);
  assert.equal(
    (await request("/?format=json")).body.paid_service.suspended,
    true,
  );
  const discovery = await request("/.well-known/x402");
  assert.equal(discovery.body.paid_service_suspended, true);
  assert.deepEqual(discovery.body.endpoints, []);
  const home = await request("/?format=html");
  assert.match(home.body, /Paid services temporarily suspended/);
  assert.equal(
    (await request("/mcp.json")).body.paid_service.status,
    "suspended",
  );

  const paidPaths = [
    "/v1/verify",
    "/v1/government-footprint",
    "/v1/counterparty-risk",
    "/v1/verify/mainnet",
    "/v1/payment-risk/mainnet",
    "/v1/invoice-gate/mainnet",
    "/v1/company-changes/mainnet",
  ];
  for (const path of paidPaths) {
    for (const signedMarker of [false, true]) {
      suspended(
        await request(path, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(signedMarker
              ? { "payment-signature": "invalid-security-test-not-a-signature" }
              : {}),
          },
          body: "{}",
        }),
      );
    }
  }
  for (const path of ["/mcp", "/mcp/testnet"]) {
    const initialized = await rpc(path, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "internal-conversion-audit", version: "1.0" },
    });
    assert.match(initialized.instructions, /temporarily suspended/);
    const listed = await rpc(path, "tools/list", {});
    assert.equal(listed.tools.length, 13);
    for (const name of [
      "verify_company",
      "verify_israeli_company_paid",
      "assess_israeli_vendor_payment_risk_paid",
      "authorize_israeli_invoice_payment_paid",
      "get_israeli_company_changes_paid",
    ]) {
      const result = await rpc(path, "tools/call", {
        name,
        arguments:
          name === "authorize_israeli_invoice_payment_paid"
            ? invoice
            : {
                company_number: "514744887",
                invoice_company_number: "514744887",
              },
      });
      assert.equal(result.isError, true);
      assert.equal(result._meta, undefined);
      assert.equal(result.structuredContent, undefined);
      const message = JSON.parse(result.content[0].text);
      assert.equal(message.error.code, "PAID_SERVICE_SUSPENDED");
      assert.equal(message.payment_attempted, false);
    }
    const free = await rpc(path, "tools/call", {
      name: "preview_israeli_invoice_payment_gate_free",
      arguments: invoice,
    });
    assert.notEqual(free.isError, true);
  }
  const free = await request("/v1/invoice-gate/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(invoice),
  });
  assert.equal(free.response.status, 200);
  assert.equal(free.body.preview, true);
  assert.equal(free.body.decision.action, "HOLD");
  const form = new URLSearchParams(
    Object.entries(invoice).map(([key, value]) => [key, String(value)]),
  );
  const page = await request("/invoice-preview", {
    method: "POST",
    body: form,
  });
  assert.equal(page.response.status, 200);
  assert.match(page.body, /Paid services temporarily suspended/);
  assert.doesNotMatch(page.body, /--pay|value="wallet-handoff"/);
  suspended(
    await request("/invoice-preview", {
      method: "POST",
      body: new URLSearchParams({
        action: "wallet-handoff",
        invoice_request: JSON.stringify(invoice),
      }),
    }),
  );
  for (const path of ["/v1/pilot/verify", "/mcp/pilot"]) {
    const pilot = await request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.ok(
      [401, 503].includes(pilot.response.status),
      "Pilot must be unauthorized or disabled",
    );
  }
  const largeForm = await request("/invoice-preview", {
    method: "POST",
    body: new URLSearchParams({ padding: "x".repeat(65_537) }),
  });
  assert.equal(largeForm.response.status, 413);
  const largeMcp = await request("/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ padding: "x".repeat(1_048_577) }),
  });
  assert.equal(largeMcp.response.status, 413);
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        origin: base.origin,
        checked_at: new Date().toISOString(),
        request_count: evidence.length,
        synthetic_only: true,
        real_payments_attempted: 0,
        evidence,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.log(
    JSON.stringify(
      {
        status: "FAIL",
        origin: base.origin,
        checked_at: new Date().toISOString(),
        error: error.message,
        evidence,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
