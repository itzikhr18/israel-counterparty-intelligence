import { createHash } from "node:crypto";

import { encodePaymentRequiredHeader } from "@x402/core/http";
import { x402ResourceServer } from "@x402/core/server";
import type {
  HTTPRequestContext,
  HTTPTransportContext,
} from "@x402/core/server";
import type { Network, SettleResultContext } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  config,
  paidRouteConfig,
  paymentEnvironments,
  type PaidRouteName,
  type PaymentEnvironmentName,
} from "@/lib/config";
import { createPaymentFacilitatorClient } from "@/lib/facilitator-client";
import {
  buildPaymentRequired,
  buildPaymentRequiredBody,
  paymentOutputExample,
} from "@/lib/payment-challenge";
import { paymentOptionFor, priceToAtomicUsdc } from "@/lib/payment-config";
import { createExternalPaidCallEvent } from "@/lib/payment-telemetry";
import { x402DiscoverySchema } from "@/lib/x402-discovery-schema";
import {
  companyChangesExample,
  companyChangesInputJsonSchema,
  companyChangesOutputJsonSchema,
} from "@/lib/company-changes-schema";
import {
  paymentRiskExample,
  paymentRiskInputJsonSchema,
  paymentRiskOutputJsonSchema,
} from "@/lib/payment-risk-schema";
import {
  verifyInputJsonSchema,
  verifyOutputJsonSchema,
} from "@/lib/verification-schema";

type RouteHandler = (request: NextRequest) => Promise<NextResponse>;

function requestFingerprint(request: NextRequest): string {
  const forwarded =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  return createHash("sha256")
    .update(`${forwarded}|${agent}`)
    .digest("hex")
    .slice(0, 16);
}

function lifecycleFingerprint(context: unknown): string | null {
  const request = context as HTTPRequestContext | undefined;
  const forwarded = request?.adapter
    ?.getHeader("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const agent = request?.adapter?.getHeader("user-agent");
  if (!forwarded && !agent) return null;
  return createHash("sha256")
    .update(`${forwarded ?? "unknown"}|${agent ?? "unknown"}`)
    .digest("hex")
    .slice(0, 16);
}

function lifecyclePayer(paymentPayload: unknown): string | null {
  if (!paymentPayload || typeof paymentPayload !== "object") return null;
  const payer = (
    paymentPayload as { payload?: { authorization?: { from?: unknown } } }
  ).payload?.authorization?.from;
  return typeof payer === "string" ? payer : null;
}

function isInternalPayer(payer: string | null): boolean {
  if (!payer) return false;
  return [config.INTERNAL_TEST_PAYER, config.MAINNET_INTERNAL_TEST_PAYER].some(
    (address) => address && address.toLowerCase() === payer.toLowerCase(),
  );
}

function logHttpPaymentResponse(
  request: NextRequest,
  response: NextResponse,
  environmentName: PaymentEnvironmentName,
  routeName: PaidRouteName,
): void {
  const signaturePresent = request.headers.has("payment-signature");
  let event: string | null = null;
  let paymentStage: string | null = null;
  if (!signaturePresent && response.status === 402) {
    event = "http_payment_required_delivered";
    paymentStage = "payment_required";
  } else if (signaturePresent && response.status === 402) {
    event = "http_payment_required_redelivered";
    paymentStage = "payment_required_after_signature";
  } else if (
    signaturePresent &&
    response.status >= 200 &&
    response.status < 300
  ) {
    event = "http_successful_paid_response";
    paymentStage = "successful_paid_response";
  } else if (response.status >= 500) {
    event = "http_payment_facilitator_failure";
    paymentStage = "facilitator_failure";
  }
  if (!event) return;

  console.info(
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      environment: environmentName,
      network: paymentEnvironments[environmentName].network,
      transport: "rest",
      endpoint: paidRouteConfig[routeName].path,
      status: response.status,
      payment_stage: paymentStage,
      payment_signature_status: signaturePresent ? "present" : "missing",
      external_client_fingerprint: requestFingerprint(request),
      discovery_source:
        request.headers.get("x-discovery-source")?.slice(0, 80) ?? null,
    }),
  );
}

const servers = new Map<PaymentEnvironmentName, x402ResourceServer>();
const serverInitializations = new Map<PaymentEnvironmentName, Promise<void>>();

async function ensureServerInitialized(
  environmentName: PaymentEnvironmentName,
): Promise<void> {
  const existing = serverInitializations.get(environmentName);
  if (existing) return existing;

  const initialization = getServer(environmentName).initialize();
  serverInitializations.set(environmentName, initialization);
  try {
    await initialization;
  } catch (error) {
    if (serverInitializations.get(environmentName) === initialization) {
      serverInitializations.delete(environmentName);
    }
    throw error;
  }
}

function discoverySource(context: SettleResultContext): string | undefined {
  const transport = context.transportContext as
    HTTPTransportContext | undefined;
  return transport?.request.adapter.getHeader("x-discovery-source");
}

function logMainnetSettlement(context: SettleResultContext): void {
  const transport = context.transportContext as
    HTTPTransportContext | undefined;
  if (context.phase !== "after-handler" || !transport?.responseBody) return;

  const payloadResource = context.paymentPayload.resource?.url;
  const routeName: PaidRouteName = payloadResource?.endsWith(
    paidRouteConfig["company-changes-mainnet"].path,
  )
    ? "company-changes-mainnet"
    : payloadResource?.endsWith(paidRouteConfig["payment-risk-mainnet"].path)
      ? "payment-risk-mainnet"
      : context.requirements.amount ===
          priceToAtomicUsdc(paidRouteConfig["company-changes-mainnet"].price)
        ? "company-changes-mainnet"
        : context.requirements.amount ===
            priceToAtomicUsdc(paidRouteConfig["payment-risk-mainnet"].price)
          ? "payment-risk-mainnet"
          : "verify-mainnet";
  const route = paidRouteConfig[routeName];
  const environment = paymentEnvironments.mainnet;
  const resource = payloadResource ?? `${config.PUBLIC_BASE_URL}${route.path}`;
  const event = createExternalPaidCallEvent({
    success: context.result.success,
    network: context.result.network,
    asset: context.requirements.asset,
    amount: context.result.amount ?? context.requirements.amount,
    payTo: context.requirements.payTo,
    payer: context.result.payer,
    transaction: context.result.transaction,
    resource,
    expectedNetwork: environment.network,
    expectedAsset: environment.asset,
    expectedAmount: priceToAtomicUsdc(route.price),
    expectedPayTo: environment.payTo,
    expectedResource: resource,
    internalPayers: [
      config.INTERNAL_TEST_PAYER,
      config.MAINNET_INTERNAL_TEST_PAYER,
    ],
    discoverySource: discoverySource(context),
  });
  console.info(
    JSON.stringify({
      event: context.result.success
        ? "http_payment_settlement_success"
        : "http_payment_settlement_failure",
      timestamp: new Date().toISOString(),
      environment: "mainnet",
      transport: "rest",
      payment_stage: context.result.success
        ? "settlement_success"
        : "settlement_failure",
      network: context.result.network,
      payer: context.result.payer ?? null,
      tx_hash: context.result.transaction,
      resource,
      endpoint: route.path,
    }),
  );
  if (event) console.info(JSON.stringify(event));
}

function getServer(
  environmentName: PaymentEnvironmentName,
): x402ResourceServer {
  const existing = servers.get(environmentName);
  if (existing) return existing;

  const environment = paymentEnvironments[environmentName];
  if (/^0x0{40}$/i.test(environment.payTo)) {
    throw new Error(
      `${environmentName} payTo must be a real receiving wallet when x402 is enabled`,
    );
  }
  const facilitator = createPaymentFacilitatorClient(environmentName);
  const server = new x402ResourceServer(facilitator).register(
    "eip155:*",
    new ExactEvmScheme(),
  );
  server.onAfterVerify(
    async ({ result, paymentPayload, requirements, transportContext }) => {
      const payer = lifecyclePayer(paymentPayload);
      console.info(
        JSON.stringify({
          event: result.isValid
            ? "http_payment_signature_valid"
            : "http_payment_signature_invalid",
          timestamp: new Date().toISOString(),
          environment: environmentName,
          transport: "rest",
          payment_stage: result.isValid
            ? "signature_valid"
            : "signature_invalid",
          client_class:
            environmentName === "testnet" || isInternalPayer(payer)
              ? "internal_test"
              : "external",
          payer,
          network: requirements.network,
          asset: requirements.asset,
          amount: requirements.amount,
          external_client_fingerprint: lifecycleFingerprint(transportContext),
        }),
      );
    },
  );
  server.onVerifyFailure(
    async ({ error, paymentPayload, requirements, transportContext }) => {
      const payer = lifecyclePayer(paymentPayload);
      console.info(
        JSON.stringify({
          event: "http_payment_facilitator_failure",
          timestamp: new Date().toISOString(),
          environment: environmentName,
          transport: "rest",
          payment_stage: "verification_facilitator_failure",
          client_class:
            environmentName === "testnet" || isInternalPayer(payer)
              ? "internal_test"
              : "external",
          payer,
          network: requirements.network,
          asset: requirements.asset,
          amount: requirements.amount,
          external_client_fingerprint: lifecycleFingerprint(transportContext),
          error_name: error.name,
        }),
      );
    },
  );
  server.onSettleFailure(
    async ({
      error,
      paymentPayload,
      requirements,
      transportContext,
      phase,
    }) => {
      const payer = lifecyclePayer(paymentPayload);
      console.info(
        JSON.stringify({
          event: "http_payment_facilitator_failure",
          timestamp: new Date().toISOString(),
          environment: environmentName,
          transport: "rest",
          payment_stage: "settlement_facilitator_failure",
          settlement_phase: phase,
          client_class:
            environmentName === "testnet" || isInternalPayer(payer)
              ? "internal_test"
              : "external",
          payer,
          network: requirements.network,
          asset: requirements.asset,
          amount: requirements.amount,
          external_client_fingerprint: lifecycleFingerprint(transportContext),
          error_name: error.name,
        }),
      );
    },
  );
  if (environmentName === "mainnet")
    server.onAfterSettle(async (context) => logMainnetSettlement(context));
  servers.set(environmentName, server);
  return server;
}

export function createLocalPaymentRequiredResponse(
  routeName: PaidRouteName,
): NextResponse {
  const paymentRequired = buildPaymentRequired(routeName);
  const buyerQuickstart = `${config.PUBLIC_BASE_URL}/x402-buyer-quickstart.md`;

  return NextResponse.json(buildPaymentRequiredBody(paymentRequired), {
    status: 402,
    headers: {
      "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired),
      "X-Payment-Instructions": buyerQuickstart,
      Link: `<${buyerQuickstart}>; rel="payment-instructions"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export function protectWithX402(
  handler: RouteHandler,
  routeName: PaidRouteName,
): RouteHandler {
  const route = paidRouteConfig[routeName];
  const environment = paymentEnvironments[route.environment];
  if (!environment.enabled) return handler;

  // The unsigned price-discovery path is fully local. Avoid starting a facilitator
  // request in the background for crawlers, health checks, and MCP discovery calls.
  // A signed buyer initializes the same server lazily immediately before verification.
  const syncFacilitatorOnStart = false;
  const routeConfig = {
    accepts: {
      ...paymentOptionFor(routeName),
      network: environment.network as Network,
    },
    resource: `${config.PUBLIC_BASE_URL}${route.path}`,
    description: route.description,
    mimeType: "application/json",
    serviceName:
      routeName === "verify" || routeName === "verify-mainnet"
        ? "Israel Company Verify"
        : config.PROVIDER_NAME,
    tags:
      routeName === "verify" || routeName === "verify-mainnet"
        ? ["israel", "company", "verification", "kyb", "due-diligence"]
        : ["israel", "company", "supplier", "kyb", "due-diligence"],
    extensions: {
      ...declareDiscoveryExtension({
        bodyType: "json",
        input:
          routeName === "payment-risk-mainnet"
            ? {
                company_number: "514744887",
                invoice_company_number: "514744887",
                invoice_company_name: "מנדיי. קום בעמ",
                language: "en",
              }
            : routeName === "company-changes-mainnet"
              ? {
                  company_number: "514744887",
                  lookback_days: 366,
                  limit: 25,
                  language: "en",
                }
              : { company_number: "514744887", language: "en" },
        inputSchema:
          routeName === "payment-risk-mainnet"
            ? x402DiscoverySchema(paymentRiskInputJsonSchema)
            : routeName === "company-changes-mainnet"
              ? x402DiscoverySchema(companyChangesInputJsonSchema)
              : x402DiscoverySchema(verifyInputJsonSchema),
        output:
          routeName === "verify" || routeName === "verify-mainnet"
            ? {
                example: paymentOutputExample("verify"),
                schema: x402DiscoverySchema(verifyOutputJsonSchema),
              }
            : routeName === "payment-risk-mainnet"
              ? {
                  example: paymentRiskExample,
                  schema: x402DiscoverySchema(paymentRiskOutputJsonSchema),
                }
              : routeName === "company-changes-mainnet"
                ? {
                    example: companyChangesExample,
                    schema: x402DiscoverySchema(companyChangesOutputJsonSchema),
                  }
                : { example: paymentOutputExample(routeName) },
      }),
    },
  };
  const httpServer = new x402HTTPResourceServer(getServer(route.environment), {
    [`POST ${route.path}`]: routeConfig,
  });
  const protectedHandler = withX402FromHTTPServer(
    handler,
    httpServer,
    undefined,
    undefined,
    syncFacilitatorOnStart,
  );
  return async (request) => {
    // Price discovery must remain available even when the facilitator is temporarily down.
    // Only signed requests need facilitator initialization, verification, and settlement.
    if (
      !request.headers.has("payment-signature") &&
      !request.headers.has("x-payment")
    ) {
      const response = createLocalPaymentRequiredResponse(routeName);
      logHttpPaymentResponse(request, response, route.environment, routeName);
      return response;
    }
    try {
      await ensureServerInitialized(route.environment);
    } catch {
      const response = NextResponse.json(
        { error: "Payment facilitator temporarily unavailable" },
        {
          status: 502,
          headers: { "Cache-Control": "private, no-store, max-age=0" },
        },
      );
      logHttpPaymentResponse(request, response, route.environment, routeName);
      return response;
    }
    const response = await protectedHandler(request);
    logHttpPaymentResponse(request, response, route.environment, routeName);
    return response;
  };
}
