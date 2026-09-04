import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/route";

describe("service root", () => {
  it("preserves the machine-readable JSON response by default", async () => {
    const response = await GET(
      new NextRequest("https://service.example/", {
        headers: { accept: "application/json" },
      }),
    );

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("vary")).toBe("Accept");
    await expect(response.json()).resolves.toMatchObject({
      mcp: {
        production: { endpoint: "/mcp", network: "eip155:8453" },
        tools: {
          paid: [
            "verify_israeli_company_paid",
            "verify_company",
            "assess_israeli_vendor_payment_risk_paid",
            "get_israeli_company_changes_paid",
          ],
        },
      },
    });
  });

  it("returns a conversion-focused page to a browser", async () => {
    const response = await GET(
      new NextRequest("https://service.example/", {
        headers: { accept: "text/html,application/xhtml+xml" },
      }),
    );
    const html = await response.text();

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(html).toContain(
      "Know who an agent will pay before its wallet signs.",
    );
    expect(html).toContain("/x402-buyer-quickstart.md");
    expect(html).toContain("github:itzikhr18/israel-company-verify-buyer");
    expect(html).toContain("preview_agent_payment_trust");
    expect(html).toContain("0.05 USDC");
    expect(html).toContain("0.10 USDC");
    expect(html).toContain("0.01 USDC");
    expect(html).toContain("/v1/payment-risk/mainnet");
    expect(html).toContain("/v1/company-changes/mainnet");
  });

  it("allows an explicit JSON view from a browser", async () => {
    const response = await GET(
      new NextRequest("https://service.example/?format=json", {
        headers: { accept: "text/html" },
      }),
    );

    expect(response.headers.get("content-type")).toContain("application/json");
  });
});
