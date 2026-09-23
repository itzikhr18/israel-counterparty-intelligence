import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/route";

describe("service root", () => {
  it("returns machine-readable JSON when application/json is preferred", async () => {
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
            "authorize_israeli_invoice_payment_paid",
            "get_israeli_company_changes_paid",
          ],
        },
      },
      discovery: {
        well_known: {
          x402: "/.well-known/x402",
          agent_card: "/.well-known/agent-card.json",
          mcp: "/.well-known/mcp.json",
          llms: "/llms.txt",
          agents: "/agents.md",
          status: "/STATUS.md",
        },
        preferred_first_paid_path: {
          rest: "POST /v1/company-changes/mainnet",
          mcp_tool: "get_israeli_company_changes_paid",
          price_usdc: "0.01",
          agents_guide: "/agents.md",
        },
      },
    });
  });

  it("defaults to HTML for generic Accept so Bazaar/GoPlausible enrichment can read OG tags", async () => {
    const response = await GET(
      new NextRequest("https://service.example/", {
        headers: { accept: "*/*" },
      }),
    );
    const html = await response.text();

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('href="/.well-known/agent-card.json"');
    expect(html).toContain('href="/.well-known/x402"');
  });

  it("keeps free checks visible and restores browser purchase instructions when resumed", async () => {
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
    expect(html).toContain('property="og:site_name"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain(
      "Stop a bad Israeli invoice before an agent pays it.",
    );
    expect(html).toContain('href="#invoice-preview"');
    expect(html).toContain('href="/proof"');
    expect(html).toContain("Settlement proof");
    expect(html).toContain('action="/invoice-preview"');
    expect(html).toContain('name="supplier_company_number"');
    expect(html).toContain('name="allocation_number"');
    expect(html).toContain("Check invoice free");
    expect(html).toContain('action="/preview"');
    expect(html).toContain('name="company_number"');
    expect(html).toContain("Free · no wallet required");
    expect(html).not.toContain("Paid services temporarily suspended");
    expect(html).toContain("Mainnet live · first external paid call confirmed");
    expect(html).toContain("/STATUS.md");
    expect(html).not.toContain("Production live");
    expect(html).toContain("preview_israeli_invoice_payment_gate_free");
    expect(html).toContain("Approve payment");
    expect(html).toContain("--pay");
    expect(html).toContain("israel-company-verify-buyer-0.4.0.tgz");
    expect(html).toContain("0.05 USDC");
    expect(html).toContain("0.10 USDC");
    expect(html).toContain("0.01 USDC");
    expect(html).toContain("0.25 USDC");
    expect(html).toContain("/v1/invoice-gate/preview");
    expect(html).toContain("/v1/payment-risk/mainnet");
    expect(html).toContain("/v1/company-changes/mainnet");
    expect(html).toContain("First paid call in 60 seconds");
    expect(html).toContain('id="first-paid-call"');
    expect(html).toContain("/agents.md");
    expect(html).toContain("--data '{}'");
    expect(html).toContain("0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82");
    expect(html).toContain("Coinbase CDP");
    expect(response.headers.get("content-security-policy")).toContain(
      "form-action 'self'",
    );
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
