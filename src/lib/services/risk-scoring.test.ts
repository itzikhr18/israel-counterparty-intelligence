import { describe, expect, it } from "vitest";

import type { ResolvedEntity } from "@/lib/domain";
import { scoreRisk } from "@/lib/services/risk-scoring";

function entity(overrides: Partial<ResolvedEntity> = {}): ResolvedEntity {
  return {
    legal_name: "חברת בדיקה בע״מ",
    english_name: "TEST COMPANY LTD",
    company_number: "512345678",
    entity_type: "ישראלית חברה פרטית",
    status: "פעילה",
    registered_address: null,
    incorporation_date: "01/01/2020",
    law_violation_flag: false,
    latest_annual_report_year: 2025,
    ...overrides,
  };
}

describe("risk scoring", () => {
  it("does not treat government business as a risk discount", () => {
    const { risk } = scoreRisk(
      entity(),
      0.99,
      new Date("2026-08-27T00:00:00Z"),
    );
    expect(risk.score).toBe(0);
    expect(risk.level).toBe("LOW");
    expect(risk.reason_codes).toEqual([]);
  });

  it("is deterministic and exposes reason codes", () => {
    const { risk } = scoreRisk(
      entity({
        status: "מחוסלת מרצון",
        law_violation_flag: true,
        latest_annual_report_year: 2021,
      }),
      0.99,
      new Date("2026-08-27T00:00:00Z"),
    );
    expect(risk.score).toBe(75);
    expect(risk.level).toBe("HIGH");
    expect(risk.reason_codes).toEqual([
      "ENTITY_NOT_ACTIVE",
      "LAW_VIOLATION_FLAG",
      "ANNUAL_REPORT_STALE",
    ]);
    expect(risk.scoring_version).toBe("0.1.0");
  });
});
