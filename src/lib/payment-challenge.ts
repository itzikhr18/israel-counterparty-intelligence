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
  companyChangesExample,
  companyChangesInputJsonSchema,
  companyChangesOutputJsonSchema,
} from "@/lib/company-changes-schema";
import {
  verifyExample,
  verifyInputJsonSchema,
  verifyOutputJsonSchema,
} from "@/lib/verification-schema";
import {
  invoiceGateExample,
  invoiceGateInputJsonSchema,
  invoiceGateOutputJsonSchema,
} from "@/lib/invoice-gate-schema";
import { x402DiscoverySchema } from "@/lib/x402-discovery-schema";

export function paymentOutputExample(
  route: PaidRouteName,
): Record<string, unknown> {
  if (route === "verify") return verifyExample;
  if (route === "payment-risk-mainnet") return paymentRiskExample;
  if (route === "invoice-gate-mainnet") return invoiceGateExample;
  if (route === "company-changes-mainnet") return companyChangesExample;
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
  const serviceMetadata =
    routeName === "invoice-gate-mainnet"
      ? {
          serviceName: "Israel Invoice Payment Gate",
          tags: [
            "israel",
            "invoice-verification",
            "allocation-number",
            "supplier-payments",
            "vat",
          ],
        }
      : routeName === "payment-risk-mainnet"
        ? {
            serviceName: "Israel Vendor Payment Risk",
            tags: [
              "israel",
              "vendor-risk",
              "supplier-payments",
              "invoice-verification",
              "fraud-prevention",
            ],
          }
        : routeName === "company-changes-mainnet"
          ? {
              serviceName: "Israel Company Changes",
              tags: [
                "israel",
                "company-changes",
                "corporate-events",
                "registry-monitoring",
                "due-diligence",
              ],
            }
          : routeName === "verify" || routeName === "verify-mainnet"
            ? {
                serviceName: "Israel Company Registry",
                tags: [
                  "israel",
                  "company-registry",
                  "company-verification",
                  "supplier-verification",
                  "kyb",
                ],
              }
            : {
                serviceName: "Israel Counterparty Intel",
                tags: ["israel", "company", "supplier", "kyb", "due-diligence"],
              };
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
      routeName === "invoice-gate-mainnet"
        ? {
            supplier_company_number: "514744887",
            invoice_number: "INV-2026-001",
            invoice_date: "2026-09-04",
            amount_before_vat: 6000,
            vat_amount: 1080,
            total_amount: 7080,
            currency: "ILS",
            allocation_number: "123456789",
            language: "en",
          }
        : routeName === "payment-risk-mainnet"
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
      routeName === "invoice-gate-mainnet"
        ? x402DiscoverySchema(invoiceGateInputJsonSchema)
        : routeName === "payment-risk-mainnet"
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
          : routeName === "invoice-gate-mainnet"
            ? {
                example: invoiceGateExample,
                schema: x402DiscoverySchema(invoiceGateOutputJsonSchema),
              }
            : routeName === "company-changes-mainnet"
              ? {
                  example: companyChangesExample,
                  schema: x402DiscoverySchema(companyChangesOutputJsonSchema),
                }
              : { example: paymentOutputExample(routeName) },
  });
  const bazaar = extensions.bazaar as {
    info: { input: { method?: string } };
  };
  bazaar.info.input.method = "POST";

  return {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: `${config.PUBLIC_BASE_URL}${route.path}`,
      description: route.description,
      mimeType: "application/json",
      serviceName: serviceMetadata.serviceName,
      tags: serviceMetadata.tags,
      iconUrl: `${config.PUBLIC_BASE_URL}/icon.svg`,
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
