import { randomBytes } from "node:crypto";

import { HTTPFacilitatorClient } from "@x402/core/server";
import { SignJWT, importJWK, importPKCS8, type CryptoKey } from "jose";

import {
  config,
  paymentEnvironments,
  type PaymentEnvironmentName,
} from "@/lib/config";

const CDP_HOST = "api.cdp.coinbase.com";
const CDP_BASE_PATH = "/platform/v2/x402";

type CdpJwtInput = {
  apiKeyId: string;
  apiKeySecret: string;
  requestMethod: "GET" | "POST";
  requestPath: string;
  now?: number;
};

function nonce(): string {
  return randomBytes(16).toString("hex");
}

async function importCdpKey(secret: string): Promise<{
  algorithm: "ES256" | "EdDSA";
  key: CryptoKey | Uint8Array;
}> {
  const normalizedSecret = secret.replace(/\\n/g, "\n");
  try {
    return {
      algorithm: "ES256",
      key: await importPKCS8(normalizedSecret, "ES256"),
    };
  } catch {
    const decoded = Buffer.from(normalizedSecret, "base64");
    if (decoded.length !== 64) {
      throw new Error(
        "CDP_API_KEY_SECRET must be a PKCS#8 EC private key or a 64-byte base64 Ed25519 key",
      );
    }
    const key = await importJWK(
      {
        kty: "OKP",
        crv: "Ed25519",
        d: decoded.subarray(0, 32).toString("base64url"),
        x: decoded.subarray(32).toString("base64url"),
      },
      "EdDSA",
    );
    return { algorithm: "EdDSA", key };
  }
}

export async function generateCdpJwt({
  apiKeyId,
  apiKeySecret,
  requestMethod,
  requestPath,
  now = Math.floor(Date.now() / 1000),
}: CdpJwtInput): Promise<string> {
  const { algorithm, key } = await importCdpKey(apiKeySecret);
  return new SignJWT({
    sub: apiKeyId,
    iss: "cdp",
    uris: [`${requestMethod} ${CDP_HOST}${requestPath}`],
  })
    .setProtectedHeader({
      alg: algorithm,
      kid: apiKeyId,
      typ: "JWT",
      nonce: nonce(),
    })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 120)
    .sign(key);
}

async function cdpHeaders(
  requestMethod: "GET" | "POST",
  requestPath: string,
): Promise<Record<string, string>> {
  const apiKeyId = config.CDP_API_KEY_ID;
  const apiKeySecret = config.CDP_API_KEY_SECRET;
  if (!apiKeyId || !apiKeySecret) {
    throw new Error("Coinbase CDP facilitator credentials are not configured");
  }
  const token = await generateCdpJwt({
    apiKeyId,
    apiKeySecret,
    requestMethod,
    requestPath,
  });
  return { Authorization: `Bearer ${token}` };
}

export function createPaymentFacilitatorClient(
  environmentName: PaymentEnvironmentName,
): HTTPFacilitatorClient {
  const environment = paymentEnvironments[environmentName];
  if (environment.facilitatorProvider === "coinbase-cdp") {
    return new HTTPFacilitatorClient({
      url: environment.facilitatorUrl,
      createAuthHeaders: async () => ({
        verify: await cdpHeaders("POST", `${CDP_BASE_PATH}/verify`),
        settle: await cdpHeaders("POST", `${CDP_BASE_PATH}/settle`),
        supported: await cdpHeaders("GET", `${CDP_BASE_PATH}/supported`),
      }),
    });
  }
  return new HTTPFacilitatorClient({ url: environment.facilitatorUrl });
}
