import { createHash } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type RouteHandler = (request: NextRequest) => Promise<Response>;

const testToken = "test-only-pilot-token";
let mcpPost: RouteHandler;
let restPost: RouteHandler;

function mcpRequest(token?: string) {
  return new NextRequest("http://localhost:3000/mcp/pilot", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    }),
  });
}

describe("invitation-only partner pilot", () => {
  beforeAll(async () => {
    vi.stubEnv(
      "PILOT_TOKEN_SHA256",
      createHash("sha256").update(testToken).digest("hex"),
    );
    vi.stubEnv("PILOT_EXPIRES_AT", "2099-01-01T00:00:00.000Z");
    vi.stubEnv("PILOT_PARTNER_ID", "integration-test-partner");
    ({ POST: mcpPost } = await import("@/app/mcp/pilot/route"));
    ({ POST: restPost } = await import("@/app/v1/pilot/verify/route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  it("rejects missing and incorrect bearer credentials", async () => {
    const missing = await mcpPost(mcpRequest());
    const incorrect = await mcpPost(mcpRequest("incorrect"));
    expect(missing.status).toBe(401);
    expect(incorrect.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("exposes exactly the production tool set to an authorized pilot client", async () => {
    const response = await mcpPost(mcpRequest(testToken));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-pilot-verification-limit")).toBe("100");
    expect(
      body.result.tools.map((tool: { name: string }) => tool.name).sort(),
    ).toEqual([
      "describe_service",
      "get_sample_verification_report",
      "get_schema",
      "verify_company",
    ]);
  });

  it("protects the REST pilot before parsing or executing a verification", async () => {
    const request = new NextRequest("http://localhost:3000/v1/pilot/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ company_number: "514744887", language: "en" }),
    });
    const response = await restPost(request);
    expect(response.status).toBe(401);
  });
});
