import { describe, expect, it } from "vitest";

import { GET } from "@/app/invoice-check/he/route";

describe("GET /invoice-check/he", () => {
  it("serves the Hebrew free invoice form posting to the shared preview route", async () => {
    const response = GET();
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-language")).toBe("he");
    expect(html).toContain('lang="he"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('action="/invoice-preview"');
    expect(html).toContain('name="lang" value="he"');
    for (const field of [
      "supplier_company_number",
      "invoice_number",
      "invoice_date",
      "expected_vat_rate",
      "buyer_is_authorized_dealer",
      "buyer_requested_allocation_number",
      "amount_before_vat",
      "vat_amount",
      "total_amount",
      "allocation_number",
    ]) {
      expect(html, field).toContain(`name="${field}"`);
    }
    expect(html).toContain('href="/partner/he"');
    expect(html).not.toContain("USDC");
  });
});
