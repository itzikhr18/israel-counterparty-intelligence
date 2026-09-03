import { describe, expect, it } from "vitest";

import type { SourceResult } from "@/lib/domain";
import { EntityResolutionService } from "@/lib/services/entity-resolution";
import type {
  RegistryLookup,
  RegistryRecord,
} from "@/lib/adapters/company-registry";

function record(overrides: Partial<RegistryRecord> = {}): RegistryRecord {
  return {
    _id: "1",
    "מספר חברה": "514744887",
    "שם חברה": "מנדיי. קום בע~מ",
    "שם באנגלית": "MONDAY.COM LTD",
    "סוג תאגיד": "ישראלית חברה ציבורית",
    "סטטוס חברה": "פעילה",
    "תאריך התאגדות": "13/03/2012",
    מפרה: "",
    "שנה אחרונה של דוח שנתי (שהוגש)": 2025,
    "שם עיר": "תל אביב - יפו",
    "שם רחוב": "יצחק שדה",
    "מספר בית": "6",
    מיקוד: "6777506",
    מדינה: "ישראל",
    "קוד חברה מפרה": null,
    ...overrides,
  };
}

function success(records: RegistryRecord[]): SourceResult<RegistryLookup> {
  return {
    ok: true,
    data: { records, sourceUrl: "https://data.gov.il/example" },
    retrieved_at: "2026-08-27T00:00:00Z",
    cache_hit: false,
  };
}

describe("entity resolution", () => {
  it("resolves an exact company number with high confidence", async () => {
    const service = new EntityResolutionService({
      findByCompanyNumber: async () => success([record()]),
      findByName: async () => success([]),
    });
    const result = await service.resolve({
      company_number: "514744887",
      language: "en",
      depth: "standard",
    });
    expect(result.status).toBe("RESOLVED");
    expect(result.confidence).toBe(0.99);
    expect(result.evidence.map((item) => item.field)).toContain(
      "company_status",
    );
  });

  it("returns ambiguity when candidates are too close", async () => {
    const service = new EntityResolutionService({
      findByCompanyNumber: async () => success([]),
      findByName: async () =>
        success([
          record({
            _id: "1",
            "מספר חברה": "511111111",
            "שם חברה": "אלפא ישראל בע~מ",
          }),
          record({
            _id: "2",
            "מספר חברה": "522222222",
            "שם חברה": "אלפא ישראל בע~מ",
          }),
        ]),
    });
    const result = await service.resolve({
      company_name: "אלפא ישראל",
      language: "he",
      depth: "standard",
    });
    expect(result.status).toBe("AMBIGUOUS");
    expect(result.candidates).toHaveLength(2);
  });

  it("does not fabricate a company when the registry returns no records", async () => {
    const service = new EntityResolutionService({
      findByCompanyNumber: async () => success([]),
      findByName: async () => success([]),
    });
    const result = await service.resolve({
      company_name: "חברה שלא קיימת",
      language: "he",
      depth: "standard",
    });
    expect(result.status).toBe("NOT_FOUND");
    expect(result.entity).toBeNull();
  });
});
