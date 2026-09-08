import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Exercise a future reviewed resumption without changing the production lock.
vi.mock("@/lib/service-availability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/service-availability")>()),
  PAID_SERVICE_SUSPENDED: false,
}));
const deps = vi.hoisted(() => ({
  facilitator: vi.fn(),
  httpServer: vi.fn(),
  httpWrapper: vi.fn(),
  verify: vi.fn(),
  paymentRisk: vi.fn(),
  invoiceGate: vi.fn(),
  companyChanges: vi.fn(),
}));
vi.mock("@/lib/facilitator-client", () => ({
  createPaymentFacilitatorClient: deps.facilitator,
}));
// The disabled branch must not initialize the SDK (or use the external Node
// loader's extensionless next/server import).
vi.mock("@x402/next", () => ({
  x402HTTPResourceServer: deps.httpServer,
  withX402FromHTTPServer: deps.httpWrapper,
}));
vi.mock("@/lib/services/orchestrator", () => ({
  counterpartyOrchestrator: deps,
}));

describe("disabled payment configuration never grants free paid-report access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("X402_ENABLED", "false");
    vi.stubEnv("X402_MAINNET_ENABLED", "false");
    vi.stubEnv("PUBLIC_BASE_URL", "http://localhost:3000");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("No network permitted"),
    );
    for (const fn of Object.values(deps))
      fn.mockResolvedValue({ private_report: true });
  });
  afterEach(() => {
    expect(globalThis.fetch).not.toHaveBeenCalled();
    for (const fn of Object.values(deps)) expect(fn).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("fails closed for every REST route even if deployment suspension is lifted", async () => {
    const { protectWithX402 } = await import("@/lib/payment");
    const { paidRouteConfig } = await import("@/lib/config");
    const handler = vi.fn(async () =>
      NextResponse.json({ private_report: true }),
    );
    for (const routeName of Object.keys(paidRouteConfig) as Array<
      keyof typeof paidRouteConfig
    >) {
      for (const headers of [{}, { "payment-signature": "MOCK_NOT_SIGNED" }]) {
        const response = await protectWithX402(
          handler,
          routeName,
        )(
          new NextRequest(
            `http://localhost:3000${paidRouteConfig[routeName].path}`,
            {
              method: "POST",
              headers: headers as Record<string, string>,
              body: "{}",
            },
          ),
        );
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({
          error: { code: "PAYMENT_PROCESSING_DISABLED" },
          payment_attempted: false,
        });
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(response.headers.has("payment-required")).toBe(false);
      }
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(["mainnet", "testnet"] as const)(
    "withholds all paid MCP tools on %s",
    async (env) => {
      const { POST } =
        env === "mainnet"
          ? await import("@/app/mcp/route")
          : await import("@/app/mcp/testnet/route");
      for (const name of [
        "verify_company",
        "verify_israeli_company_paid",
        "assess_israeli_vendor_payment_risk_paid",
        "authorize_israeli_invoice_payment_paid",
        "get_israeli_company_changes_paid",
      ]) {
        const response = await POST(
          new NextRequest("http://localhost:3000/mcp", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json, text/event-stream",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "tools/call",
              params: {
                name,
                arguments: {
                  company_number: "514744887",
                  invoice_company_number: "514744887",
                  supplier_company_number: "514744887",
                  invoice_number: "SYNTHETIC-DISABLED",
                  invoice_date: "2026-09-08",
                  amount_before_vat: 6000,
                  vat_amount: 1080,
                  total_amount: 7080,
                },
              },
            }),
          }),
        );
        const result = (await response.json()).result;
        expect(result.isError).toBe(true);
        expect(result._meta).toBeUndefined();
        expect(JSON.parse(result.content[0].text)).toMatchObject({
          error: { code: "PAYMENT_PROCESSING_DISABLED" },
          payment_attempted: false,
        });
      }
    },
  );
});
