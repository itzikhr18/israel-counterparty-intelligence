import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptsCappedPayment,
  enforceInvoicePreview,
  INVOICE_MAX_AMOUNT,
} from "./invoice-flow.mjs";

test("invoice payment requires a recognized, unblocked structural preview", () => {
  const preview = {
    preview: true,
    decision: { action: "HOLD" },
    policy: { allocation_applicability: "REQUIRED" },
  };
  assert.doesNotThrow(() => enforceInvoicePreview(preview));
  for (const value of [
    null,
    {},
    { ...preview, preview: false },
    { ...preview, decision: { action: "BLOCK" } },
    { ...preview, policy: { allocation_applicability: "UNKNOWN" } },
  ]) {
    assert.throws(() => enforceInvoicePreview(value), /Payment blocked/);
  }
});

test("payment policy rejects malformed, wrong-chain, wrong-token, zero and over-cap challenges", () => {
  const requirement = {
    scheme: "exact",
    network: "eip155:8453",
    asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    payTo: "0x" + "1".repeat(40),
    amount: "250000",
  };
  assert.equal(acceptsCappedPayment(requirement, INVOICE_MAX_AMOUNT), true);
  for (const change of [
    { amount: "250001" },
    { amount: "0" },
    { amount: "-1" },
    { amount: "1.1" },
    { amount: "abc" },
    { amount: 250000 },
    { amount: "9".repeat(1000) },
    { network: "eip155:84532" },
    { asset: "0x" + "0".repeat(40) },
    { scheme: "upto" },
    { payTo: "not an address" },
  ]) {
    assert.equal(
      acceptsCappedPayment({ ...requirement, ...change }, INVOICE_MAX_AMOUNT),
      false,
    );
  }
  assert.equal(acceptsCappedPayment(null, INVOICE_MAX_AMOUNT), false);
});
