import { createHash } from "node:crypto";

import type { NextRequest } from "next/server";

import {
  config,
  paymentEnvironments,
  type PaymentEnvironmentName,
} from "@/lib/config";

type JsonRpcEnvelope = {
  method?: unknown;
  params?: {
    name?: unknown;
    _meta?: Record<string, unknown>;
  };
};

type PaymentPayloadLike = {
  payload?: { authorization?: { from?: unknown } };
};

type JsonRpcResponse = {
  result?: {
    isError?: unknown;
    structuredContent?: Record<string, unknown>;
    _meta?: Record<string, unknown>;
  };
};

const PREVIEW_TOOLS = new Set([
  "preview_company",
  "preview_israeli_company_free",
  "preview_israeli_vendor_payment_risk_free",
  "preview_agent_payment_trust",
]);
const VERIFY_TOOLS = new Set([
  "verify_company",
  "verify_israeli_company_paid",
  "assess_israeli_vendor_payment_risk_paid",
]);

function fingerprint(request: NextRequest): string {
  const forwarded =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  return createHash("sha256")
    .update(`${forwarded}|${agent}`)
    .digest("hex")
    .slice(0, 16);
}

function payerFromPayment(payment: unknown): string | undefined {
  if (!payment || typeof payment !== "object") return undefined;
  const payer = (payment as PaymentPayloadLike).payload?.authorization?.from;
  return typeof payer === "string" ? payer : undefined;
}

export function isInternalMcpPayer(payer?: string): boolean {
  if (!payer) return false;
  return [config.INTERNAL_TEST_PAYER, config.MAINNET_INTERNAL_TEST_PAYER].some(
    (address) => address && address.toLowerCase() === payer.toLowerCase(),
  );
}

function cleanDiscoverySource(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9._:/-]/g, "");
  return cleaned || null;
}

function isInternalDiscoverySource(value: string | null): boolean {
  return [
    "internal-mcp-smoke",
    "internal-mcp-paid-smoke",
    "internal-conversion-audit",
    "internal-post-deploy-smoke",
  ].includes(value ?? "");
}

function isInternalRequest(
  request: NextRequest,
  environmentName: PaymentEnvironmentName,
  payer?: string,
): boolean {
  const internalToken = request.headers.get("x-internal-test-token");
  const discoverySource = cleanDiscoverySource(
    request.headers.get("x-discovery-source"),
  );
  return (
    environmentName === "testnet" ||
    (Boolean(config.INTERNAL_TEST_TOKEN) &&
      internalToken === config.INTERNAL_TEST_TOKEN) ||
    isInternalMcpPayer(payer) ||
    isInternalDiscoverySource(discoverySource)
  );
}

export function logMcpRequest(
  request: NextRequest,
  body: unknown,
  environmentName: PaymentEnvironmentName,
  context?: { clientClass: "pilot"; partnerId: string },
): void {
  if (!body || typeof body !== "object" || Array.isArray(body)) return;
  const message = body as JsonRpcEnvelope;
  const method =
    typeof message.method === "string" ? message.method : undefined;
  const toolName =
    typeof message.params?.name === "string" ? message.params.name : undefined;
  const payment = message.params?._meta?.["x402/payment"];
  const payer = payerFromPayment(payment);
  const discoverySource = cleanDiscoverySource(
    request.headers.get("x-discovery-source"),
  );
  const internal = isInternalRequest(request, environmentName, payer);

  let event: string | undefined;
  if (method === "initialize") event = "mcp_initialize";
  if (method === "tools/list") event = "mcp_tools_list";
  if (method === "tools/call" && toolName && PREVIEW_TOOLS.has(toolName)) {
    event = "mcp_preview_called";
  }
  if (method === "tools/call" && toolName && VERIFY_TOOLS.has(toolName)) {
    event = context
      ? "mcp_pilot_verify"
      : payment
        ? "mcp_payment_attempt"
        : "mcp_verify_unpaid";
  }
  if (!event) return;

  console.info(
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      environment: environmentName,
      network: paymentEnvironments[environmentName].network,
      tool: toolName ?? null,
      payer: payer ?? null,
      client_class:
        context?.clientClass ?? (internal ? "internal_test" : "external"),
      partner_id: context?.partnerId ?? null,
      external_client_fingerprint: fingerprint(request),
      discovery_source: discoverySource,
      telemetry_version: "1.4",
    }),
  );
}

function paymentRequiredError(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    (candidate.x402Version !== 1 && candidate.x402Version !== 2) ||
    !Array.isArray(candidate.accepts)
  ) {
    return null;
  }
  return typeof candidate.error === "string"
    ? candidate.error
    : "Payment required";
}

export function logMcpResponse(
  request: NextRequest,
  requestBody: unknown,
  responseBody: unknown,
  environmentName: PaymentEnvironmentName,
): void {
  if (
    !requestBody ||
    typeof requestBody !== "object" ||
    Array.isArray(requestBody)
  )
    return;
  if (
    !responseBody ||
    typeof responseBody !== "object" ||
    Array.isArray(responseBody)
  )
    return;

  const requestMessage = requestBody as JsonRpcEnvelope;
  if (requestMessage.method !== "tools/call") {
    return;
  }

  const payment = requestMessage.params?._meta?.["x402/payment"];
  const payer = payerFromPayment(payment);
  const response = responseBody as JsonRpcResponse;
  const result = response.result;
  const requiredError = paymentRequiredError(result?.structuredContent);
  const internal = isInternalRequest(request, environmentName, payer);
  const toolName = requestMessage.params?.name;
  const base = {
    timestamp: new Date().toISOString(),
    environment: environmentName,
    network: paymentEnvironments[environmentName].network,
    transport: "mcp",
    tool: toolName ?? null,
    payer: payer ?? null,
    client_class: internal ? "internal_test" : "external",
    external_client_fingerprint: fingerprint(request),
    discovery_source: cleanDiscoverySource(
      request.headers.get("x-discovery-source"),
    ),
    telemetry_version: "1.4",
  };

  if (typeof toolName === "string" && PREVIEW_TOOLS.has(toolName)) {
    const structured = result?.structuredContent;
    console.info(
      JSON.stringify({
        ...base,
        event:
          result?.isError === true
            ? "mcp_preview_failed"
            : "mcp_preview_delivered",
        resolution_status:
          typeof structured?.resolution_status === "string"
            ? structured.resolution_status
            : null,
        next_action_tool:
          structured?.next_action && typeof structured.next_action === "object"
            ? ((structured.next_action as Record<string, unknown>).tool ?? null)
            : null,
        conversion_recommended:
          structured?.next_action && typeof structured.next_action === "object"
            ? ((structured.next_action as Record<string, unknown>)
                .recommended ?? null)
            : null,
        payment_trust_action:
          structured?.decision && typeof structured.decision === "object"
            ? ((structured.decision as Record<string, unknown>).action ?? null)
            : null,
        assurance_level:
          structured?.decision && typeof structured.decision === "object"
            ? ((structured.decision as Record<string, unknown>)
                .assurance_level ?? null)
            : null,
      }),
    );
    return;
  }

  if (typeof toolName !== "string" || !VERIFY_TOOLS.has(toolName)) return;

  if (requiredError) {
    const settlementFailure = requiredError
      .toLowerCase()
      .includes("settlement failed");
    console.info(
      JSON.stringify({
        ...base,
        event: payment
          ? settlementFailure
            ? "mcp_payment_facilitator_failure"
            : "mcp_payment_required_redelivered"
          : "mcp_payment_required_delivered",
        payment_stage: payment
          ? settlementFailure
            ? "facilitator_failure"
            : "signature_invalid"
          : "payment_required",
        payment_signature_status: payment
          ? settlementFailure
            ? "valid"
            : "invalid"
          : "missing",
      }),
    );
    return;
  }

  const paymentResponse = result?._meta?.["x402/payment-response"];
  if (payment && paymentResponse && result?.isError !== true) {
    console.info(
      JSON.stringify({
        ...base,
        event: "mcp_successful_paid_response",
        payment_stage: "successful_paid_response",
        payment_signature_status: "valid",
      }),
    );
  }
}

export function logMcpSettlement(event: Record<string, unknown>): void {
  console.info(
    JSON.stringify({ timestamp: new Date().toISOString(), ...event }),
  );
}
