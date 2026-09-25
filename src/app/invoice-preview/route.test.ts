import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const availability = vi.hoisted(() => ({ suspended: true }));
vi.mock("@/lib/service-availability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/service-availability")>()),
  get PAID_SERVICE_SUSPENDED() {
    return availability.suspended;
  },
}));

import { POST } from "@/app/invoice-preview/route";
import {
  entityResolutionService,
  EntityResolutionService,
} from "@/lib/services/entity-resolution";

// Purchase/handoff assertions opt into active service explicitly.
// Validation and free-download tests keep the suspended mock unless overridden.
beforeEach(() => {
  availability.suspended = true;
});
afterEach(() => vi.restoreAllMocks());

function request(fields: Record<string, string>) {
  return new NextRequest("https://service.example/invoice-preview", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}

describe("free browser invoice preview", () => {
  it("renders a clear hold result when the structure passes", async () => {
    availability.suspended = false;
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
    expect(html).toContain("Download this invoice request");
    expect(html).toContain("--invoice-file invoice-request.json");
    expect(html).toContain("will hold payment even after");
    expect(html).toContain('name="invoice_request"');
    expect(html).toContain("Prepare request for my own wallet — free");
    expect(html).toContain("Downloading does not authorize or make a payment.");
    expect(html).not.toContain('href="/mcp.json"');
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
    expect(html).toContain("Paid services temporarily suspended");
    expect(html).not.toContain("--pay");
    expect(html).not.toContain("Connect through MCP");
  });

  it("renders the result in Hebrew, right to left, without the crypto purchase flow when the form says lang=he", async () => {
    availability.suspended = false;
    const response = await POST(
      request({
        lang: "he",
        supplier_company_number: "514744887",
        invoice_number: "INV-2026-003",
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
    expect(html).toContain('<html lang="he" dir="rtl">');
    expect(html).toContain("תוצאת בדיקה חינמית · לעכב");
    expect(html).toContain("לעכב לבדיקה הבאה");
    expect(html).toContain("חובת מספר הקצאה");
    expect(html).toContain("בדיקות שבוצעו");
    expect(html).toContain(
      "המספרים עברו. לפני התשלום נשארה בדיקת הספק ברשם החברות.",
    );
    expect(html).toContain('href="/partner/he"');
    expect(html).toContain('href="/invoice-check/he"');
    expect(html).not.toContain("USDC");
    expect(html).not.toContain('name="invoice_request"');

    const blocked = await POST(
      request({
        lang: "he",
        supplier_company_number: "514744887",
        invoice_number: "INV-2026-004",
        invoice_date: "2026-09-04",
        amount_before_vat: "6000",
        vat_amount: "1080",
        total_amount: "7080",
        buyer_is_authorized_dealer: "true",
        buyer_requested_allocation_number: "true",
        expected_vat_rate: "18",
      }),
    );
    const blockedHtml = await blocked.text();
    expect(blockedHtml).toContain("תוצאת בדיקה חינמית · לחסום");
    expect(blockedHtml).toContain("לא לשלם עדיין");
    expect(blockedHtml).toContain("לתקן את החשבונית קודם");

    const invalid = await POST(
      request({ lang: "he", supplier_company_number: "12" }),
    );
    const invalidHtml = await invalid.text();
    expect(invalid.status).toBe(400);
    expect(invalidHtml).toContain("לא הצלחנו לבדוק את החשבונית");
    expect(invalidHtml).toContain("תשע ספרות");
  });

  it("flags one-click sample submissions so demo clicks are not counted as real invoices", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await POST(
      request({
        lang: "he",
        sample: "1",
        supplier_company_number: "514744887",
        invoice_number: "INV-2026-001",
        invoice_date: "2026-09-04",
        amount_before_vat: "6000.00",
        vat_amount: "1080.00",
        total_amount: "7080.00",
        buyer_is_authorized_dealer: "true",
        buyer_requested_allocation_number: "true",
        expected_vat_rate: "18",
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain(
      "תוצאת בדיקה חינמית · לחסום",
    );
    const events = log.mock.calls.flatMap(([line]) => {
      try {
        return [JSON.parse(String(line))];
      } catch {
        return [];
      }
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        event: "invoice_preview_delivered",
        decision: "BLOCK",
        sample: true,
        language: "he",
      }),
    );
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

  const invoice = {
    supplier_company_number: "514744887",
    invoice_number: 'INV-<script>alert("x")</script>',
    invoice_date: "2026-09-04",
    amount_before_vat: 1000,
    vat_amount: 180,
    total_amount: 1180,
  };

  it("downloads validated invoice JSON without putting private data in a URL or cache", async () => {
    const response = await POST(
      request({ action: "download", invoice_request: JSON.stringify(invoice) }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="invoice-request.json"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject(invoice);
  });

  it("escapes invoice data carried through the hidden download form", async () => {
    availability.suspended = false;
    const response = await POST(
      request(
        Object.fromEntries(
          Object.entries(invoice).map(([key, value]) => [key, String(value)]),
        ),
      ),
    );
    const html = await response.text();
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("refuses a forged download with blocked or unknown invoice conditions", async () => {
    for (const change of [
      { total_amount: 999 },
      { amount_before_vat: 6000, vat_amount: 1080, total_amount: 7080 },
    ]) {
      const response = await POST(
        request({
          action: "download",
          invoice_request: JSON.stringify({ ...invoice, ...change }),
        }),
      );
      expect(response.status).toBe(409);
      expect(response.headers.get("content-disposition")).toBeNull();
    }
  });

  it("rejects malformed download JSON", async () => {
    const response = await POST(
      request({ action: "download", invoice_request: "bad json" }),
    );
    expect(response.status).toBe(400);
  });

  it("prepares a private wallet handoff only after a free supplier match", async () => {
    availability.suspended = false;
    const resolution = new EntityResolutionService({
      findByCompanyNumber: async () => ({
        ok: true,
        retrieved_at: "2026-09-06T10:00:00Z",
        cache_hit: false,
        data: {
          records: [
            {
              _id: "1",
              "מספר חברה": "514744887",
              "שם חברה": "Example Ltd",
              "סטטוס חברה": "פעילה",
            },
          ],
          sourceUrl: "https://data.gov.il/example",
        },
      }),
      findByName: async () => {
        throw new Error("Exact lookup only");
      },
    });
    const resolve = vi
      .spyOn(entityResolutionService, "resolve")
      .mockImplementation((query) => resolution.resolve(query));
    const response = await POST(
      request({
        action: "wallet-handoff",
        invoice_request: JSON.stringify({
          ...invoice,
          url: "https://attacker.invalid",
          payment_authorized: true,
          private_key: "FAKE-UNWANTED-FIELD",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="invoice-wallet-request.json"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    const handoff = await response.json();
    expect(handoff.payment_authorized).toBe(false);
    expect(handoff.free_preflight.supplier_resolution).toBe("RESOLVED");
    expect(handoff.request.body).toMatchObject(invoice);
    expect(handoff.request.body).not.toHaveProperty("private_key");
    expect(handoff.request.url).not.toContain("attacker");
    expect(resolve).toHaveBeenCalledOnce();
  });

  it("does not prepare a wallet request when the supplier is unknown or unavailable", async () => {
    availability.suspended = false;
    const resolve = vi.spyOn(entityResolutionService, "resolve");
    resolve.mockResolvedValueOnce({
      status: "NOT_FOUND",
      entity: null,
      candidates: [],
      confidence: 0,
      evidence: [],
      missing_data: ["registered_entity"],
    });
    resolve.mockRejectedValueOnce(new Error("Source unavailable"));
    for (const status of [409, 503]) {
      const response = await POST(
        request({
          action: "wallet-handoff",
          invoice_request: JSON.stringify(invoice),
        }),
      );
      expect(response.status).toBe(status);
      expect(response.headers.get("content-disposition")).toBeNull();
      expect(await response.text()).toContain("No payment was made.");
    }
  });

  it("cannot bypass invoice checks through the wallet action", async () => {
    availability.suspended = false;
    const resolve = vi.spyOn(entityResolutionService, "resolve");
    for (const change of [
      { total_amount: 999 },
      { amount_before_vat: 6000, vat_amount: 1080, total_amount: 7080 },
    ]) {
      const response = await POST(
        request({
          action: "wallet-handoff",
          invoice_request: JSON.stringify({ ...invoice, ...change }),
        }),
      );
      expect(response.status).toBe(409);
    }
    expect(resolve).not.toHaveBeenCalled();
  });
});
