import { generateKeyPairSync } from "node:crypto";

import { decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, it } from "vitest";

import { generateCdpJwt } from "@/lib/facilitator-client";

describe("Coinbase CDP facilitator authentication", () => {
  it("creates a short-lived request-bound ES256 token without exposing the key", async () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const apiKeySecret = privateKey.export({
      type: "pkcs8",
      format: "pem",
    }) as string;
    const token = await generateCdpJwt({
      apiKeyId: "organizations/test/apiKeys/key",
      apiKeySecret,
      requestMethod: "POST",
      requestPath: "/platform/v2/x402/verify",
      now: 1_800_000_000,
    });

    expect(decodeProtectedHeader(token)).toMatchObject({
      alg: "ES256",
      kid: "organizations/test/apiKeys/key",
      typ: "JWT",
    });
    expect(decodeJwt(token)).toMatchObject({
      sub: "organizations/test/apiKeys/key",
      iss: "cdp",
      uris: ["POST api.cdp.coinbase.com/platform/v2/x402/verify"],
      iat: 1_800_000_000,
      nbf: 1_800_000_000,
      exp: 1_800_000_120,
    });
    expect(token).not.toContain(apiKeySecret);
  });
});
