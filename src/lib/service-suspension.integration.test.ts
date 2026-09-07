import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  facilitator: vi.fn(),
  httpResourceServer: vi.fn(),
  protectedHandler: vi.fn(),
  verify: vi.fn(),
  governmentFootprint: vi.fn(),
  counterpartyRisk: vi.fn(),
  paymentRisk: vi.fn(),
  invoiceGate: vi.fn(),
  companyChanges: vi.fn(),
  agentPaymentTrust: vi.fn(),
}));
vi.mock("@/lib/facilitator-client", () => ({
  createPaymentFacilitatorClient: dependencies.facilitator,
}));
// Vitest's external Node loader cannot resolve @x402/next's extensionless
// next/server import. This boundary must not initialize at all during suspension;
// spies make that invariant explicit rather than simulating successful payment.
vi.mock("@x402/next", () => ({
  x402HTTPResourceServer: dependencies.httpResourceServer,
  withX402FromHTTPServer: dependencies.protectedHandler,
}));
vi.mock("@/lib/services/orchestrator", () => ({
  counterpartyOrchestrator: dependencies,
}));

const invoice = {
  company_number: "514744887",
  supplier_company_number: "514744887",
  invoice_company_number: "514744887",
  invoice_number: "SYNTHETIC-SUSPENSION-TEST",
  invoice_date: "2026-09-07",
  amount_before_vat: 6000,
  vat_amount: 1080,
  total_amount: 7080,
  language: "en",
};
const paidNames = [
  "verify_company",
  "verify_israeli_company_paid",
  "assess_israeli_vendor_payment_risk_paid",
  "authorize_israeli_invoice_payment_paid",
  "get_israeli_company_changes_paid",
];
const allToolNames = [
  ...paidNames,
  "describe_service",
  "get_schema",
  "get_sample_verification_report",
  "preview_agent_payment_trust",
  "preview_israeli_vendor_payment_risk_free",
  "preview_israeli_invoice_payment_gate_free",
  "preview_company",
  "preview_israeli_company_free",
].sort();
const paidRoutes = [
  ["/v1/verify", () => import("@/app/v1/verify/route")],
  ["/v1/verify/mainnet", () => import("@/app/v1/verify/mainnet/route")],
  [
    "/v1/government-footprint",
    () => import("@/app/v1/government-footprint/route"),
  ],
  ["/v1/counterparty-risk", () => import("@/app/v1/counterparty-risk/route")],
  [
    "/v1/payment-risk/mainnet",
    () => import("@/app/v1/payment-risk/mainnet/route"),
  ],
  [
    "/v1/invoice-gate/mainnet",
    () => import("@/app/v1/invoice-gate/mainnet/route"),
  ],
  [
    "/v1/company-changes/mainnet",
    () => import("@/app/v1/company-changes/mainnet/route"),
  ],
] as const;

function setPaymentFlags(enabled: "true" | "false") {
  vi.stubEnv("X402_ENABLED", enabled);
  vi.stubEnv("X402_MAINNET_ENABLED", enabled);
  // A zero recipient would reject initialization. Suspension must precede it.
  vi.stubEnv("X402_PAY_TO", `0x${"0".repeat(40)}`);
  vi.stubEnv("X402_MAINNET_PAY_TO", `0x${"0".repeat(40)}`);
  vi.stubEnv("PUBLIC_BASE_URL", "http://localhost:3000");
}

describe("temporary paid-service suspension (actual production default)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    for (const operation of Object.values(dependencies)) {
      operation.mockImplementation(() => {
        throw new Error("A suspended paid dependency was invoked");
      });
    }
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Unexpected network call"),
    );
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    expect(globalThis.fetch).not.toHaveBeenCalled();
    for (const operation of Object.values(dependencies))
      expect(operation).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("is fail-closed in the actual production default and has a machine-readable body", async () => {
    const availability = await import("@/lib/service-availability");
    expect(availability.PAID_SERVICE_SUSPENDED).toBe(true);
    expect(availability.paidServiceUnavailableBody()).toMatchObject({
      error: { code: "PAID_SERVICE_SUSPENDED", message: expect.any(String) },
      payment_attempted: false,
    });
  });

  for (const enabled of ["true", "false"] as const) {
    for (const [path, loadRoute] of paidRoutes) {
      for (const signatureHeader of [
        null,
        "payment-signature",
        "x-payment",
      ] as const) {
        it(`returns 503 for ${path}, flags=${enabled}, signature=${signatureHeader ?? "none"}`, async () => {
          setPaymentFlags(enabled);
          const { POST } = await loadRoute();
          const response = await POST(
            new NextRequest(`http://localhost:3000${path}`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                ...(signatureHeader
                  ? { [signatureHeader]: "MOCK_NOT_A_REAL_SIGNATURE" }
                  : {}),
              },
              body: JSON.stringify(invoice),
            }),
          );
          expect(response.status).toBe(503);
          expect(response.headers.get("cache-control")).toContain("no-store");
          for (const header of [
            "payment-required",
            "payment-response",
            "x-payment-response",
            "x-payment-instructions",
          ])
            expect(response.headers.has(header)).toBe(false);
          const body = await response.json();
          expect(body).toMatchObject({
            error: { code: "PAID_SERVICE_SUSPENDED" },
            payment_attempted: false,
          });
          expect(body).not.toHaveProperty("accepts");
          expect(body).not.toHaveProperty("decision");
          expect(body).not.toHaveProperty("resolved_entity");
        });
      }
    }

    for (const environment of ["mainnet", "testnet"] as const) {
      it(`keeps discovery/free preview and suspends all five MCP paid names: ${environment}, flags=${enabled}`, async () => {
        setPaymentFlags(enabled);
        const { POST } =
          environment === "mainnet"
            ? await import("@/app/mcp/route")
            : await import("@/app/mcp/testnet/route");
        const send = async (
          method: string,
          params: Record<string, unknown>,
        ) => {
          const response = await POST(
            new NextRequest(
              `http://localhost:3000${environment === "mainnet" ? "/mcp" : "/mcp/testnet"}`,
              {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  accept: "application/json, text/event-stream",
                },
                body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
              },
            ),
          );
          expect(response.status).toBe(200);
          expect(response.headers.get("cache-control")).toContain("no-store");
          return response.json();
        };
        const list = await send("tools/list", {});
        expect(
          list.result.tools.map((tool: { name: string }) => tool.name).sort(),
        ).toEqual(allToolNames);
        for (const name of paidNames) {
          for (const meta of [
            undefined,
            {
              "x402/payment": {
                x402Version: 2,
                payload: { signature: "MOCK_NOT_A_REAL_SIGNATURE" },
              },
            },
          ]) {
            const response = await send("tools/call", {
              name,
              arguments: invoice,
              ...(meta ? { _meta: meta } : {}),
            });
            expect(response.error).toBeUndefined();
            expect(response.result.isError).toBe(true);
            expect(
              response.result._meta?.["x402/payment-response"],
            ).toBeUndefined();
            const text = response.result.content.find(
              (item: { type: string }) => item.type === "text",
            ).text;
            expect(JSON.parse(text)).toMatchObject({
              error: { code: "PAID_SERVICE_SUSPENDED" },
              payment_attempted: false,
            });
            expect(JSON.parse(text)).not.toHaveProperty("accepts");
            expect(JSON.parse(text)).not.toHaveProperty("evidence");
            expect(JSON.parse(text)).not.toHaveProperty("decision");
            expect(response.result.structuredContent?.accepts).toBeUndefined();
            expect(response.result.structuredContent?.decision).toBeUndefined();
            expect(text).not.toContain('"x402Version"');
            expect(text).not.toContain('"resolved_entity"');
          }
        }
        const preview = await send("tools/call", {
          name: "preview_israeli_invoice_payment_gate_free",
          arguments: invoice,
        });
        expect(preview.result.isError).not.toBe(true);
        expect(preview.result.structuredContent).toMatchObject({
          preview: true,
          decision: { action: "HOLD", automation_safe: false },
        });
      });
    }
  }

  it("keeps the free REST invoice structural preview usable", async () => {
    setPaymentFlags("false");
    const { POST } = await import("@/app/v1/invoice-gate/preview/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/v1/invoice-gate/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(invoice),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      preview: true,
      decision: { action: "HOLD", automation_safe: false },
    });
  });

  it("advertises suspension without payment offers in current x402 discovery", async () => {
    setPaymentFlags("true");
    const { GET } = await import("@/app/.well-known/x402/route");
    const { PAID_SERVICE_NOTICE } = await import("@/lib/service-availability");
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      paid_service_suspended: true,
      status: "PAID SERVICES SUSPENDED - FREE PREVIEWS AVAILABLE",
      notice: PAID_SERVICE_NOTICE,
      endpoints: [],
    });
  });

  it("reports service health separately from suspended payment availability", async () => {
    setPaymentFlags("true");
    const { GET } = await import("@/app/health/route");
    const { PAID_SERVICE_NOTICE } = await import("@/lib/service-availability");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      status: "ok",
      payments: {
        status: "suspended",
        paid_service_suspended: true,
        notice: PAID_SERVICE_NOTICE,
      },
    });
  });

  it("shows the suspension notice on the landing page and service manifest", async () => {
    setPaymentFlags("true");
    const { GET } = await import("@/app/route");
    const { PAID_SERVICE_NOTICE } = await import("@/lib/service-availability");
    const response = await GET(
      new NextRequest("http://localhost:3000/", {
        headers: { accept: "text/html" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const html = await response.text();
    expect(html).toContain(PAID_SERVICE_NOTICE);
    expect(html).not.toContain("--pay");
    const manifest = await GET();
    expect(await manifest.json()).toMatchObject({
      status: "PAID SERVICES SUSPENDED - FREE PREVIEWS AVAILABLE",
      paid_service: { suspended: true, notice: PAID_SERVICE_NOTICE },
    });
  });

  it("keeps browser invoice checks available without a wallet-handoff or payment CTA", async () => {
    setPaymentFlags("true");
    const { POST } = await import("@/app/invoice-preview/route");
    const { PAID_SERVICE_NOTICE } = await import("@/lib/service-availability");
    const response = await POST(
      new NextRequest("http://localhost:3000/invoice-preview", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          supplier_company_number: invoice.supplier_company_number,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          amount_before_vat: "6000",
          vat_amount: "1080",
          total_amount: "7080",
          buyer_is_authorized_dealer: "true",
          buyer_requested_allocation_number: "true",
          allocation_number: "123456789",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const html = await response.text();
    expect(html).toContain("Free invoice result · HOLD");
    expect(html).toContain(PAID_SERVICE_NOTICE);
    expect(html).not.toContain("--pay");
    expect(html).not.toContain('value="wallet-handoff"');
    expect(html).not.toContain("Continue with this invoice · 0.25 USDC");
  });

  it("keeps resolved company preview HTML informative without a paid-report CTA", async () => {
    const { renderPreviewPage } = await import("@/lib/landing");
    const { PAID_SERVICE_NOTICE } = await import("@/lib/service-availability");
    const html = renderPreviewPage({
      providerName: "Synthetic test provider",
      companyNumber: "514744887",
      result: {
        resolutionStatus: "RESOLVED",
        company: {
          companyNumber: "514744887",
          legalName: "Synthetic company fixture",
          status: "Active",
        },
        candidates: [],
        confidence: 1,
        checkedAt: "2026-09-07T12:00:00Z",
      },
    });
    expect(html).toContain("Synthetic company fixture");
    expect(html).toContain(PAID_SERVICE_NOTICE);
    expect(html).not.toContain("--pay");
  });

  for (const requestJson of [JSON.stringify(invoice), "invalid JSON"])
    it(`rejects a direct wallet handoff before supplier lookup (${requestJson === "invalid JSON" ? "malformed" : "valid"} payload)`, async () => {
      setPaymentFlags("true");
      const { entityResolutionService } =
        await import("@/lib/services/entity-resolution");
      const resolve = vi
        .spyOn(entityResolutionService, "resolve")
        .mockRejectedValue(new Error("Unexpected supplier lookup"));
      const { POST } = await import("@/app/invoice-preview/route");
      const response = await POST(
        new NextRequest("http://localhost:3000/invoice-preview", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "wallet-handoff",
            invoice_request: requestJson,
          }),
        }),
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.has("content-disposition")).toBe(false);
      expect(response.headers.has("payment-required")).toBe(false);
      expect(await response.json()).toMatchObject({
        error: { code: "PAID_SERVICE_SUSPENDED" },
        payment_attempted: false,
      });
      expect(resolve).not.toHaveBeenCalled();
    });
});
