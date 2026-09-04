import { randomUUID } from "node:crypto";

import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type {
  Network,
  PaymentRequirements,
  PaymentPayload,
  SettleResponse,
} from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createPaymentWrapper } from "@x402/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  agentPaymentTrustInputJsonSchema,
  agentPaymentTrustOutputJsonSchema,
  agentPaymentTrustOutputSchema,
  agentPaymentTrustQuerySchema,
} from "@/lib/agent-payment-trust-schema";
import {
  config,
  paymentEnvironments,
  type PaymentEnvironmentName,
} from "@/lib/config";
import {
  companyChangesExample,
  companyChangesInputJsonSchema,
  companyChangesOutputJsonSchema,
  companyChangesQuerySchema,
  type CompanyChangesQuery,
} from "@/lib/company-changes-schema";
import {
  ApiError,
  counterpartyQuerySchema,
  previewCompanyQuerySchema,
} from "@/lib/domain";
import { isInternalMcpPayer, logMcpSettlement } from "@/lib/mcp-telemetry";
import { priceToAtomicUsdc, usdcEip712Domain } from "@/lib/payment-config";
import {
  paymentRiskExample,
  paymentRiskInputJsonSchema,
  paymentRiskOutputJsonSchema,
  paymentRiskQuerySchema,
  type PaymentRiskQuery,
} from "@/lib/payment-risk-schema";
import { createExternalPaidCallEvent } from "@/lib/payment-telemetry";
import { pilotMetadata, runPilotVerification } from "@/lib/pilot";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";
import { x402DiscoverySchema } from "@/lib/x402-discovery-schema";
import {
  verifyExample,
  verifyInputJsonSchema,
  verifyOutputJsonSchema,
} from "@/lib/verification-schema";

export const MCP_SERVER_NAME = "Israel Business Intelligence MCP";
export const MCP_SERVER_VERSION = "1.5.2";

export const FREE_PREVIEW_TOOL = "preview_israeli_company_free";
export const PAID_VERIFY_TOOL = "verify_israeli_company_paid";
export const SAMPLE_REPORT_TOOL = "get_sample_verification_report";
export const FREE_PAYMENT_RISK_PREVIEW_TOOL =
  "preview_israeli_vendor_payment_risk_free";
export const PAID_PAYMENT_RISK_TOOL = "assess_israeli_vendor_payment_risk_paid";
export const AGENT_PAYMENT_TRUST_TOOL = "preview_agent_payment_trust";
export const PAID_COMPANY_CHANGES_TOOL = "get_israeli_company_changes_paid";

const DESCRIPTION =
  "Paid Israeli company verification by legal name or company number. Resolves records in the Israeli Companies Registry and returns structured, field-level public-registry evidence for supplier checks, due diligence, and public-registry KYB evidence. Not Full Regulatory KYB.";

export const X402_BUYER_QUICKSTART_URL = `${config.PUBLIC_BASE_URL}/x402-buyer-quickstart.md`;
export const X402_BUYER_BRIDGE_URL = `${config.PUBLIC_BASE_URL}/israel-company-verify-buyer-0.3.0.tgz`;

const LIMITATIONS = [
  "Public-registry evidence only; coverage depends on source availability and freshness.",
  "Not Full Regulatory KYB and not a substitute for legal, sanctions, UBO, credit, or compliance review.",
  "Ambiguous names may require an Israeli company number or additional context.",
];

function serverInstructions(accessMode: "paid" | "pilot"): string {
  if (accessMode === "pilot") {
    return "Use verify_company for invitation-only partner verification. Payment is waived only when this authenticated pilot endpoint is used. Use get_sample_verification_report to inspect the response shape without a live lookup.";
  }
  return `Start with ${FREE_PREVIEW_TOOL} for a free identity and registry-status check. If it resolves the company, reuse the exact company number with ${PAID_COMPANY_CHANGES_TOOL} for recent official filing and status-change events, or use next_action.arguments with ${PAID_VERIFY_TOOL} for the complete evidence-backed result. Before an agent signs an x402 payment, use ${AGENT_PAYMENT_TRUST_TOOL} for a free dry-run that binds the legal entity, service domain, signed payee manifest, payment destination, and buyer mandate into an ALLOW, REVIEW, or DENY decision. For invoice and vendor-context risk, use ${FREE_PAYMENT_RISK_PREVIEW_TOOL}, then ${PAID_PAYMENT_RISK_TOOL}. Company changes cost $0.01 USDC, company verification costs $0.05 USDC, and payment-risk assessment costs $0.10 USDC on Base Mainnet. Use ${SAMPLE_REPORT_TOOL} to inspect a static full-report example without payment. Buyer bridge: ${X402_BUYER_BRIDGE_URL}`;
}

const previewCandidateSchema = z.object({
  legal_name: z.string(),
  company_number: z.string(),
  status: z.string(),
  confidence: z.number().min(0).max(1),
});

const nextActionSchema = z.object({
  recommended: z.boolean(),
  tool: z.enum(["verify_company", "preview_company"]),
  preferred_tool: z.enum([PAID_VERIFY_TOOL, FREE_PREVIEW_TOOL]),
  arguments: z.record(z.string(), z.unknown()),
  reason: z.string(),
  requires_payment: z.boolean(),
  price: z.string().nullable(),
  network: z.string().nullable(),
  asset: z.literal("USDC").nullable(),
  buyer_quickstart: z.string().url(),
  buyer_bridge: z.string().url(),
});

const previewCompanyOutputSchema = z.object({
  request_id: z.string().describe("Unique preview request identifier."),
  preview_version: z.string().describe("Preview contract version."),
  mode: z.literal("free_preview"),
  resolution_status: z.enum(["RESOLVED", "AMBIGUOUS", "NOT_FOUND"]),
  company: z
    .object({
      legal_name: z.string(),
      company_number: z.string(),
      status: z.string(),
    })
    .nullable(),
  candidates: z.array(previewCandidateSchema),
  confidence: z.number().min(0).max(1),
  checked_at: z.string(),
  preview_limitations: z.array(z.string()),
  full_verification: z.object({
    tool: z.literal("verify_company"),
    price: z.string(),
    network: z.string(),
    asset: z.literal("USDC"),
    protocol: z.literal("x402 v2 over MCP"),
    buyer_quickstart: z.string().url(),
    buyer_bridge: z.string().url(),
    preferred_tool: z.literal(PAID_VERIFY_TOOL),
    recommended_arguments: z.record(z.string(), z.unknown()),
    unlocks: z.array(z.string()),
  }),
  paid_actions: z.array(
    z.object({
      preferred_tool: z.enum([PAID_COMPANY_CHANGES_TOOL, PAID_VERIFY_TOOL]),
      purpose: z.string(),
      price: z.string(),
      network: z.string(),
      asset: z.literal("USDC"),
      recommended_arguments: z.record(z.string(), z.unknown()),
    }),
  ),
  next_action: nextActionSchema,
});

const paymentRiskPreviewOutputSchema = z.object({
  request_id: z.string(),
  preview_version: z.string(),
  mode: z.literal("free_payment_risk_preview"),
  resolution_status: z.enum(["RESOLVED", "AMBIGUOUS", "NOT_FOUND"]),
  company: z
    .object({
      legal_name: z.string(),
      company_number: z.string(),
      status: z.string(),
    })
    .nullable(),
  supplied_signal_types: z.array(z.string()),
  paid_assessment: z.object({
    preferred_tool: z.literal(PAID_PAYMENT_RISK_TOOL),
    price: z.string(),
    network: z.string(),
    asset: z.literal("USDC"),
    recommended_arguments: z.record(z.string(), z.unknown()),
    returns: z.array(z.string()),
  }),
  preview_limitations: z.array(z.string()),
  checked_at: z.string(),
});

const resourceServers = new Map<
  PaymentEnvironmentName,
  Promise<x402ResourceServer>
>();

export function mcpEndpointPath(
  environmentName: PaymentEnvironmentName,
): string {
  return environmentName === "mainnet" ? "/mcp" : "/mcp/testnet";
}

export function mcpToolResourceUrl(
  environmentName: PaymentEnvironmentName,
): string {
  return `mcp://israel-business-intelligence/verify_company/${environmentName}`;
}

export function mcpPrice(environmentName: PaymentEnvironmentName): string {
  return environmentName === "mainnet"
    ? config.X402_MCP_MAINNET_VERIFY_PRICE
    : config.X402_MCP_TESTNET_VERIFY_PRICE;
}

export function mcpPaymentRiskPrice(
  environmentName: PaymentEnvironmentName,
): string {
  return environmentName === "mainnet"
    ? config.X402_MCP_MAINNET_PAYMENT_RISK_PRICE
    : config.X402_MCP_TESTNET_PAYMENT_RISK_PRICE;
}

export function mcpCompanyChangesPrice(
  environmentName: PaymentEnvironmentName,
): string {
  return environmentName === "mainnet"
    ? config.X402_MCP_MAINNET_COMPANY_CHANGES_PRICE
    : config.X402_MCP_TESTNET_COMPANY_CHANGES_PRICE;
}

export function mcpPaymentRequirements(
  environmentName: PaymentEnvironmentName,
): PaymentRequirements[] {
  const environment = paymentEnvironments[environmentName];
  return [
    {
      scheme: "exact",
      network: environment.network as Network,
      amount: priceToAtomicUsdc(mcpPrice(environmentName)),
      asset: environment.asset,
      payTo: environment.payTo,
      maxTimeoutSeconds: 60,
      extra: usdcEip712Domain(environmentName),
    },
  ];
}

export function mcpPaymentRiskResourceUrl(
  environmentName: PaymentEnvironmentName,
): string {
  return `mcp://israel-business-intelligence/assess_payment_risk/${environmentName}`;
}

export function mcpPaymentRiskRequirements(
  environmentName: PaymentEnvironmentName,
): PaymentRequirements[] {
  const environment = paymentEnvironments[environmentName];
  return [
    {
      scheme: "exact",
      network: environment.network as Network,
      amount: priceToAtomicUsdc(mcpPaymentRiskPrice(environmentName)),
      asset: environment.asset,
      payTo: environment.payTo,
      maxTimeoutSeconds: 60,
      extra: usdcEip712Domain(environmentName),
    },
  ];
}

export function mcpCompanyChangesResourceUrl(
  environmentName: PaymentEnvironmentName,
): string {
  return `mcp://israel-business-intelligence/company_changes/${environmentName}`;
}

export function mcpCompanyChangesRequirements(
  environmentName: PaymentEnvironmentName,
): PaymentRequirements[] {
  const environment = paymentEnvironments[environmentName];
  return [
    {
      scheme: "exact",
      network: environment.network as Network,
      amount: priceToAtomicUsdc(mcpCompanyChangesPrice(environmentName)),
      asset: environment.asset,
      payTo: environment.payTo,
      maxTimeoutSeconds: 60,
      extra: usdcEip712Domain(environmentName),
    },
  ];
}

function paidToolFromRequirements(
  environmentName: PaymentEnvironmentName,
  requirements: PaymentRequirements,
): string {
  if (
    requirements.amount ===
    priceToAtomicUsdc(mcpCompanyChangesPrice(environmentName))
  ) {
    return PAID_COMPANY_CHANGES_TOOL;
  }
  return requirements.amount ===
    priceToAtomicUsdc(mcpPaymentRiskPrice(environmentName))
    ? PAID_PAYMENT_RISK_TOOL
    : PAID_VERIFY_TOOL;
}

async function getResourceServer(
  environmentName: PaymentEnvironmentName,
): Promise<x402ResourceServer> {
  const existing = resourceServers.get(environmentName);
  if (existing) return existing;

  const created = (async () => {
    const environment = paymentEnvironments[environmentName];
    if (/^0x0{40}$/i.test(environment.payTo)) {
      throw new Error(
        `${environmentName} MCP payTo must be a real receiving wallet`,
      );
    }
    const facilitator = new HTTPFacilitatorClient({
      url: environment.facilitatorUrl,
    });
    const server = new x402ResourceServer(facilitator).register(
      "eip155:*",
      new ExactEvmScheme(),
    );
    server.onAfterVerify(async ({ result, paymentPayload, requirements }) => {
      const payer = payerFromPayment(paymentPayload as PaymentPayload);
      logMcpSettlement({
        event: result.isValid
          ? "mcp_payment_signature_valid"
          : "mcp_payment_signature_invalid",
        environment: environmentName,
        client_class:
          environmentName === "testnet" || isInternalMcpPayer(payer)
            ? "internal_test"
            : "external",
        payer: payer ?? null,
        network: requirements.network,
        asset: requirements.asset,
        amount: requirements.amount,
        tool: paidToolFromRequirements(environmentName, requirements),
        payment_stage: result.isValid ? "signature_valid" : "signature_invalid",
      });
    });
    server.onVerifyFailure(async ({ error, paymentPayload, requirements }) => {
      const payer = payerFromPayment(paymentPayload as PaymentPayload);
      logMcpSettlement({
        event: "mcp_payment_facilitator_failure",
        environment: environmentName,
        client_class:
          environmentName === "testnet" || isInternalMcpPayer(payer)
            ? "internal_test"
            : "external",
        payer: payer ?? null,
        network: requirements.network,
        asset: requirements.asset,
        amount: requirements.amount,
        tool: paidToolFromRequirements(environmentName, requirements),
        payment_stage: "verification_facilitator_failure",
        error_name: error.name,
      });
    });
    server.onSettleFailure(
      async ({ error, paymentPayload, requirements, phase }) => {
        const payer = payerFromPayment(paymentPayload as PaymentPayload);
        logMcpSettlement({
          event: "mcp_payment_facilitator_failure",
          environment: environmentName,
          client_class:
            environmentName === "testnet" || isInternalMcpPayer(payer)
              ? "internal_test"
              : "external",
          payer: payer ?? null,
          network: requirements.network,
          asset: requirements.asset,
          amount: requirements.amount,
          tool: paidToolFromRequirements(environmentName, requirements),
          payment_stage: "settlement_facilitator_failure",
          settlement_phase: phase,
          error_name: error.name,
        });
      },
    );
    return server;
  })();
  resourceServers.set(environmentName, created);
  return created;
}

function payerFromPayment(payment: PaymentPayload): string | undefined {
  const payload = payment.payload as { authorization?: { from?: unknown } };
  return typeof payload.authorization?.from === "string"
    ? payload.authorization.from
    : undefined;
}

function serviceDescription(
  environmentName: PaymentEnvironmentName,
  accessMode: "paid" | "pilot",
) {
  const environment = paymentEnvironments[environmentName];
  return {
    name: MCP_SERVER_NAME,
    description: DESCRIPTION,
    does: "Verifies an Israeli company and returns structured public-registry data with field-level evidence.",
    does_not:
      "It does not provide Full Regulatory KYB, legal advice, sanctions/PEP/UBO certification, credit advice, or a guarantee that a counterparty is safe.",
    verify_company:
      accessMode === "pilot"
        ? {
            price: "waived during the invitation-only pilot",
            endpoint: `${config.PUBLIC_BASE_URL}/mcp/pilot`,
            authentication: "Bearer token",
            pilot: pilotMetadata,
          }
        : {
            price: `${mcpPrice(environmentName).slice(1)} USDC`,
            network:
              environmentName === "mainnet" ? "Base Mainnet" : "Base Sepolia",
            network_id: environment.network,
            asset: "USDC",
            asset_contract: environment.asset,
            protocol: "x402 v2 over MCP",
            facilitator: environment.facilitatorUrl,
            endpoint: `${config.PUBLIC_BASE_URL}${mcpEndpointPath(environmentName)}`,
            buyer_quickstart: X402_BUYER_QUICKSTART_URL,
            buyer_bridge: X402_BUYER_BRIDGE_URL,
            preferred_tool: PAID_VERIFY_TOOL,
          },
    assess_payment_risk:
      accessMode === "pilot"
        ? undefined
        : {
            price: `${mcpPaymentRiskPrice(environmentName).slice(1)} USDC`,
            network:
              environmentName === "mainnet" ? "Base Mainnet" : "Base Sepolia",
            network_id: environment.network,
            asset: "USDC",
            protocol: "x402 v2 over MCP",
            tool: PAID_PAYMENT_RISK_TOOL,
            free_preview_tool: FREE_PAYMENT_RISK_PREVIEW_TOOL,
            purpose:
              "Triage an Israeli vendor immediately before payment using registry status, invoice identity consistency, contact-domain consistency, and buyer-observed risk signals.",
            decisions: ["PROCEED", "REVIEW", "BLOCK"],
            does_not_check: [
              "bank-account ownership",
              "invoice authenticity",
              "sanctions, PEP, or UBO status",
              "adverse media",
              "creditworthiness",
            ],
          },
    company_changes:
      accessMode === "pilot"
        ? undefined
        : {
            price: `${mcpCompanyChangesPrice(environmentName).slice(1)} USDC`,
            network:
              environmentName === "mainnet" ? "Base Mainnet" : "Base Sepolia",
            asset: "USDC",
            protocol: "x402 v2 over MCP",
            tool: PAID_COMPANY_CHANGES_TOOL,
            purpose:
              "Return recent official Israeli company filing and status-change events, newest first, with source evidence.",
            coverage:
              "Approximately one year, subject to the official source dataset.",
          },
    agent_payment_trust:
      accessMode === "pilot"
        ? undefined
        : {
            price: "free during the dry-run MVP",
            tool: AGENT_PAYMENT_TRUST_TOOL,
            endpoint: `${config.PUBLIC_BASE_URL}/v1/agent-payment-trust`,
            purpose:
              "Check an x402 payment before signing by binding an Israeli legal entity, service domain, signed Agent Payee Manifest, payment destination, resource origin, and buyer mandate.",
            decisions: ["ALLOW", "REVIEW", "DENY"],
            payment_side_effect: "none",
            assurance_levels: [
              "LEVEL_0_UNVERIFIED",
              "LEVEL_1_SIGNED",
              "LEVEL_2_REGISTRY",
            ],
            limitation:
              "Level 1 or 2 does not prove legal ownership of the recipient wallet.",
          },
    preview_company:
      accessMode === "pilot"
        ? undefined
        : {
            price: "free",
            purpose:
              "Resolve basic identity and registry status, then return an exact machine-readable next action for the paid verification.",
            excludes: [
              "field-level evidence",
              "source URLs",
              "registered address",
              "incorporation and annual-report fields",
              "law-violation fields",
            ],
            preferred_tool: FREE_PREVIEW_TOOL,
          },
    sample_report: {
      tool: SAMPLE_REPORT_TOOL,
      price: "free",
      live_lookup: false,
      purpose:
        "Inspect the complete paid response shape before connecting a wallet.",
    },
    evidence_scope: [
      "Israeli company identity and status from official public registry data",
      "Field-level source, source URL, retrieval time, and confidence when available",
      "Invoice-to-registry identity consistency and buyer-supplied payment context",
    ],
    limitations: LIMITATIONS,
  };
}

function textAndStructured(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function verificationOffer(
  environmentName: PaymentEnvironmentName,
  recommendedArguments: Record<string, unknown> = {},
) {
  const environment = paymentEnvironments[environmentName];
  return {
    tool: "verify_company" as const,
    price: mcpPrice(environmentName),
    network: environment.network,
    asset: "USDC" as const,
    protocol: "x402 v2 over MCP" as const,
    buyer_quickstart: X402_BUYER_QUICKSTART_URL,
    buyer_bridge: X402_BUYER_BRIDGE_URL,
    preferred_tool: PAID_VERIFY_TOOL,
    recommended_arguments: recommendedArguments,
    unlocks: [
      "complete registered entity fields",
      "field-level evidence and source URLs",
      "missing-data disclosure",
      "auditable checked_at timestamp",
    ],
  };
}

async function runCompanyPreview(
  environmentName: PaymentEnvironmentName,
  args: z.infer<typeof previewCompanyQuerySchema>,
) {
  const result = await counterpartyOrchestrator.verify({
    ...args,
    depth: "standard",
  });
  const resolved =
    result.resolution_status === "RESOLVED" ? result.resolved_entity : null;
  const recommendedArguments = resolved
    ? {
        company_number: resolved.company_number,
        language: args.language,
        depth: "standard",
      }
    : {};
  const shouldBuy = Boolean(resolved);
  const paidActions = resolved
    ? [
        {
          preferred_tool: PAID_COMPANY_CHANGES_TOOL,
          purpose:
            "Get recent official filing and status-change events for repeatable monitoring.",
          price: mcpCompanyChangesPrice(environmentName),
          network: paymentEnvironments[environmentName].network,
          asset: "USDC" as const,
          recommended_arguments: {
            company_number: resolved.company_number,
            lookback_days: 366,
            limit: 25,
            language: args.language,
          },
        },
        {
          preferred_tool: PAID_VERIFY_TOOL,
          purpose:
            "Get the complete field-level company-registry evidence report.",
          price: mcpPrice(environmentName),
          network: paymentEnvironments[environmentName].network,
          asset: "USDC" as const,
          recommended_arguments: recommendedArguments,
        },
      ]
    : [];
  const nextAction = shouldBuy
    ? {
        recommended: true,
        tool: "verify_company" as const,
        preferred_tool: PAID_VERIFY_TOOL,
        arguments: recommendedArguments,
        reason:
          "Identity is resolved. Call verify_company with these exact arguments to unlock field-level public-registry evidence and source URLs.",
        requires_payment: true,
        price: mcpPrice(environmentName),
        network: paymentEnvironments[environmentName].network,
        asset: "USDC" as const,
        buyer_quickstart: X402_BUYER_QUICKSTART_URL,
        buyer_bridge: X402_BUYER_BRIDGE_URL,
      }
    : {
        recommended: false,
        tool: "preview_company" as const,
        preferred_tool: FREE_PREVIEW_TOOL,
        arguments: {},
        reason:
          result.resolution_status === "AMBIGUOUS"
            ? "Choose a candidate company_number and call preview_company again before buying a full verification."
            : "No reliable company match was found. Add a company number or more identifying context before buying a full verification.",
        requires_payment: false,
        price: null,
        network: null,
        asset: null,
        buyer_quickstart: X402_BUYER_QUICKSTART_URL,
        buyer_bridge: X402_BUYER_BRIDGE_URL,
      };

  return {
    request_id: randomUUID(),
    preview_version: "1.2.0",
    mode: "free_preview" as const,
    resolution_status: result.resolution_status,
    company: resolved
      ? {
          legal_name: resolved.legal_name,
          company_number: resolved.company_number,
          status: resolved.status,
        }
      : null,
    candidates: result.candidates.slice(0, 3).map((candidate) => ({
      legal_name: candidate.legal_name,
      company_number: candidate.company_number,
      status: candidate.status,
      confidence: candidate.confidence,
    })),
    confidence: result.confidence,
    checked_at: result.checked_at,
    preview_limitations: [
      "No field-level evidence is included",
      "No source URLs, address, incorporation, annual-report, or law-violation fields are included",
      "Use verify_company for the complete evidence-backed result",
    ],
    full_verification: verificationOffer(environmentName, recommendedArguments),
    paid_actions: paidActions,
    next_action: nextAction,
  };
}

function paymentRiskIdentity(args: PaymentRiskQuery) {
  return {
    company_number: args.company_number ?? args.invoice_company_number,
    company_name: args.company_name ?? args.invoice_company_name,
    website: args.invoice_website,
    city: args.invoice_city,
    language: args.language,
    depth: "standard" as const,
  };
}

async function runPaymentRiskPreview(
  environmentName: PaymentEnvironmentName,
  args: PaymentRiskQuery,
) {
  const result = await counterpartyOrchestrator.verify(
    paymentRiskIdentity(args),
  );
  const resolved =
    result.resolution_status === "RESOLVED" ? result.resolved_entity : null;
  const recommendedArguments = resolved
    ? { ...args, company_number: resolved.company_number }
    : { ...args };
  const suppliedSignalTypes = [
    args.invoice_company_number && "invoice_company_number",
    args.invoice_company_name && "invoice_company_name",
    args.invoice_city && "invoice_city",
    args.invoice_website && "invoice_website",
    args.vendor_email && "vendor_email",
    args.payment_details_changed && "payment_details_changed",
    args.urgent_payment_request && "urgent_payment_request",
    args.first_time_vendor && "first_time_vendor",
  ].filter((value): value is string => Boolean(value));

  return {
    request_id: randomUUID(),
    preview_version: "1.0.0",
    mode: "free_payment_risk_preview" as const,
    resolution_status: result.resolution_status,
    company: resolved
      ? {
          legal_name: resolved.legal_name,
          company_number: resolved.company_number,
          status: resolved.status,
        }
      : null,
    supplied_signal_types: suppliedSignalTypes,
    paid_assessment: {
      preferred_tool: PAID_PAYMENT_RISK_TOOL,
      price: mcpPaymentRiskPrice(environmentName),
      network: paymentEnvironments[environmentName].network,
      asset: "USDC" as const,
      recommended_arguments: recommendedArguments,
      returns: [
        "PROCEED, REVIEW, or BLOCK decision",
        "deterministic score and reason codes",
        "invoice-to-registry consistency checks",
        "field-level evidence and explicit checks not performed",
      ],
    },
    preview_limitations: [
      "No risk decision, score, reason codes, or mismatch findings are returned for free",
      "No bank-account ownership, invoice-authenticity, sanctions, PEP, UBO, adverse-media, or credit check is performed",
    ],
    checked_at: result.checked_at,
  };
}

function settlementTelemetry(
  environmentName: PaymentEnvironmentName,
  settlement: SettleResponse,
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements,
  tool: string,
  expectedPrice: string,
  expectedResource: string,
): void {
  const environment = paymentEnvironments[environmentName];
  const payer = settlement.payer ?? payerFromPayment(paymentPayload);
  const internal = environmentName === "testnet" || isInternalMcpPayer(payer);
  const resource = paymentPayload.resource?.url ?? expectedResource;

  logMcpSettlement({
    event: "mcp_settlement",
    environment: environmentName,
    client_class: internal ? "internal_test" : "external",
    success: settlement.success,
    network: settlement.network,
    asset: requirements.asset,
    amount: settlement.amount ?? requirements.amount,
    payer: payer ?? null,
    pay_to: requirements.payTo,
    tx_hash: settlement.transaction,
    resource,
    payment_stage: settlement.success
      ? "settlement_success"
      : "settlement_failure",
    tool,
  });

  if (environmentName !== "mainnet" || internal) return;
  const external = createExternalPaidCallEvent({
    success: settlement.success,
    network: settlement.network,
    asset: requirements.asset,
    amount: settlement.amount ?? requirements.amount,
    payTo: requirements.payTo,
    payer,
    transaction: settlement.transaction,
    resource,
    expectedNetwork: environment.network,
    expectedAsset: environment.asset,
    expectedAmount: priceToAtomicUsdc(expectedPrice),
    expectedPayTo: environment.payTo,
    expectedResource,
    internalPayers: [
      config.INTERNAL_TEST_PAYER,
      config.MAINNET_INTERNAL_TEST_PAYER,
    ],
  });
  if (!external) return;
  logMcpSettlement({
    ...external,
    event: "mcp_external_paid_call",
    milestone: "external_paid_call",
    transport: "mcp",
    tool,
  });
}

export async function createIsraelMcpServer(
  environmentName: PaymentEnvironmentName,
  options: { accessMode?: "paid" | "pilot" } = {},
): Promise<McpServer> {
  const accessMode = options.accessMode ?? "paid";
  const environment = paymentEnvironments[environmentName];
  const requirements = mcpPaymentRequirements(environmentName);
  const paymentRiskRequirements = mcpPaymentRiskRequirements(environmentName);
  const companyChangesRequirements =
    mcpCompanyChangesRequirements(environmentName);
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { instructions: serverInstructions(accessMode) },
  );

  server.registerTool(
    "describe_service",
    {
      title: "Describe Israel Business Intelligence",
      description:
        "Free: inspect Israel company-verification capabilities, exact paid/free boundaries, public-registry evidence scope, pricing, and limitations.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () =>
      textAndStructured(serviceDescription(environmentName, accessMode)),
  );

  server.registerTool(
    "get_schema",
    {
      title: "Get verify_company schema",
      description:
        "Free: get distinct machine-readable schemas for the limited preview_company tool and paid verify_company evidence result.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () =>
      textAndStructured({
        tool: "verify_company",
        tools: [
          "verify_company",
          PAID_PAYMENT_RISK_TOOL,
          PAID_COMPANY_CHANGES_TOOL,
          AGENT_PAYMENT_TRUST_TOOL,
        ],
        preview_company: {
          input_schema: z.toJSONSchema(previewCompanyQuerySchema),
          output_schema: z.toJSONSchema(previewCompanyOutputSchema),
        },
        verify_company: {
          input_schema: verifyInputJsonSchema,
          output_schema: verifyOutputJsonSchema,
        },
        payment_risk: {
          preview_tool: FREE_PAYMENT_RISK_PREVIEW_TOOL,
          paid_tool: PAID_PAYMENT_RISK_TOOL,
          input_schema: paymentRiskInputJsonSchema,
          preview_output_schema: z.toJSONSchema(paymentRiskPreviewOutputSchema),
          paid_output_schema: paymentRiskOutputJsonSchema,
        },
        company_changes: {
          paid_tool: PAID_COMPANY_CHANGES_TOOL,
          input_schema: companyChangesInputJsonSchema,
          paid_output_schema: companyChangesOutputJsonSchema,
          price: mcpCompanyChangesPrice(environmentName),
        },
        agent_payment_trust: {
          tool: AGENT_PAYMENT_TRUST_TOOL,
          mode: "free_dry_run",
          rest_endpoint: `${config.PUBLIC_BASE_URL}/v1/agent-payment-trust`,
          input_schema: agentPaymentTrustInputJsonSchema,
          output_schema: agentPaymentTrustOutputJsonSchema,
        },
        aliases: {
          free_preview: FREE_PREVIEW_TOOL,
          paid_verification: PAID_VERIFY_TOOL,
          sample_report: SAMPLE_REPORT_TOOL,
          free_payment_risk_preview: FREE_PAYMENT_RISK_PREVIEW_TOOL,
          paid_payment_risk_assessment: PAID_PAYMENT_RISK_TOOL,
          paid_company_changes: PAID_COMPANY_CHANGES_TOOL,
          pre_sign_payment_firewall: AGENT_PAYMENT_TRUST_TOOL,
        },
      }),
  );

  server.registerTool(
    SAMPLE_REPORT_TOOL,
    {
      title: "Get a complete Israeli company verification sample - free",
      description:
        "FREE STATIC SAMPLE: inspect a representative complete verification report with resolved company fields, field-level evidence, source URLs, confidence, missing-data disclosure, and checked_at. This does not perform a live lookup and never charges a wallet.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () =>
      textAndStructured({
        sample: true,
        live_lookup: false,
        payment_required: false,
        notice:
          "Illustrative historical snapshot for evaluating the response contract. Call the paid verification tool for current registry data.",
        report: verifyExample,
        next_action: {
          tool: FREE_PREVIEW_TOOL,
          reason:
            "Run a free live identity/status preview before deciding whether to buy.",
        },
      }),
  );

  if (accessMode === "pilot") {
    server.registerTool(
      "verify_company",
      {
        title: "Verify Israeli company - partner pilot",
        description: `${DESCRIPTION} Payment is waived for this invitation-only pilot.`,
        inputSchema: counterpartyQuerySchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      async (args) => {
        try {
          const result = await runPilotVerification(args);
          return textAndStructured({ request_id: randomUUID(), ...result });
        } catch (error) {
          const normalized =
            error instanceof ApiError
              ? error
              : new ApiError(
                  500,
                  "INTERNAL_ERROR",
                  "An unexpected error occurred",
                );
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: { code: normalized.code, message: normalized.message },
                }),
              },
            ],
            isError: true,
          };
        }
      },
    );
    return server;
  }

  server.registerTool(
    AGENT_PAYMENT_TRUST_TOOL,
    {
      title: "Check an x402 payment before signing - free dry-run",
      description:
        "FREE AGENT PAYMENT FIREWALL: before an AI agent signs an x402 payment, bind the Israeli company identity, service origin, signed domain payee manifest, destination wallet, payment fingerprint, and buyer mandate into an ALLOW, REVIEW, or DENY decision. This dry-run never signs or submits a payment and does not claim legal wallet ownership.",
      inputSchema: agentPaymentTrustQuerySchema,
      outputSchema: agentPaymentTrustOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      try {
        return textAndStructured(
          await counterpartyOrchestrator.agentPaymentTrust(args),
        );
      } catch (error) {
        const normalized =
          error instanceof ApiError
            ? error
            : new ApiError(
                500,
                "INTERNAL_ERROR",
                "An unexpected error occurred",
              );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: { code: normalized.code, message: normalized.message },
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    FREE_PAYMENT_RISK_PREVIEW_TOOL,
    {
      title: "Preview an Israeli vendor payment-risk assessment - free",
      description:
        "FREE PREVIEW before paying an Israeli supplier. Confirms whether the company can be resolved and shows which invoice and payment-context signals will be evaluated. It does not reveal a risk score, mismatch findings, or decision. Use assess_israeli_vendor_payment_risk_paid for the evidence-backed PROCEED, REVIEW, or BLOCK result.",
      inputSchema: paymentRiskQuerySchema,
      outputSchema: paymentRiskPreviewOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      try {
        return textAndStructured(
          await runPaymentRiskPreview(environmentName, args),
        );
      } catch (error) {
        const normalized =
          error instanceof ApiError
            ? error
            : new ApiError(
                500,
                "INTERNAL_ERROR",
                "An unexpected error occurred",
              );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: { code: normalized.code, message: normalized.message },
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "preview_company",
    {
      title: "Preview Israeli company identity - free and limited",
      description:
        "FREE LIMITED PREVIEW for an Israeli company legal name or company number. Returns only identity, registry status, match candidates, confidence, and an exact next action. It never returns field-level evidence, source URLs, address, incorporation, annual-report, or law-violation fields. Use the paid verify_company tool for the complete evidence-backed public-registry result.",
      inputSchema: previewCompanyQuerySchema,
      outputSchema: previewCompanyOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      try {
        return textAndStructured(
          await runCompanyPreview(environmentName, args),
        );
      } catch (error) {
        const normalized =
          error instanceof ApiError
            ? error
            : new ApiError(
                500,
                "INTERNAL_ERROR",
                "An unexpected error occurred",
              );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: { code: normalized.code, message: normalized.message },
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    FREE_PREVIEW_TOOL,
    {
      title: "Preview an Israeli company for free",
      description:
        "RECOMMENDED FREE FIRST STEP for Israel company verification, Israeli supplier checks, counterparty due diligence, or public-registry KYB evidence. Resolves legal identity and registry status without payment, then returns exact reusable arguments for the paid full report. No field-level evidence or source URLs are included.",
      inputSchema: previewCompanyQuerySchema,
      outputSchema: previewCompanyOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      try {
        return textAndStructured(
          await runCompanyPreview(environmentName, args),
        );
      } catch (error) {
        const normalized =
          error instanceof ApiError
            ? error
            : new ApiError(
                500,
                "INTERNAL_ERROR",
                "An unexpected error occurred",
              );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: { code: normalized.code, message: normalized.message },
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  if (!environment.enabled) {
    const verifyWithoutPayment = async (
      args: z.infer<typeof counterpartyQuerySchema>,
    ) => {
      const result = await counterpartyOrchestrator.verify(args);
      return textAndStructured({ request_id: randomUUID(), ...result });
    };
    server.registerTool(
      "verify_company",
      {
        title: "Verify Israeli company",
        description: `${DESCRIPTION} Payment is disabled in this environment.`,
        inputSchema: counterpartyQuerySchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      verifyWithoutPayment,
    );
    server.registerTool(
      PAID_VERIFY_TOOL,
      {
        title: "Verify an Israeli company - full report",
        description: `${DESCRIPTION} Payment is disabled in this environment.`,
        inputSchema: counterpartyQuerySchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      verifyWithoutPayment,
    );
    server.registerTool(
      PAID_PAYMENT_RISK_TOOL,
      {
        title: "Assess Israeli vendor payment risk",
        description:
          "Registry-backed pre-payment triage with invoice consistency checks and a PROCEED, REVIEW, or BLOCK result. Payment is disabled in this environment.",
        inputSchema: paymentRiskQuerySchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      async (args) => {
        const result = await counterpartyOrchestrator.paymentRisk(args);
        return textAndStructured({ request_id: randomUUID(), ...result });
      },
    );
    server.registerTool(
      PAID_COMPANY_CHANGES_TOOL,
      {
        title: "Get recent Israeli company changes",
        description:
          "Recent official Israeli company filing and status-change events with source evidence. Payment is disabled in this environment.",
        inputSchema: companyChangesQuerySchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      async (args) => {
        const result = await counterpartyOrchestrator.companyChanges(args);
        return textAndStructured({ request_id: randomUUID(), ...result });
      },
    );
    return server;
  }

  const resourceServer = await getResourceServer(environmentName);
  const paid = createPaymentWrapper(resourceServer, {
    accepts: requirements,
    resource: {
      url: mcpToolResourceUrl(environmentName),
      description: `${DESCRIPTION} Buyer quickstart: ${X402_BUYER_QUICKSTART_URL}`,
      mimeType: "application/json",
      serviceName: MCP_SERVER_NAME,
      tags: [
        "israel-company-verification",
        "israeli-company-registry",
        "israeli-supplier-verification",
        "public-registry-kyb",
        "x402",
      ],
    },
    extensions: declareDiscoveryExtension({
      toolName: "verify_company",
      description: DESCRIPTION,
      transport: "streamable-http",
      inputSchema: x402DiscoverySchema(verifyInputJsonSchema),
      example: { company_number: "514744887", language: "en" },
      output: {
        example: verifyExample,
        schema: x402DiscoverySchema(verifyOutputJsonSchema),
      },
    }),
    hooks: {
      onAfterSettlement: async ({
        settlement,
        paymentPayload,
        paymentRequirements,
      }) => {
        settlementTelemetry(
          environmentName,
          settlement,
          paymentPayload,
          paymentRequirements,
          PAID_VERIFY_TOOL,
          mcpPrice(environmentName),
          mcpToolResourceUrl(environmentName),
        );
      },
    },
  });

  const paidPaymentRisk = createPaymentWrapper(resourceServer, {
    accepts: paymentRiskRequirements,
    resource: {
      url: mcpPaymentRiskResourceUrl(environmentName),
      description:
        "Pre-payment triage for an Israeli vendor using public-registry evidence, invoice identity consistency, contact-domain consistency, and buyer-observed risk signals. Does not verify bank-account ownership or provide AML certification.",
      mimeType: "application/json",
      serviceName: MCP_SERVER_NAME,
      tags: [
        "israeli-vendor-payment-risk",
        "invoice-risk",
        "supplier-onboarding",
        "payment-fraud-triage",
        "x402",
      ],
    },
    extensions: declareDiscoveryExtension({
      toolName: PAID_PAYMENT_RISK_TOOL,
      description:
        "Assess an Israeli vendor immediately before payment and return a deterministic PROCEED, REVIEW, or BLOCK decision with evidence and reason codes.",
      transport: "streamable-http",
      inputSchema: x402DiscoverySchema(paymentRiskInputJsonSchema),
      example: {
        company_number: "514744887",
        invoice_company_number: "514744887",
        invoice_company_name: "מנדיי. קום בעמ",
        language: "en",
      },
      output: {
        example: paymentRiskExample,
        schema: x402DiscoverySchema(paymentRiskOutputJsonSchema),
      },
    }),
    hooks: {
      onAfterSettlement: async ({
        settlement,
        paymentPayload,
        paymentRequirements,
      }) => {
        settlementTelemetry(
          environmentName,
          settlement,
          paymentPayload,
          paymentRequirements,
          PAID_PAYMENT_RISK_TOOL,
          mcpPaymentRiskPrice(environmentName),
          mcpPaymentRiskResourceUrl(environmentName),
        );
      },
    },
  });

  const paidCompanyChanges = createPaymentWrapper(resourceServer, {
    accepts: companyChangesRequirements,
    resource: {
      url: mcpCompanyChangesResourceUrl(environmentName),
      description:
        "Recent official Israeli company filing and status-change events, sorted newest first with source evidence. Categories are navigation labels, not risk conclusions.",
      mimeType: "application/json",
      serviceName: MCP_SERVER_NAME,
      tags: [
        "israeli-company-changes",
        "corporate-events",
        "company-monitoring",
        "israeli-company-registry",
        "x402",
      ],
    },
    extensions: declareDiscoveryExtension({
      toolName: PAID_COMPANY_CHANGES_TOOL,
      description:
        "Get recent official Israeli company filing and status-change events for an exact company number.",
      transport: "streamable-http",
      inputSchema: x402DiscoverySchema(companyChangesInputJsonSchema),
      example: {
        company_number: "514744887",
        lookback_days: 366,
        limit: 25,
        language: "en",
      },
      output: {
        example: companyChangesExample,
        schema: x402DiscoverySchema(companyChangesOutputJsonSchema),
      },
    }),
    hooks: {
      onAfterSettlement: async ({
        settlement,
        paymentPayload,
        paymentRequirements,
      }) => {
        settlementTelemetry(
          environmentName,
          settlement,
          paymentPayload,
          paymentRequirements,
          PAID_COMPANY_CHANGES_TOOL,
          mcpCompanyChangesPrice(environmentName),
          mcpCompanyChangesResourceUrl(environmentName),
        );
      },
    },
  });

  const verifyCompany = async (
    args: z.infer<typeof counterpartyQuerySchema>,
  ) => {
    try {
      const result = await counterpartyOrchestrator.verify(args);
      return textAndStructured({ request_id: randomUUID(), ...result });
    } catch (error) {
      const normalized =
        error instanceof ApiError
          ? error
          : new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: { code: normalized.code, message: normalized.message },
            }),
          },
        ],
        isError: true,
      };
    }
  };
  const paidVerifyCompany = paid(verifyCompany);
  const paymentRisk = async (args: PaymentRiskQuery) => {
    try {
      const result = await counterpartyOrchestrator.paymentRisk(args);
      return textAndStructured({ request_id: randomUUID(), ...result });
    } catch (error) {
      const normalized =
        error instanceof ApiError
          ? error
          : new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: { code: normalized.code, message: normalized.message },
            }),
          },
        ],
        isError: true,
      };
    }
  };
  const paidAssessPaymentRisk = paidPaymentRisk(paymentRisk);
  const getCompanyChanges = async (args: CompanyChangesQuery) => {
    try {
      const result = await counterpartyOrchestrator.companyChanges(args);
      return textAndStructured({ request_id: randomUUID(), ...result });
    } catch (error) {
      const normalized =
        error instanceof ApiError
          ? error
          : new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: { code: normalized.code, message: normalized.message },
            }),
          },
        ],
        isError: true,
      };
    }
  };
  const paidGetCompanyChanges = paidCompanyChanges(getCompanyChanges);
  const paidToolMeta = {
    "x402/pricing": {
      x402Version: 2,
      price: mcpPrice(environmentName),
      asset: environment.asset,
      network: environment.network,
      payTo: environment.payTo,
      facilitator: environment.facilitatorUrl,
      buyerQuickstart: X402_BUYER_QUICKSTART_URL,
      buyerBridge: X402_BUYER_BRIDGE_URL,
    },
  };
  const paymentRiskToolMeta = {
    "x402/pricing": {
      x402Version: 2,
      price: mcpPaymentRiskPrice(environmentName),
      asset: environment.asset,
      network: environment.network,
      payTo: environment.payTo,
      facilitator: environment.facilitatorUrl,
      buyerQuickstart: X402_BUYER_QUICKSTART_URL,
    },
  };
  const companyChangesToolMeta = {
    "x402/pricing": {
      x402Version: 2,
      price: mcpCompanyChangesPrice(environmentName),
      asset: environment.asset,
      network: environment.network,
      payTo: environment.payTo,
      facilitator: environment.facilitatorUrl,
      buyerQuickstart: X402_BUYER_QUICKSTART_URL,
    },
  };

  server.registerTool(
    "verify_company",
    {
      title: "Verify Israeli company - paid full public-registry evidence",
      description: `${DESCRIPTION} PAID FULL RESULT: ${mcpPrice(environmentName)} USDC per successful call on ${environmentName === "mainnet" ? "Base Mainnet" : "Base Sepolia"}. Use ${FREE_PREVIEW_TOOL} first when only a free identity/status check is needed. One-command buyer bridge: ${X402_BUYER_BRIDGE_URL}`,
      inputSchema: counterpartyQuerySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
      _meta: paidToolMeta,
    },
    paidVerifyCompany,
  );

  server.registerTool(
    PAID_VERIFY_TOOL,
    {
      title: "Verify an Israeli company - paid complete report",
      description: `RECOMMENDED PAID NEXT STEP after ${FREE_PREVIEW_TOOL}. Verifies an Israeli company number or legal name and returns the complete field-level Israeli Companies Registry evidence report with source URLs, confidence, missing-data disclosure, and checked_at. Costs ${mcpPrice(environmentName)} USDC on ${environmentName === "mainnet" ? "Base Mainnet" : "Base Sepolia"}. Not Full Regulatory KYB. One-command buyer bridge: ${X402_BUYER_BRIDGE_URL}`,
      inputSchema: counterpartyQuerySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
      _meta: paidToolMeta,
    },
    paidVerifyCompany,
  );

  server.registerTool(
    PAID_PAYMENT_RISK_TOOL,
    {
      title: "Assess an Israeli vendor before payment - paid",
      description: `RECOMMENDED immediately before an agent pays an Israeli supplier. Resolves the legal entity, compares invoice identity and contact domains, evaluates buyer-observed payment-change and urgency signals, then returns an evidence-backed PROCEED, REVIEW, or BLOCK decision with deterministic reason codes. Costs ${mcpPaymentRiskPrice(environmentName)} USDC on ${environmentName === "mainnet" ? "Base Mainnet" : "Base Sepolia"}. It does not verify bank-account ownership, invoice authenticity, sanctions, PEPs, UBOs, adverse media, or creditworthiness. Use ${FREE_PAYMENT_RISK_PREVIEW_TOOL} first.`,
      inputSchema: paymentRiskQuerySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
      _meta: paymentRiskToolMeta,
    },
    paidAssessPaymentRisk,
  );

  server.registerTool(
    PAID_COMPANY_CHANGES_TOOL,
    {
      title: "Get recent Israeli company changes - paid",
      description: `LOW-COST REPEATABLE MONITORING LOOKUP for an exact Israeli company number. Returns recent official filing and status-change events, newest first, with source URLs and deterministic categories. Costs ${mcpCompanyChangesPrice(environmentName)} USDC on ${environmentName === "mainnet" ? "Base Mainnet" : "Base Sepolia"}. Coverage is approximately one year and an empty result is not proof that no earlier change occurred.`,
      inputSchema: companyChangesQuerySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
      _meta: companyChangesToolMeta,
    },
    paidGetCompanyChanges,
  );

  return server;
}
