import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { config, paidRouteConfig } from "@/lib/config";
import { API_VERSION } from "@/lib/domain";
import { renderLandingPage } from "@/lib/landing";
import {
  PAID_SERVICE_NOTICE,
  PAID_SERVICE_SUSPENDED,
} from "@/lib/service-availability";

export function serviceManifest() {
  return {
    service: config.PROVIDER_NAME,
    version: API_VERSION,
    status: PAID_SERVICE_SUSPENDED
      ? "PAID SERVICES SUSPENDED - FREE PREVIEWS AVAILABLE"
      : "MAINNET LIVE - first external paid call confirmed",
    paid_service: {
      suspended: PAID_SERVICE_SUSPENDED,
      notice: PAID_SERVICE_SUSPENDED ? PAID_SERVICE_NOTICE : undefined,
    },
    purpose:
      "Evidence-backed public intelligence for Israeli business counterparties",
    endpoints: Object.values(paidRouteConfig).map(
      ({ path, price, description }) => ({
        method: "POST",
        path,
        price,
        description,
      }),
    ),
    free_endpoints: [
      {
        method: "POST",
        path: "/v1/invoice-gate/preview",
        price: "free",
        description:
          "Checks Israeli invoice VAT arithmetic, totals, and the date-sensitive allocation-number threshold; never authorizes payment.",
      },
      {
        method: "POST",
        path: "/v1/agent-payment-trust",
        price: "free during dry-run MVP",
        description:
          "Pre-sign x402 payment firewall returning ALLOW, REVIEW, or DENY without signing or submitting a payment.",
      },
    ],
    health: "/health",
    openapi: "/openapi.json",
    x402_enabled: {
      testnet: config.X402_ENABLED,
      mainnet: config.X402_MAINNET_ENABLED,
    },
    mcp: {
      name: "Israel Business Intelligence MCP",
      transport: "streamable-http",
      production: {
        endpoint: "/mcp",
        network: "eip155:8453",
        prices: {
          company_changes: config.X402_MCP_MAINNET_COMPANY_CHANGES_PRICE,
          company_verification: config.X402_MCP_MAINNET_VERIFY_PRICE,
          vendor_payment_risk: config.X402_MCP_MAINNET_PAYMENT_RISK_PRICE,
          invoice_payment_gate: config.X402_MCP_MAINNET_INVOICE_GATE_PRICE,
        },
      },
      testnet: {
        endpoint: "/mcp/testnet",
        network: "eip155:84532",
        price: config.X402_MCP_TESTNET_VERIFY_PRICE,
      },
      tools: {
        paid: [
          "verify_israeli_company_paid",
          "verify_company",
          "assess_israeli_vendor_payment_risk_paid",
          "authorize_israeli_invoice_payment_paid",
          "get_israeli_company_changes_paid",
        ],
        free: [
          "preview_israeli_company_free",
          "preview_israeli_vendor_payment_risk_free",
          "preview_israeli_invoice_payment_gate_free",
          "preview_agent_payment_trust",
          "get_sample_verification_report",
          "preview_company",
          "describe_service",
          "get_schema",
        ],
      },
      metadata: "/mcp.json",
      buyer_bridge: "/israel-company-verify-buyer-0.4.0.tgz",
      buyer_bridge_github:
        "https://github.com/itzikhr18/israel-company-verify-buyer",
    },
    source_repository:
      "https://github.com/itzikhr18/israel-counterparty-intelligence",
    discovery: {
      agent_tools: "israel-counterparty-intelligence-vercel-app-sub393",
      x402scan: "e9b83616-3c3e-483a-81a2-a93c2b85dd7e",
      index_402: "fa0902ac-90a7-431a-8979-97da22a12911",
      well_known: {
        x402: "/.well-known/x402",
        agent_card: "/.well-known/agent-card.json",
        agent: "/.well-known/agent.json",
        ai_plugin: "/.well-known/ai-plugin.json",
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
    disclaimer: "Not legal, credit, sanctions, or investment advice.",
  };
}

function wantsHtml(request?: NextRequest): boolean {
  // Programmatic GET() (no Request) stays JSON for tests/manifest callers.
  if (!request) return false;
  const format = request.nextUrl.searchParams.get("format");
  if (format === "json") return false;
  if (format === "html") return true;

  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  // GoPlausible / Bazaar enrichment crawlers often fetch "/" with */* or no Accept.
  // Prefer HTML so og:/icon metadata and agent discovery links are visible; JSON
  // remains available when the client explicitly prefers application/json.
  if (!accept || accept === "*/*") return true;
  const htmlIndex = accept.indexOf("text/html");
  const jsonIndex = accept.indexOf("application/json");
  if (htmlIndex === -1 && jsonIndex === -1) return true;
  if (htmlIndex === -1) return false;
  if (jsonIndex === -1) return true;
  return htmlIndex <= jsonIndex;
}

export async function GET(request?: NextRequest) {
  if (!wantsHtml(request)) {
    const response = NextResponse.json(serviceManifest());
    response.headers.set("Vary", "Accept");
    return response;
  }

  return new NextResponse(
    renderLandingPage({
      providerName: config.PROVIDER_NAME,
      paidServiceNotice: PAID_SERVICE_SUSPENDED
        ? PAID_SERVICE_NOTICE
        : undefined,
      mcpPrice: config.X402_MCP_MAINNET_VERIFY_PRICE.replace("$", ""),
      paymentRiskPrice: config.X402_MCP_MAINNET_PAYMENT_RISK_PRICE.replace(
        "$",
        "",
      ),
      companyChangesPrice:
        config.X402_MCP_MAINNET_COMPANY_CHANGES_PRICE.replace("$", ""),
      invoiceGatePrice: config.X402_MCP_MAINNET_INVOICE_GATE_PRICE.replace(
        "$",
        "",
      ),
      restPrice: paidRouteConfig["verify-mainnet"].price,
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        Vary: "Accept",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      },
    },
  );
}
