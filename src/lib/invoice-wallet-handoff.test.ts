import { afterEach, describe, expect, it, vi } from "vitest";
import { paidRouteConfig, paymentEnvironments } from "@/lib/config";
import { createInvoiceWalletHandoff } from "./invoice-wallet-handoff";

afterEach(() => vi.restoreAllMocks());

const options = {
  invoice: { supplier_company_number: "514744887", invoice_number: "SAMPLE" },
  action: "HOLD" as const,
  allocationApplicability: "NOT_REQUIRED" as const,
  supplier: {
    companyNumber: "514744887",
    legalName: "Example",
    status: "ACTIVE",
  },
  now: new Date("2026-09-06T10:00:00Z"),
};

describe("independent wallet handoff", () => {
  it("describes one capped request without authorizing payment", () => {
    const handoff = createInvoiceWalletHandoff(options);
    expect(handoff.payment_authorized).toBe(false);
    expect(handoff.expires_at).toBe("2026-09-06T10:15:00.000Z");
    expect(handoff.request.url).toBe(
      "https://israel-counterparty-intelligence.vercel.app/v1/invoice-gate/mainnet",
    );
    expect(handoff.request.body).toEqual(options.invoice);
    expect(handoff.payment_constraints).toEqual({
      scheme: "exact",
      network: "eip155:8453",
      asset: paymentEnvironments.mainnet.asset,
      pay_to: paymentEnvironments.mainnet.payTo,
      expected_amount_atomic: "250000",
      max_amount_atomic: "250000",
      max_payments: 1,
    });
    expect(handoff.buyer_instructions.join(" ")).toContain(
      "not payment approval or an enforced spending policy",
    );
  });

  it("refuses blocked invoices, unknown conditions and mismatched suppliers", () => {
    expect(() =>
      createInvoiceWalletHandoff({ ...options, action: "BLOCK" }),
    ).toThrow();
    expect(() =>
      createInvoiceWalletHandoff({
        ...options,
        allocationApplicability: "UNKNOWN",
      }),
    ).toThrow();
    expect(() =>
      createInvoiceWalletHandoff({
        ...options,
        supplier: { ...options.supplier, companyNumber: "000000000" },
      }),
    ).toThrow();
  });

  it("fails closed when the configured price exceeds the stated cap", () => {
    const route = paidRouteConfig["invoice-gate-mainnet"];
    const original = route.price;
    try {
      for (const price of ["$0.250001", "$1.00", "$0.00"]) {
        route.price = price;
        expect(() => createInvoiceWalletHandoff(options)).toThrow();
      }
    } finally {
      route.price = original;
    }
  });
});
