import type {
  Network,
  PaymentRequired,
  PaymentRequirements,
} from "@x402/core/types";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";

import {
  config,
  paidRouteConfig,
  paymentEnvironments,
  type PaidRouteName,
} from "@/lib/config";
import { paymentOptionFor } from "@/lib/payment-config";
import {
  paymentRiskExample,
  paymentRiskInputJsonSchema,
  paymentRiskOutputJsonSchema,
} from "@/lib/payment-risk-schema";
import {
  verifyExample,
  verifyInputJsonSchema,
  verifyOutputJsonSchema,
} from "@/lib/verification-schema";
import { x402DiscoverySchema } from "@/lib/x402-discovery-schema";

export function paymentOutputExample(
  route: PaidRouteName,
): Record<string, unknown> {
  if (route === "verify") return verifyExample;
  if (route === "payment-risk-mainnet") return paymentRiskExample;
  if (route === "government-footprint") {
    return {
      entity: { company_number: "514744887" },
      government_footprint: {},
    };
  }
  return {
    entity: { company_number: "514744887" },
    risk: { score: 0, level: "LOW" },
  };
}

export function buildPaymentRequired(
  routeName: PaidRouteName,
): PaymentRequired {
  const route = paidRouteConfig[routeName];
  const environment = paymentEnvironments[route.environment];
  const option = paymentOptionFor(routeName);
  const serviceName =
    routeName === "verify" || routeName === "verify-mainnet"
      ? "Israel Company Verify"
      : config.PROVIDER_NAME;
  const tags =
    routeName === "verify" || routeName === "verify-mainnet"
      ? ["israel", "company", "verification", "kyb", "due-diligence"]
      : ["israel", "company", "supplier", "kyb", "due-diligence"];
  const requirement: PaymentRequirements = {
    scheme: option.scheme,
    network: environment.network as Network,
    amount: option.price.amount,
    asset: option.price.asset,
    payTo: option.payTo,
    maxTimeoutSeconds: 300,
    extra: option.price.extra,
  };
  const extensions = declareDiscoveryExtension({
    bodyType: "json",
    input:
      routeName === "payment-risk-mainnet"
        ? {
            company_number: "514744887",
            invoice_company_number: "514744887",
            invoice_company_name: "מנדיי. קום בעמ",
            language: "en",
          }
        : { company_number: "514744887", language: "en" },
    inputSchema:
      routeName === "payment-risk-mainnet"
        ? x402DiscoverySchema(paymentRiskInputJsonSchema)
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
          : { example: paymentOutputExample(routeName) },
  });
  const bazaar = extensions.bazaar as {
    info: { input: { method?: string; pathParams?: Record<string, never> } };
  };
  bazaar.info.input.method = "POST";
  bazaar.info.input.pathParams = {};

  return {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: `${config.PUBLIC_BASE_URL}${route.path}`,
      description: route.description,
      mimeType: "application/json",
      serviceName,
      tags,
    },
    accepts: [requirement],
    extensions,
  };
}

export function buildPaymentRequiredBody(paymentRequired: PaymentRequired) {
  const requirement = paymentRequired.accepts[0];
  const buyerQuickstart = `${config.PUBLIC_BASE_URL}/x402-buyer-quickstart.md`;
  const buyerBridge = `${config.PUBLIC_BASE_URL}/israel-company-verify-buyer-0.3.0.tgz`;

  return {
    error: "Payment required",
    x402_version: paymentRequired.x402Version,
    payment: requirement
      ? {
          scheme: requirement.scheme,
          network: requirement.network,
          asset: requirement.asset,
          amount: requirement.amount,
          asset_decimals: 6,
          pay_to: requirement.payTo,
        }
      : null,
    next_action: {
      action: "Sign the PAYMENT-REQUIRED terms and retry the identical request",
      buyer_quickstart: buyerQuickstart,
      buyer_bridge: buyerBridge,
    },
  };
}
