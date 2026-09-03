import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/v1/agent-payment-trust/route";

describe("agent payment trust REST route", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns a free REVIEW decision without signing or submitting a payment", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            records: [
              {
                _id: "fixture-rest-firewall",
                "מספר חברה": 514744887,
                "שם חברה": "מנדיי. קום בעמ",
                "סטטוס חברה": "פעילה",
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const response = await POST(
      new NextRequest("http://localhost:3000/v1/agent-payment-trust", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company_number: "514744887",
          service_url: "https://merchant.example/pay",
          payment: {
            network: "eip155:8453",
            asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount: "50000",
            pay_to: "0x1111111111111111111111111111111111111111",
            resource_url: "https://merchant.example/pay",
          },
          manifest_mode: "none",
          mandate: {
            max_amount: "50000",
            allowed_networks: ["eip155:8453"],
            allowed_assets: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
            allowed_pay_to: ["0x1111111111111111111111111111111111111111"],
            allowed_company_numbers: ["514744887"],
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      mode: "dry_run",
      decision: { action: "REVIEW", automation_safe: false },
      next_action: { proceed_to_payment: false },
    });
  });
});
