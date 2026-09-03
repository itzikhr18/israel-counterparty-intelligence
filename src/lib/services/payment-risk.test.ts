import { describe, expect, it } from "vitest";

import type { ResolvedEntity } from "@/lib/domain";
import type { PaymentRiskQuery } from "@/lib/payment-risk-schema";
import { assessPaymentRisk } from "@/lib/services/payment-risk";

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

function query(overrides: Partial<PaymentRiskQuery> = {}): PaymentRiskQuery {
  return {
    company_number: "514744887",
    invoice_company_number: "514744887",
    invoice_company_name: "מנדיי. קום בעמ",
    invoice_website: "https://monday.com",
    vendor_email: "billing@monday.com",
    payment_details_changed: false,
    urgent_payment_request: false,
    first_time_vendor: false,
    language: "en",
    ...overrides,
  };
}

describe("payment risk assessment", () => {
  it("allows automation when identity and contact domains match", () => {
    const result = assessPaymentRisk(
      query(),
      entity,
      0.99,
      [],
      new Date("2026-09-03T00:00:00Z"),
    );
    expect(result.decision).toMatchObject({
      action: "PROCEED",
      automation_safe: true,
      score: 0,
      level: "LOW",
    });
  });

  it("blocks an invoice company-number mismatch", () => {
    const result = assessPaymentRisk(
      query({ invoice_company_number: "511111111" }),
      entity,
      0.99,
      [],
      new Date("2026-09-03T00:00:00Z"),
    );
    expect(result.decision.action).toBe("BLOCK");
    expect(result.decision.reason_codes).toContain(
      "INVOICE_COMPANY_NUMBER_MISMATCH",
    );
  });

  it("routes changed payment details to human review", () => {
    const result = assessPaymentRisk(
      query({ payment_details_changed: true }),
      entity,
      0.99,
      [],
      new Date("2026-09-03T00:00:00Z"),
    );
    expect(result.decision.action).toBe("REVIEW");
    expect(result.decision.automation_safe).toBe(false);
    expect(result.checks_not_performed).toContain("bank_account_ownership");
  });

  it("does not auto-approve when no invoice identity was supplied", () => {
    const result = assessPaymentRisk(
      query({
        invoice_company_number: undefined,
        invoice_company_name: undefined,
        vendor_email: "billing@monday.com",
      }),
      entity,
      0.99,
      [],
      new Date("2026-09-03T00:00:00Z"),
    );
    expect(result.decision.action).toBe("REVIEW");
    expect(result.decision.automation_safe).toBe(false);
  });
});
