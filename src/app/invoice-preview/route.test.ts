import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/invoice-preview/route";

function request(fields: Record<string, string>) {
  return new NextRequest("https://service.example/invoice-preview", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}

describe("free browser invoice preview", () => {
  it("renders a clear hold result when the structure passes", async () => {
    const response = await POST(
      request({
        supplier_company_number: "514744887",
        invoice_number: "INV-2026-001",
        invoice_date: "2026-09-04",
        amount_before_vat: "6000",
        vat_amount: "1080",
        total_amount: "7080",
        buyer_is_authorized_dealer: "true",
        buyer_requested_allocation_number: "true",
        allocation_number: "123456789",
        expected_vat_rate: "18",
      }),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain("Free invoice result · HOLD");
    expect(html).toContain("Hold for the next check");
    expect(html).toContain("Allocation requirement");
    expect(html).toContain("Required");
    expect(html).toContain("₪5,000");
    expect(html).toContain("Connect through MCP");
    expect(html).not.toContain("514744887");
  });

  it("renders a block result for missing required allocation", async () => {
    const response = await POST(
      request({
        supplier_company_number: "514744887",
        invoice_number: "INV-2026-002",
        invoice_date: "2026-09-04",
        amount_before_vat: "6000",
        vat_amount: "1080",
        total_amount: "7080",
        buyer_is_authorized_dealer: "true",
        buyer_requested_allocation_number: "true",
        expected_vat_rate: "18",
      }),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Free invoice result · BLOCK");
    expect(html).toContain("Do not pay yet");
    expect(html).toContain(
      "An allocation number is required for this invoice value and date.",
    );
  });

  it("asks for buyer conditions instead of guessing", async () => {
    const response = await POST(
      request({
        supplier_company_number: "514744887",
        invoice_number: "INV-2026-003",
        invoice_date: "2026-09-04",
        amount_before_vat: "6000",
        vat_amount: "1080",
        total_amount: "7080",
        expected_vat_rate: "18",
      }),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Confirm the buyer conditions");
    expect(html).toContain("Need buyer answers");
    expect(html).toContain(
      "Buyer status or allocation-request information is missing.",
    );
    expect(html).toContain(
      "Paying for the full gate before that would only return HOLD.",
    );
    expect(html).not.toContain("Connect through MCP");
  });

  it("rejects malformed form input", async () => {
    const response = await POST(
      request({
        supplier_company_number: "123",
        invoice_number: "INV-X",
        invoice_date: "2024-01-01",
        amount_before_vat: "x",
        vat_amount: "18",
        total_amount: "118",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain(
      "We could not check this invoice",
    );
  });
});
