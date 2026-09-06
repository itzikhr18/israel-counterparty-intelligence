import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeRevenueFunnel } from "./revenue-funnel.mjs";

test("funnel excludes tests, deduplicates settlements, and never counts challenges as revenue", () => {
  const paid = {
    event: "external_paid_call",
    settlement_status: "success",
    network: "eip155:8453",
    asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    tx_hash: "0x" + "a".repeat(64),
    amount: "250000",
    timestamp: "2026-09-05T00:00:00Z",
  };
  const rows = [
    paid,
    paid,
    { ...paid, settlement_status: "failed" },
    { event: "mcp_payment_required_delivered", client_class: "external" },
    { event: "invoice_request_downloaded", client_class: "internal_test" },
    { ...paid, discovery_source: "internal-post-deploy-smoke" },
  ].map((event, index) =>
    JSON.stringify({ id: index, message: JSON.stringify(event) }),
  );
  const result = summarizeRevenueFunnel([...rows, "not JSON"]);
  assert.equal(result.observed_gross_usdc, "0.250000");
  assert.equal(result.observed_settled_transactions, 1);
  assert.equal(result.internal_or_pilot_rows_excluded, 2);
  assert.equal(result.external_events.mcp_payment_required_delivered, 1);
});

test("empty logs do not imply all-time zero revenue", () => {
  const result = summarizeRevenueFunnel([]);
  assert.equal(result.first_observed_event, null);
  assert.match(result.scope, /may omit traffic/);
});

test("wallet handoff downloads are intent events, never receipts or unique customers", () => {
  const result = summarizeRevenueFunnel([
    JSON.stringify({
      event: "invoice_wallet_handoff_downloaded",
      client_class: "external",
    }),
    JSON.stringify({
      event: "invoice_wallet_handoff_downloaded",
      client_class: "internal_test",
    }),
  ]);
  assert.equal(result.external_events.invoice_wallet_handoff_downloaded, 1);
  assert.equal(result.observed_gross_usdc, "0.000000");
  assert.equal(result.observed_settled_transactions, 0);
  assert.equal(result.internal_or_pilot_rows_excluded, 1);
  assert.match(result.scope, /not unique people/);
});
