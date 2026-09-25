import { createHash } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type RouteHandler = (request: NextRequest) => Promise<Response>;

const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const morningKey = "test-only-morning-key";
const icountKey = "test-only-icount-key";
const expiredKey = "test-only-expired-key";

let mcpPost: RouteHandler;
let usageGet: RouteHandler;
let verifyPost: RouteHandler;
let invoiceGatePost: RouteHandler;
let paymentRiskPost: RouteHandler;
let companyChangesPost: RouteHandler;

function mcpRequest(
  token?: string,
  method = "tools/list",
  params: Record<string, unknown> = {},
) {
  return new NextRequest("http://localhost:3000/mcp/pilot", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

function restRequest(path: string, token?: string, body: unknown = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const PILOT_TOOL_NAMES = [
  "assess_israeli_vendor_payment_risk_paid",
  "authorize_israeli_invoice_payment_paid",
  "describe_service",
  "get_israeli_company_changes_paid",
  "get_sample_verification_report",
  "get_schema",
  "verify_company",
  "verify_israeli_company_paid",
];

describe("invitation-only partner pilot", () => {
  beforeAll(async () => {
    vi.stubEnv(
      "PILOT_KEYS",
      JSON.stringify([
        {
          partner_id: "morning",
          token_sha256: digest(morningKey),
          expires_at: "2099-01-01T00:00:00.000Z",
          call_limit: 250,
        },
        {
          partner_id: "icount",
          token_sha256: digest(icountKey),
          expires_at: "2099-01-01T00:00:00.000Z",
        },
        {
          partner_id: "expired-partner",
          token_sha256: digest(expiredKey),
          expires_at: "2020-01-01T00:00:00.000Z",
          call_limit: 10,
        },
      ]),
    );
    vi.stubEnv("INTERNAL_TEST_TOKEN", "operator-token-for-tests");
    ({ POST: mcpPost } = await import("@/app/mcp/pilot/route"));
    ({ GET: usageGet } = await import("@/app/v1/pilot/usage/route"));
    ({ POST: verifyPost } = await import("@/app/v1/pilot/verify/route"));
    ({ POST: invoiceGatePost } =
      await import("@/app/v1/pilot/invoice-gate/route"));
    ({ POST: paymentRiskPost } =
      await import("@/app/v1/pilot/payment-risk/route"));
    ({ POST: companyChangesPost } =
      await import("@/app/v1/pilot/company-changes/route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  it("rejects missing and incorrect bearer credentials", async () => {
    const missing = await mcpPost(mcpRequest());
    const incorrect = await mcpPost(mcpRequest("incorrect"));
    expect(missing.status).toBe(401);
    expect(incorrect.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");
    expect(missing.headers.get("x-pilot-partner")).toBeNull();
  });

  it("closes an expired partner key with 410 and names the partner", async () => {
    const response = await mcpPost(mcpRequest(expiredKey));
    expect(response.status).toBe(410);
    expect(response.headers.get("x-pilot-partner")).toBe("expired-partner");
    const body = await response.json();
    expect(body.error.code).toBe("PILOT_EXPIRED");
  });

  it("exposes the full product tool set to an authorized partner", async () => {
    const response = await mcpPost(mcpRequest(morningKey));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-pilot-partner")).toBe("morning");
    expect(response.headers.get("x-pilot-call-limit")).toBe("250");
    expect(response.headers.get("x-pilot-expires-at")).toBe(
      "2099-01-01T00:00:00.000Z",
    );
    expect(
      body.result.tools.map((tool: { name: string }) => tool.name).sort(),
    ).toEqual(PILOT_TOOL_NAMES);
  });

  it("keeps partners separate and applies the default call limit", async () => {
    const response = await mcpPost(mcpRequest(icountKey));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-pilot-partner")).toBe("icount");
    expect(response.headers.get("x-pilot-call-limit")).toBe("500");
  });

  it("describes waived pricing and pilot REST endpoints for the partner", async () => {
    const response = await mcpPost(
      mcpRequest(morningKey, "tools/call", {
        name: "describe_service",
        arguments: {},
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    const description = body.result.structuredContent;
    expect(description.pilot).toMatchObject({
      partner_id: "morning",
      call_limit: 250,
      tools: ["verify", "invoice_gate", "payment_risk", "company_changes"],
    });
    expect(description.invoice_payment_gate).toMatchObject({
      price: "waived under the invitation-only partner pilot",
      tool: "authorize_israeli_invoice_payment_paid",
      decisions: ["PAY", "HOLD", "BLOCK"],
    });
    expect(description.invoice_payment_gate.rest_endpoint).toMatch(
      /\/v1\/pilot\/invoice-gate$/,
    );
    expect(description.company_changes.rest_endpoint).toMatch(
      /\/v1\/pilot\/company-changes$/,
    );
    expect(description.assess_payment_risk.rest_endpoint).toMatch(
      /\/v1\/pilot\/payment-risk$/,
    );
  });

  it("protects every REST pilot route before parsing or executing", async () => {
    const routes: Array<[string, RouteHandler]> = [
      ["/v1/pilot/verify", verifyPost],
      ["/v1/pilot/invoice-gate", invoiceGatePost],
      ["/v1/pilot/payment-risk", paymentRiskPost],
      ["/v1/pilot/company-changes", companyChangesPost],
    ];
    for (const [path, handler] of routes) {
      const response = await handler(
        restRequest(path, undefined, {
          company_number: "514744887",
          language: "en",
        }),
      );
      expect(response.status, path).toBe(401);
    }
  });

  it("reports usage to the partner and lists every partner for the operator", async () => {
    const unauthorized = await usageGet(
      new NextRequest("http://localhost:3000/v1/pilot/usage"),
    );
    expect(unauthorized.status).toBe(401);

    const partnerView = await usageGet(
      new NextRequest("http://localhost:3000/v1/pilot/usage", {
        headers: { authorization: `Bearer ${morningKey}` },
      }),
    );
    const partnerBody = await partnerView.json();
    expect(partnerView.status).toBe(200);
    expect(partnerView.headers.get("x-pilot-partner")).toBe("morning");
    expect(partnerBody).toMatchObject({
      partner_id: "morning",
      call_limit: 250,
      usage: { durable: false, period_total: 0 },
    });
    expect(partnerBody.usage.note).toContain("UPSTASH_REDIS_REST_URL");

    const operatorView = await usageGet(
      new NextRequest("http://localhost:3000/v1/pilot/usage", {
        headers: { "x-internal-test-token": "operator-token-for-tests" },
      }),
    );
    const operatorBody = await operatorView.json();
    expect(operatorView.status).toBe(200);
    expect(operatorBody.operator_view).toBe(true);
    expect(
      operatorBody.partners.map(
        (entry: { partner_id: string }) => entry.partner_id,
      ),
    ).toEqual(["morning", "icount", "expired-partner"]);

    const pastMonth = await usageGet(
      new NextRequest("http://localhost:3000/v1/pilot/usage?month=2026-08", {
        headers: { "x-internal-test-token": "operator-token-for-tests" },
      }),
    );
    const pastMonthBody = await pastMonth.json();
    expect(pastMonth.status).toBe(200);
    expect(pastMonthBody.month).toBe("2026-08");
    expect(pastMonthBody.partners[0].usage.month).toBe("2026-08");

    const badMonth = await usageGet(
      new NextRequest("http://localhost:3000/v1/pilot/usage?month=8-2026", {
        headers: { authorization: `Bearer ${morningKey}` },
      }),
    );
    expect(badMonth.status).toBe(400);

    const wrongOperator = await usageGet(
      new NextRequest("http://localhost:3000/v1/pilot/usage", {
        headers: { "x-internal-test-token": "wrong" },
      }),
    );
    expect(wrongOperator.status).toBe(401);
  });

  it("validates input for an authorized partner without a live lookup", async () => {
    const response = await invoiceGatePost(
      restRequest("/v1/pilot/invoice-gate", morningKey, {}),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(response.headers.get("x-pilot-partner")).toBe("morning");
    expect(response.headers.get("x-pilot-call-limit")).toBe("250");
  });
});
