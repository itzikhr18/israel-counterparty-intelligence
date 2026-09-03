import { z } from "zod";

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const usdPrice = z.string().regex(/^\$\d+(\.\d{1,6})?$/);
const productionPaymentDefault =
  process.env.VERCEL_ENV === "production" ? "true" : "false";
const defaultPayTo = "0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82";

const envSchema = z.object({
  COMPANY_REGISTRY_BASE_URL: z
    .url()
    .default("https://data.gov.il/api/3/action"),
  COMPANY_REGISTRY_RESOURCE_ID: z
    .string()
    .default("f004176c-b85f-4542-8901-7b3176f9a054"),
  BUDGETKEY_API_BASE: z.url().default("https://next.obudget.org"),
  UPSTREAM_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(60000)
    .default(15000),
  UPSTREAM_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(1).max(86400).default(21600),
  RATE_LIMIT_REQUESTS: z.coerce.number().int().min(1).max(1000).default(30),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3600)
    .default(60),
  X402_ENABLED: z
    .enum(["true", "false"])
    .default(productionPaymentDefault)
    .transform((value) => value === "true"),
  X402_PAY_TO: evmAddress.default(defaultPayTo),
  X402_NETWORK: z.literal("eip155:84532").default("eip155:84532"),
  X402_ASSET: z
    .literal("0x036CbD53842c5426634e7929541eC2318f3dCF7e")
    .default("0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
  X402_FACILITATOR_URL: z.url().default("https://facilitator.payai.network"),
  X402_VERIFY_PRICE: usdPrice.default("$0.10"),
  X402_GOVERNMENT_PRICE: usdPrice.default("$0.35"),
  X402_RISK_PRICE: usdPrice.default("$0.50"),
  X402_MAINNET_ENABLED: z
    .enum(["true", "false"])
    .default(productionPaymentDefault)
    .transform((value) => value === "true"),
  X402_MAINNET_PAY_TO: evmAddress.optional(),
  X402_MAINNET_NETWORK: z.literal("eip155:8453").default("eip155:8453"),
  X402_MAINNET_ASSET: z
    .literal("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
    .default("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
  X402_MAINNET_FACILITATOR_URL: z
    .url()
    .default("https://facilitator.payai.network"),
  X402_MAINNET_VERIFY_PRICE: usdPrice.default("$0.05"),
  X402_MAINNET_PAYMENT_RISK_PRICE: usdPrice.default("$0.10"),
  X402_MCP_TESTNET_VERIFY_PRICE: usdPrice.default("$0.05"),
  X402_MCP_MAINNET_VERIFY_PRICE: usdPrice.default("$0.05"),
  X402_MCP_TESTNET_PAYMENT_RISK_PRICE: usdPrice.default("$0.10"),
  X402_MCP_MAINNET_PAYMENT_RISK_PRICE: usdPrice.default("$0.10"),
  PUBLIC_BASE_URL: z.url().optional(),
  PROVIDER_NAME: z.string().min(2).default("Israel Counterparty Intelligence"),
  INTERNAL_TEST_TOKEN: z.string().optional(),
  INTERNAL_TEST_PAYER: evmAddress.optional(),
  MAINNET_INTERNAL_TEST_PAYER: evmAddress.optional(),
  PILOT_TOKEN_SHA256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .default(
      "4642024c19e96117a4862fadf29a790bde0241144e05e218588e42790129f784",
    ),
  PILOT_PARTNER_ID: z.string().min(2).max(80).default("glama"),
  PILOT_EXPIRES_AT: z.iso.datetime().default("2026-09-14T00:00:00.000Z"),
  PILOT_VERIFICATION_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(100),
});

const parsedConfig = envSchema.parse(process.env);

function resolvePublicBaseUrl(): string {
  if (parsedConfig.PUBLIC_BASE_URL) return parsedConfig.PUBLIC_BASE_URL;
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercelHost ? `https://${vercelHost}` : "http://localhost:3000";
}

export const config = {
  ...parsedConfig,
  X402_MAINNET_PAY_TO:
    parsedConfig.X402_MAINNET_PAY_TO ?? parsedConfig.X402_PAY_TO,
  PUBLIC_BASE_URL: resolvePublicBaseUrl(),
};

export type PaymentEnvironmentName = "testnet" | "mainnet";

export type PaidRouteName =
  | "verify"
  | "verify-mainnet"
  | "government-footprint"
  | "counterparty-risk"
  | "payment-risk-mainnet";

export const paidRouteConfig: Record<
  PaidRouteName,
  {
    path: string;
    price: string;
    description: string;
    environment: PaymentEnvironmentName;
  }
> = {
  verify: {
    path: "/v1/verify",
    price: config.X402_VERIFY_PRICE,
    description:
      "Verify an Israeli company and return structured public registry data with evidence. Use it for Israel company verification, Israeli supplier due diligence, Israel KYB, Israeli business verification, and Israel counterparty intelligence.",
    environment: "testnet",
  },
  "verify-mainnet": {
    path: "/v1/verify/mainnet",
    price: config.X402_MAINNET_VERIFY_PRICE,
    description:
      "Verify an Israeli company using structured public registry data with evidence.",
    environment: "mainnet",
  },
  "government-footprint": {
    path: "/v1/government-footprint",
    price: config.X402_GOVERNMENT_PRICE,
    description:
      "Find an Israeli company's public government contracts and support footprint",
    environment: "testnet",
  },
  "counterparty-risk": {
    path: "/v1/counterparty-risk",
    price: config.X402_RISK_PRICE,
    description:
      "Get evidence-backed public counterparty risk signals for an Israeli company",
    environment: "testnet",
  },
  "payment-risk-mainnet": {
    path: "/v1/payment-risk/mainnet",
    price: config.X402_MAINNET_PAYMENT_RISK_PRICE,
    description:
      "Assess an Israeli vendor before payment using public-registry evidence, invoice identity consistency, contact-domain checks, and buyer-observed payment risk signals",
    environment: "mainnet",
  },
};

export const paymentEnvironments = {
  testnet: {
    enabled: config.X402_ENABLED,
    network: config.X402_NETWORK,
    asset: config.X402_ASSET,
    facilitatorUrl: config.X402_FACILITATOR_URL,
    payTo: config.X402_PAY_TO,
  },
  mainnet: {
    enabled: config.X402_MAINNET_ENABLED,
    network: config.X402_MAINNET_NETWORK,
    asset: config.X402_MAINNET_ASSET,
    facilitatorUrl: config.X402_MAINNET_FACILITATOR_URL,
    payTo: config.X402_MAINNET_PAY_TO,
  },
} as const;
