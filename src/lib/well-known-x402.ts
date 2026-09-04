import { config, paidRouteConfig, type PaidRouteName } from "@/lib/config";
import {
  companyChangesInputJsonSchema,
  companyChangesOutputJsonSchema,
} from "@/lib/company-changes-schema";
import { buildPaymentRequired } from "@/lib/payment-challenge";
import {
  paymentRiskInputJsonSchema,
  paymentRiskOutputJsonSchema,
} from "@/lib/payment-risk-schema";
import {
  verifyInputJsonSchema,
  verifyOutputJsonSchema,
} from "@/lib/verification-schema";
import { x402DiscoverySchema } from "@/lib/x402-discovery-schema";

const discoveryRoutes: PaidRouteName[] = [
  "company-changes-mainnet",
  "verify-mainnet",
  "payment-risk-mainnet",
  "verify",
  "government-footprint",
  "counterparty-risk",
];

function schemasFor(routeName: PaidRouteName) {
  if (routeName === "company-changes-mainnet") {
    return {
      inputSchema: x402DiscoverySchema(companyChangesInputJsonSchema),
      outputSchema: x402DiscoverySchema(companyChangesOutputJsonSchema),
    };
  }
  if (routeName === "payment-risk-mainnet") {
    return {
      inputSchema: x402DiscoverySchema(paymentRiskInputJsonSchema),
      outputSchema: x402DiscoverySchema(paymentRiskOutputJsonSchema),
    };
  }

  return {
    inputSchema: x402DiscoverySchema(verifyInputJsonSchema),
    outputSchema:
      routeName === "verify" || routeName === "verify-mainnet"
        ? x402DiscoverySchema(verifyOutputJsonSchema)
        : undefined,
  };
}

function discoveryEndpoint(routeName: PaidRouteName) {
  const route = paidRouteConfig[routeName];
  const challenge = buildPaymentRequired(routeName);
  const schemas = schemasFor(routeName);

  return {
    resource: challenge.resource.url,
    method: "POST",
    description: challenge.resource.description,
    mimeType: challenge.resource.mimeType,
    environment: route.environment === "mainnet" ? "production" : "test",
    price: route.price,
    accepts: challenge.accepts,
    inputSchema: schemas.inputSchema,
    ...(schemas.outputSchema ? { outputSchema: schemas.outputSchema } : {}),
    extensions: challenge.extensions,
  };
}

export function wellKnownX402Manifest() {
  return {
    x402Version: 2,
    name: config.PROVIDER_NAME,
    status: config.X402_MAINNET_ENABLED
      ? "MAINNET LIVE - AWAITING FIRST EXTERNAL PAID CALL"
      : "MAINNET DISABLED",
    description:
      "Paid Israeli company verification, daily company-change intelligence, and vendor payment-risk checks with field-level public-registry evidence. Public-registry evidence only, not Full Regulatory KYB.",
    category: "business-intelligence",
    tags: [
      "israel",
      "company",
      "verification",
      "company-changes",
      "corporate-events",
      "vendor-payment-risk",
      "kyb",
      "public-registry-kyb-evidence",
      "israeli-company-registry",
      "supplier",
      "due-diligence",
      "counterparty-intelligence",
      "x402",
    ],
    homepage: `${config.PUBLIC_BASE_URL}/`,
    openapi: `${config.PUBLIC_BASE_URL}/openapi.json`,
    readme: `${config.PUBLIC_BASE_URL}/README.md`,
    mcp: {
      endpoint: `${config.PUBLIC_BASE_URL}/mcp`,
      transport: "streamable-http",
      registry: "io.github.itzikhr18/israel-business-intelligence",
    },
    registry: {
      payaiResourceId: "6a91c9587356b8e8001ae3e5",
      payaiDiscovery: "https://facilitator.payai.network/discovery/resources",
      aggregatedListing:
        "https://x402-bazaar.com/v1/resources/6a91c9587356b8e8001ae3e5",
      agentToolsId: "22198",
      agentToolsSlug: "israel-counterparty-intelligence-vercel-app-sub393",
      x402scanResourceId: "e9b83616-3c3e-483a-81a2-a93c2b85dd7e",
      index402ResourceId: "fa0902ac-90a7-431a-8979-97da22a12911",
    },
    endpoints: discoveryRoutes.map(discoveryEndpoint),
  };
}
