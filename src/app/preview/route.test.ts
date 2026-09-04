import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/preview/route";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("free browser preview", () => {
  it("rejects an invalid company number without calling the registry", async () => {
    const verify = vi.spyOn(counterpartyOrchestrator, "verify");
    const response = await GET(
      new NextRequest("https://service.example/preview?company_number=123"),
    );

    expect(response.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toContain(
      "Enter a valid nine-digit Israeli company number.",
    );
  });

  it("shows only the limited identity result for a resolved company", async () => {
    vi.spyOn(counterpartyOrchestrator, "verify").mockResolvedValue({
      api_version: "1.0.0",
      query: {
        company_number: "514744887",
        language: "en",
        depth: "standard",
      },
      resolution_status: "RESOLVED",
      resolved_entity: {
        legal_name: "מנדיי. קום בעמ",
        english_name: "MONDAY.COM LTD",
        company_number: "514744887",
        entity_type: "public company",
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
      },
      candidates: [],
      confidence: 0.99,
      summary: "Company is active.",
      evidence: [
        {
          field: "company_number",
          value: "514744887",
          type: "fact",
          source: "Registry source that must remain paid",
          source_url: "https://paid-evidence.example/record",
          retrieved_at: "2026-09-04T12:00:00.000Z",
          source_record_id: "record-1",
          confidence: 0.99,
        },
      ],
      missing_data: [],
      checked_at: "2026-09-04T12:00:00.000Z",
    });

    const response = await GET(
      new NextRequest(
        "https://service.example/preview?company_number=514744887",
      ),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Company found");
    expect(html).toContain("מנדיי. קום בעמ");
    expect(html).toContain("514744887");
    expect(html).toContain("99%");
    expect(html).toContain("$0.01 USDC");
    expect(html).toContain("$0.05 USDC");
    expect(html).not.toContain("paid-evidence.example");
    expect(html).not.toContain("יצחק שדה");
  });
});
