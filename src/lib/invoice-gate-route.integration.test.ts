import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/v1/invoice-gate/preview/route";

describe("free invoice-gate preview route", () => {
  it("returns a fail-closed structural decision without payment", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/v1/invoice-gate/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplier_company_number: "514744887",
          invoice_number: "INV-2026-001",
          invoice_date: "2026-09-04",
          amount_before_vat: 6000,
          vat_amount: 1080,
          total_amount: 7080,
          allocation_number: "123456789",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      preview: true,
      policy: {
        allocation_threshold_ils: 5000,
        allocation_required: true,
      },
      decision: { action: "HOLD", automation_safe: false },
      official_verification: { independently_authenticated: false },
    });
  });

  it("rejects unsupported historical dates and malformed numbers", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/v1/invoice-gate/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplier_company_number: "123",
          invoice_number: "INV-1",
          invoice_date: "2024-12-31",
          amount_before_vat: 100,
          vat_amount: 18,
          total_amount: 118,
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
