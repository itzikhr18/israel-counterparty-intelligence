import { NextRequest } from "next/server";
import { parsePaymentRequired } from "@x402/core/schemas";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type RouteHandler = (request: NextRequest) => Promise<Response>;

let post: RouteHandler;
let get: RouteHandler;

async function send(body: Record<string, unknown>) {
  const request = new NextRequest("http://localhost:3000/mcp/testnet", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const response = await post(request);
  return { status: response.status, body: await response.json() };
}

describe("Streamable HTTP MCP route", () => {
  beforeAll(async () => {
    vi.stubEnv("X402_ENABLED", "true");
    vi.stubEnv("X402_PAY_TO", "0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82");
    vi.stubEnv("PUBLIC_BASE_URL", "http://localhost:3000");
    ({ GET: get, POST: post } = await import("@/app/mcp/testnet/route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  it("initializes and exposes the free conversion path plus the paid tool", async () => {
    const initialized = await send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "integration-test", version: "1.0.0" },
      },
    });
    expect(initialized.status).toBe(200);
    expect(initialized.body.result.protocolVersion).toBe("2025-11-25");
    expect(initialized.body.result.instructions).toContain(
      "preview_israeli_company_free",
    );
    expect(initialized.body.result.instructions).toContain(
      "verify_israeli_company_paid",
    );

    const listed = await send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    expect(listed.status).toBe(200);
    expect(
      listed.body.result.tools
        .map((tool: { name: string }) => tool.name)
        .sort(),
    ).toEqual([
      "assess_israeli_vendor_payment_risk_paid",
      "describe_service",
      "get_israeli_company_changes_paid",
      "get_sample_verification_report",
      "get_schema",
      "preview_agent_payment_trust",
      "preview_company",
      "preview_israeli_company_free",
      "preview_israeli_vendor_payment_risk_free",
      "verify_company",
      "verify_israeli_company_paid",
    ]);
  });

  it("runs the payment firewall as a free fail-closed dry-run", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            records: [
              {
                _id: "fixture-firewall-1",
                "מספר חברה": 514744887,
                "שם חברה": "מנדיי. קום בעמ",
                "שם באנגלית": "MONDAY.COM LTD",
                "סוג תאגיד": "חברה פרטית",
                "סטטוס חברה": "פעילה",
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    try {
      const result = await send({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "preview_agent_payment_trust",
          arguments: {
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
          },
        },
      });
      expect(result.status).toBe(200);
      expect(result.body.result.isError).not.toBe(true);
      expect(result.body.result.structuredContent).toMatchObject({
        mode: "dry_run",
        entity: { company_number: "514744887", status: "פעילה" },
        decision: {
          action: "REVIEW",
          automation_safe: false,
          assurance_level: "LEVEL_0_UNVERIFIED",
        },
        next_action: { proceed_to_payment: false, human_review_required: true },
      });
      expect(result.body.result.structuredContent.payment_fingerprint).toMatch(
        /^[0-9a-f]{64}$/,
      );
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("turns a resolved free preview into an exact machine-readable paid next action", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            records: [
              {
                _id: "fixture-1",
                "מספר חברה": 514744887,
                "שם חברה": "מנדיי. קום בעמ",
                "שם באנגלית": "MONDAY.COM LTD",
                "סוג תאגיד": "חברה פרטית",
                "סטטוס חברה": "פעילה",
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    try {
      const preview = await send({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "preview_israeli_company_free",
          arguments: { company_number: "514744887", language: "en" },
        },
      });
      expect(preview.status).toBe(200);
      expect(preview.body.result.isError).not.toBe(true);
      expect(preview.body.result.structuredContent).toMatchObject({
        mode: "free_preview",
        resolution_status: "RESOLVED",
        company: { company_number: "514744887", status: "פעילה" },
        next_action: {
          recommended: true,
          tool: "company_changes",
          preferred_tool: "get_israeli_company_changes_paid",
          arguments: {
            company_number: "514744887",
            language: "en",
            lookback_days: 366,
            limit: 25,
          },
          requires_payment: true,
          price: "$0.01",
          network: "eip155:84532",
          asset: "USDC",
        },
        paid_actions: [
          {
            preferred_tool: "get_israeli_company_changes_paid",
            price: "$0.01",
            recommended_arguments: {
              company_number: "514744887",
              lookback_days: 366,
              limit: 25,
              language: "en",
            },
          },
          {
            preferred_tool: "verify_israeli_company_paid",
            price: "$0.05",
          },
        ],
      });
      expect(preview.body.result.structuredContent).not.toHaveProperty(
        "evidence",
      );
      expect(preview.body.result.structuredContent).not.toHaveProperty(
        "resolved_entity",
      );
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("closes unsupported SSE requests instead of leaving a serverless function open", async () => {
    const response = await get(
      new NextRequest("http://localhost:3000/mcp/testnet", { method: "GET" }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST, OPTIONS");
  });

  it("turns the payment-risk preview into a reusable paid assessment offer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            records: [
              {
                _id: "fixture-risk-1",
                "מספר חברה": 514744887,
                "שם חברה": "מנדיי. קום בעמ",
                "שם באנגלית": "MONDAY.COM LTD",
                "סוג תאגיד": "חברה פרטית",
                "סטטוס חברה": "פעילה",
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    try {
      const preview = await send({
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: {
          name: "preview_israeli_vendor_payment_risk_free",
          arguments: {
            company_number: "514744887",
            invoice_company_name: "מנדיי. קום בעמ",
            language: "en",
          },
        },
      });
      expect(preview.body.result.isError).not.toBe(true);
      expect(preview.body.result.structuredContent).toMatchObject({
        mode: "free_payment_risk_preview",
        resolution_status: "RESOLVED",
        paid_assessment: {
          preferred_tool: "assess_israeli_vendor_payment_risk_paid",
          price: "$0.10",
          network: "eip155:84532",
          asset: "USDC",
        },
      });
      expect(preview.body.result.structuredContent).not.toHaveProperty(
        "decision",
      );
      expect(preview.body.result.structuredContent).not.toHaveProperty(
        "checks",
      );
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("keeps metadata tools free and returns an x402 v2 MCP challenge for verify_company", async () => {
    const described = await send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "describe_service", arguments: {} },
    });
    expect(described.status).toBe(200);
    expect(described.body.result.isError).not.toBe(true);
    expect(described.body.result.structuredContent.name).toBe(
      "Israel Business Intelligence MCP",
    );

    const schema = await send({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_schema", arguments: {} },
    });
    expect(schema.body.result.structuredContent.tool).toBe("verify_company");

    const sample = await send({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "get_sample_verification_report", arguments: {} },
    });
    expect(sample.body.result.isError).not.toBe(true);
    expect(sample.body.result.structuredContent).toMatchObject({
      sample: true,
      live_lookup: false,
      payment_required: false,
      report: { resolution_status: "RESOLVED" },
    });

    const unpaid = await send({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "verify_israeli_company_paid",
        arguments: { company_number: "514744887", language: "en" },
      },
    });
    expect(unpaid.status).toBe(200);
    expect(unpaid.body.result.isError).toBe(true);
    expect(unpaid.body.result.structuredContent).toMatchObject({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:84532",
          amount: "50000",
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          payTo: "0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82",
        },
      ],
    });
    expect(
      unpaid.body.result.structuredContent.extensions.bazaar.info.input,
    ).toMatchObject({
      type: "mcp",
      toolName: "verify_company",
      transport: "streamable-http",
    });
    expect(unpaid.body.result.structuredContent.resource.description).toContain(
      "/x402-buyer-quickstart.md",
    );
    expect(() =>
      parsePaymentRequired(unpaid.body.result.structuredContent),
    ).not.toThrow();

    const unpaidRisk = await send({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "assess_israeli_vendor_payment_risk_paid",
        arguments: {
          company_number: "514744887",
          invoice_company_number: "514744887",
          language: "en",
        },
      },
    });
    expect(unpaidRisk.body.result.isError).toBe(true);
    expect(unpaidRisk.body.result.structuredContent).toMatchObject({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:84532",
          amount: "100000",
        },
      ],
    });
    expect(
      unpaidRisk.body.result.structuredContent.extensions.bazaar.info.input,
    ).toMatchObject({
      type: "mcp",
      toolName: "assess_israeli_vendor_payment_risk_paid",
      transport: "streamable-http",
    });
    expect(() =>
      parsePaymentRequired(unpaidRisk.body.result.structuredContent),
    ).not.toThrow();
  });
});
