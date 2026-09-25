import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildInvoiceLines,
  renderCsv,
  renderMarkdown,
} from "./pilot-invoice.mjs";

function usageResponse() {
  return {
    operator_view: true,
    month: "2026-10",
    partners: [
      {
        partner_id: "morning",
        call_limit: 500,
        usage: {
          durable: true,
          month: "2026-10",
          month_total: 120,
          month_by_tool: { total: 120, invoice_gate: 100, verify: 20 },
        },
      },
      {
        partner_id: "icount",
        call_limit: 2500,
        usage: {
          durable: true,
          month: "2026-10",
          month_total: 600,
          month_by_tool: { total: 600, invoice_gate: 400, verify: 200 },
        },
      },
      {
        partner_id: "sumit",
        call_limit: 500,
        usage: {
          durable: false,
          month: "2026-10",
          month_total: 3,
          month_by_tool: {},
        },
      },
    ],
  };
}

test("pay-as-you-go partner is billed per tool with VAT and the commission netted", () => {
  const invoice = buildInvoiceLines(usageResponse(), { month: "2026-10" });
  const morning = invoice.partners.find((p) => p.partner_id === "morning");
  assert.equal(morning.plan, "payg");
  assert.deepEqual(
    morning.lines.map((line) => [
      line.description,
      line.quantity,
      line.amount_ils,
    ]),
    [
      ["Invoice gate (PAY / HOLD / BLOCK)", 100, 150],
      ["Company verification", 20, 12],
    ],
  );
  assert.equal(morning.subtotal_ils, 162);
  assert.equal(morning.vat_ils, 29.16);
  assert.equal(morning.total_ils, 191.16);
  assert.equal(morning.expected_net_after_commission_ils, 181.6);
  assert.deepEqual(morning.warnings, []);
});

test("plan partner pays the monthly fee, included calls cover the most expensive tools first, overage is per call", () => {
  const invoice = buildInvoiceLines(usageResponse(), {
    month: "2026-10",
    plans: { icount: "starter" },
  });
  const icount = invoice.partners.find((p) => p.partner_id === "icount");
  assert.equal(icount.plan, "starter");
  assert.deepEqual(
    icount.lines.map((line) => [
      line.quantity,
      line.unit_price_ils,
      line.amount_ils,
    ]),
    [
      [1, 490, 490],
      [400, 0, 0],
      [100, 0, 0],
      [100, 0.6, 60],
    ],
  );
  assert.equal(icount.subtotal_ils, 550);
  assert.equal(icount.total_ils, 649);
});

test("non-durable counts and month mismatches are flagged, unknown plans and prices are handled", () => {
  const invoice = buildInvoiceLines(usageResponse(), { month: "2026-09" });
  assert.match(invoice.warnings[0], /Requested month 2026-09/);
  const sumit = invoice.partners.find((p) => p.partner_id === "sumit");
  assert.equal(sumit.durable, false);
  assert.match(sumit.warnings[0], /not durable/);
  assert.equal(sumit.total_ils, 0);

  assert.throws(
    () => buildInvoiceLines(usageResponse(), { plans: { morning: "gold" } }),
    /Unknown plan "gold"/,
  );

  const custom = buildInvoiceLines(
    {
      month: "2026-10",
      partners: [
        {
          partner_id: "x",
          usage: {
            durable: true,
            month: "2026-10",
            month_total: 2,
            month_by_tool: { total: 2, mystery: 2 },
          },
        },
      ],
    },
    { prices: { invoice_gate: 2 } },
  );
  assert.match(
    custom.partners[0].warnings[0],
    /No price configured for tool "mystery"/,
  );
  assert.throws(() => buildInvoiceLines({}, {}), /operator view/);
});

test("markdown and csv renderers include partner ids, totals, and warnings", () => {
  const invoice = buildInvoiceLines(usageResponse(), {
    month: "2026-10",
    plans: { icount: "growth" },
  });
  const markdown = renderMarkdown(invoice);
  assert.match(markdown, /# Pilot invoices for 2026-10/);
  assert.match(markdown, /## morning · payg · 120 calls in 2026-10/);
  assert.match(markdown, /## icount · growth · 600 calls/);
  assert.match(markdown, /## sumit · payg · 3 calls in 2026-10 · NOT DURABLE/);
  assert.match(markdown, /\*\*191\.16\*\*/);
  const csv = renderCsv(invoice);
  assert.match(csv, /^"month","partner_id","plan"/);
  assert.match(
    csv,
    /"2026-10","morning","payg","TOTAL_INCL_VAT","","","191\.16","true"/,
  );
});
