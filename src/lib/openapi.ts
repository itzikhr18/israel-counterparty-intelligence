import {
  agentPaymentTrustInputJsonSchema,
  agentPaymentTrustOutputJsonSchema,
} from "@/lib/agent-payment-trust-schema";
import { config, paidRouteConfig } from "@/lib/config";
import { API_VERSION } from "@/lib/domain";
import {
  paymentRiskInputJsonSchema,
  paymentRiskOutputJsonSchema,
} from "@/lib/payment-risk-schema";
import {
  companyChangesInputJsonSchema,
  companyChangesOutputJsonSchema,
} from "@/lib/company-changes-schema";
import {
  invoiceGateInputJsonSchema,
  invoiceGateOutputJsonSchema,
} from "@/lib/invoice-gate-schema";

const requestSchema = {
  type: "object",
  properties: {
    company_name: { type: "string", minLength: 2, maxLength: 200 },
    company_number: {
      type: "string",
      description: "Nine-digit Israeli company number",
    },
    city: { type: "string" },
    website: { type: "string", format: "uri" },
    expected_entity_type: { type: "string" },
    language: { type: "string", enum: ["en", "he"], default: "en" },
    depth: { type: "string", enum: ["basic", "standard"], default: "standard" },
  },
  anyOf: [{ required: ["company_name"] }, { required: ["company_number"] }],
  additionalProperties: false,
};

function paidPost(
  summary: string,
  description: string,
  price: string,
  inputSchema: Record<string, unknown> = requestSchema,
  outputSchema: Record<string, unknown> = {
    type: "object",
    required: ["request_id", "evidence", "checked_at"],
  },
) {
  return {
    summary,
    description: `${description} Price: ${price} per successful call through x402 when enabled.`,
    operationId: summary.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "_"),
    requestBody: {
      required: true,
      content: { "application/json": { schema: inputSchema } },
    },
    responses: {
      "200": {
        description: "Evidence-backed result",
        content: {
          "application/json": {
            schema: outputSchema,
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": {
        description:
          "Payment required; instructions are returned in PAYMENT-REQUIRED",
        headers: { "PAYMENT-REQUIRED": { schema: { type: "string" } } },
      },
      "409": { description: "Ambiguous entity resolution" },
      "422": { description: "No reliable entity resolution" },
      "429": { description: "Rate limited" },
      "502": { description: "Critical public source unavailable" },
    },
  };
}

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Israel Counterparty Intelligence API",
    version: API_VERSION,
    description:
      "Agent-native Israeli counterparty intelligence and an x402 pre-sign payment firewall. Heuristic output is not legal, credit, or payment advice.",
  },
  servers: [{ url: config.PUBLIC_BASE_URL }],
  tags: [
    {
      name: "counterparty",
      description: "Israeli public business intelligence",
    },
    {
      name: "agent-payments",
      description: "Dry-run controls before an agent wallet signs",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: { "200": { description: "Healthy" } },
      },
    },
    "/v1/verify": {
      post: {
        tags: ["counterparty"],
        ...paidPost(
          "Verify Israeli company",
          paidRouteConfig.verify.description,
          paidRouteConfig.verify.price,
        ),
      },
    },
    "/v1/verify/mainnet": {
      post: {
        tags: ["counterparty"],
        ...paidPost(
          "Verify Israeli company on Base Mainnet",
          paidRouteConfig["verify-mainnet"].description,
          paidRouteConfig["verify-mainnet"].price,
        ),
      },
    },
    "/v1/government-footprint": {
      post: {
        tags: ["counterparty"],
        ...paidPost(
          "Government footprint",
          paidRouteConfig["government-footprint"].description,
          paidRouteConfig["government-footprint"].price,
        ),
      },
    },
    "/v1/counterparty-risk": {
      post: {
        tags: ["counterparty"],
        ...paidPost(
          "Counterparty risk",
          paidRouteConfig["counterparty-risk"].description,
          paidRouteConfig["counterparty-risk"].price,
        ),
      },
    },
    "/v1/payment-risk/mainnet": {
      post: {
        tags: ["counterparty"],
        ...paidPost(
          "Assess Israeli vendor payment risk",
          paidRouteConfig["payment-risk-mainnet"].description,
          paidRouteConfig["payment-risk-mainnet"].price,
          paymentRiskInputJsonSchema,
          paymentRiskOutputJsonSchema,
        ),
      },
    },
    "/v1/invoice-gate/preview": {
      post: {
        tags: ["agent-payments"],
        summary: "Preview an Israeli invoice payment gate for free",
        description:
          "Free structural check of VAT arithmetic, invoice totals, and the date-sensitive Israel Invoices allocation-number threshold. Does not resolve the supplier or contact the Tax Authority.",
        operationId: "preview_israeli_invoice_payment_gate",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: invoiceGateInputJsonSchema },
          },
        },
        responses: {
          "200": {
            description: "Structural preview; never authorization to pay",
            content: {
              "application/json": { schema: invoiceGateOutputJsonSchema },
            },
          },
          "400": { description: "Invalid input" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/v1/invoice-gate/mainnet": {
      post: {
        tags: ["agent-payments"],
        ...paidPost(
          "Authorize an Israeli invoice payment",
          paidRouteConfig["invoice-gate-mainnet"].description,
          paidRouteConfig["invoice-gate-mainnet"].price,
          invoiceGateInputJsonSchema,
          invoiceGateOutputJsonSchema,
        ),
      },
    },
    "/v1/company-changes/mainnet": {
      post: {
        tags: ["counterparty"],
        ...paidPost(
          "Get recent Israeli company changes",
          paidRouteConfig["company-changes-mainnet"].description,
          paidRouteConfig["company-changes-mainnet"].price,
          companyChangesInputJsonSchema,
          companyChangesOutputJsonSchema,
        ),
      },
    },
    "/v1/agent-payment-trust": {
      post: {
        tags: ["agent-payments"],
        summary: "Check an x402 payment before signing",
        description:
          "Free dry-run. Resolves the Israeli company and checks a signed domain payee manifest, exact payment destination, resource origin, fingerprint, and buyer mandate. Never signs or submits a payment.",
        operationId: "check_agent_payment_trust",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: agentPaymentTrustInputJsonSchema },
          },
        },
        responses: {
          "200": {
            description: "ALLOW, REVIEW, or DENY dry-run decision",
            content: {
              "application/json": { schema: agentPaymentTrustOutputJsonSchema },
            },
          },
          "400": { description: "Invalid input" },
          "429": { description: "Rate limited" },
          "500": { description: "Unexpected internal error" },
        },
      },
    },
  },
};
