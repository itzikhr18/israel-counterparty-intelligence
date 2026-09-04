import { describe, expect, it } from "vitest";

import type { ResolvedEntity } from "@/lib/domain";
import type { InvoiceGateQuery } from "@/lib/invoice-gate-schema";
import {
  allocationPolicy,
  assessInvoiceGate,
  previewInvoiceGate,
} from "@/lib/services/invoice-gate";

const entity: ResolvedEntity = {
  legal_name: "מנדיי. קום בע״מ",
  english_name: "MONDAY.COM LTD",
  company_number: "514744887",
  entity_type: "חברה פרטית",
  status: "פעילה",
  registered_address: {
    city: "תל אביב - יפו",
    street: "יצחק שדה",
    house_number: "6",
    postal_code: "6777506",
    country: "ישראל",
  },
  incorporation_date: "13/03/2012",
  law_violation_flag: false,
  latest_annual_report_year: 2025,
};

function query(overrides: Partial<InvoiceGateQuery> = {}): InvoiceGateQuery {
  return {
    supplier_company_number: "514744887",
    supplier_name: "מנדיי. קום בעמ",
    invoice_number: "INV-2026-001",
    invoice_date: "2026-09-04",
    amount_before_vat: 4000,
    vat_amount: 720,
    total_amount: 4720,
    currency: "ILS",
    expected_vat_rate: 18,
    payment_details_changed: false,
    urgent_payment_request: false,
    first_time_vendor: false,
    language: "en",
    ...overrides,
  };
}

describe("Israeli invoice payment gate", () => {
  it("applies the legislated threshold schedule by invoice date", () => {
    expect(allocationPolicy("2025-12-31", 19_999).allocation_required).toBe(
      false,
    );
    expect(allocationPolicy("2026-01-01", 10_000)).toMatchObject({
      allocation_threshold_ils: 10_000,
      allocation_required: true,
    });
    expect(allocationPolicy("2026-06-01", 5_000)).toMatchObject({
      allocation_threshold_ils: 5_000,
      allocation_required: true,
    });
  });

  it("blocks a free preview when invoice arithmetic is wrong", () => {
    const result = previewInvoiceGate(query({ total_amount: 4700 }));
    expect(result.decision.action).toBe("BLOCK");
    expect(result.decision.reason_codes).toContain(
      "INVOICE_ARITHMETIC_MISMATCH",
    );
  });

  it("allows a low-value invoice after registry and structural checks", () => {
    const result = assessInvoiceGate(query(), entity, 0.99, []);
    expect(result.decision).toMatchObject({
      action: "PAY",
      automation_safe: true,
      score: 0,
    });
  });

  it("blocks a threshold invoice that lacks an allocation number", () => {
    const result = assessInvoiceGate(
      query({ amount_before_vat: 6000, vat_amount: 1080, total_amount: 7080 }),
      entity,
      0.99,
      [],
    );
    expect(result.decision.action).toBe("BLOCK");
    expect(result.decision.reason_codes).toContain(
      "ALLOCATION_NUMBER_REQUIRED",
    );
  });

  it("holds a threshold invoice until authenticated official verification", () => {
    const result = assessInvoiceGate(
      query({
        amount_before_vat: 6000,
        vat_amount: 1080,
        total_amount: 7080,
        allocation_number: "123456789",
      }),
      entity,
      0.99,
      [],
    );
    expect(result.decision.action).toBe("HOLD");
    expect(result.decision.automation_safe).toBe(false);
    expect(result.decision.reason_codes).toContain(
      "OFFICIAL_ALLOCATION_VERIFICATION_REQUIRED",
    );
  });

  it("labels a buyer-attested official match and never calls it authenticated", () => {
    const result = assessInvoiceGate(
      query({
        amount_before_vat: 6000,
        vat_amount: 1080,
        total_amount: 7080,
        allocation_number: "123456789",
        official_verification: {
          status: "MATCH",
          checked_at: "2026-09-04T09:00:00.000Z",
          supplier_vat_number: "514744887",
          invoice_number: "INV-2026-001",
          allocation_number: "123456789",
          amount_before_vat: 6000,
          vat_amount: 1080,
        },
      }),
      entity,
      0.99,
      [],
    );
    expect(result.decision.action).toBe("PAY");
    expect(result.decision.automation_safe).toBe(false);
    expect(result.official_verification).toMatchObject({
      status: "MATCH",
      trust: "BUYER_ATTESTED",
      independently_authenticated: false,
    });
  });
});
