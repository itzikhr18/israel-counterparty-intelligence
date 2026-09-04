import { describe, expect, it } from "vitest";

import type { CompanyChangesLookup } from "@/lib/adapters/company-changes";
import type { SourceResult } from "@/lib/domain";
import {
  classifyCompanyChange,
  CompanyChangesService,
  parseIsraeliDate,
} from "@/lib/services/company-changes";

const entity = {
  legal_name: "מנדיי. קום בעמ",
  english_name: "MONDAY.COM LTD",
  company_number: "514744887",
  entity_type: "חברה",
  status: "פעילה",
  registered_address: null,
  incorporation_date: null,
  law_violation_flag: false,
  latest_annual_report_year: 2025,
};

function success(): SourceResult<CompanyChangesLookup> {
  return {
    ok: true,
    data: {
      sourceUrl: "https://data.gov.il/example",
      records: [
        {
          _id: "1",
          "מספר תאגיד": "514744887",
          "שם תאגיד": "מנדיי. קום בעמ",
          "סוג בקשה": "עדכון הפרה",
          "תאריך עדכון סטטוס": "26/05/2026",
          "מזהה השיעבוד": null,
          "קוד סוג בקשה": "17",
        },
        {
          _id: "2",
          "מספר תאגיד": "514744887",
          "שם תאגיד": "מנדיי. קום בעמ",
          "סוג בקשה": "דו~ח שנתי",
          "תאריך עדכון סטטוס": "23/06/2026",
          "מזהה השיעבוד": null,
          "קוד סוג בקשה": "12",
        },
      ],
    },
    retrieved_at: "2026-09-04T00:00:00.000Z",
    cache_hit: false,
  };
}

describe("company changes", () => {
  it("parses Israeli dates and classifies official request labels", () => {
    expect(parseIsraeliDate("23/06/2026")?.toISOString().slice(0, 10)).toBe(
      "2026-06-23",
    );
    expect(classifyCompanyChange("רישום שעבוד")).toBe("SECURED_CREDIT");
    expect(classifyCompanyChange("עדכון הפרה")).toBe("COMPLIANCE");
    expect(classifyCompanyChange("דו~ח שנתי")).toBe("FILING");
    expect(parseIsraeliDate("31/02/2026")).toBeNull();
  });

  it("returns newest events first with field-level evidence", async () => {
    const service = new CompanyChangesService(
      { findByCompanyNumber: async () => success() },
      () => new Date("2026-09-04T00:00:00.000Z"),
    );
    const result = await service.getRecentChanges(
      {
        company_number: "514744887",
        lookback_days: 366,
        limit: 25,
        language: "en",
      },
      entity,
    );
    expect(result.changes.returned_count).toBe(2);
    expect(result.changes.events[0]).toMatchObject({
      event_date: "2026-06-23",
      category: "FILING",
    });
    expect(result.evidence).toHaveLength(2);
  });
});
