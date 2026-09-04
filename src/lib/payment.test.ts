import { describe, expect, it } from "vitest";

import {
  buildPaymentRequired,
  buildPaymentRequiredBody,
} from "@/lib/payment-challenge";
import { paymentOptionFor, priceToAtomicUsdc } from "@/lib/payment-config";

describe("dual-network x402 configuration", () => {
  it("converts six-decimal USDC prices exactly", () => {
    expect(priceToAtomicUsdc("$0.10")).toBe("100000");
    expect(priceToAtomicUsdc("$0.05")).toBe("50000");
    expect(priceToAtomicUsdc("$0.000001")).toBe("1");
  });

  it("keeps Testnet and Mainnet payment requirements isolated", () => {
    const testnet = paymentOptionFor("verify");
    const mainnet = paymentOptionFor("verify-mainnet");

    expect(testnet).toMatchObject({
      network: "eip155:84532",
      price: {
        amount: "100000",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra: { name: "USDC", version: "2" },
      },
    });
    expect(mainnet).toMatchObject({
      network: "eip155:8453",
      price: {
        amount: "50000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        extra: { name: "USD Coin", version: "2" },
      },
    });
    expect(testnet.network).not.toBe(mainnet.network);
    expect((testnet.price as { asset: string }).asset).not.toBe(
      (mainnet.price as { asset: string }).asset,
    );
  });

  it("creates the Mainnet 402 challenge without contacting a facilitator", () => {
    const challenge = buildPaymentRequired("verify-mainnet");
    expect(challenge).toMatchObject({
      x402Version: 2,
      resource: {
        serviceName: "Israel Company Registry",
        tags: [
          "israel",
          "company-registry",
          "company-verification",
          "supplier-verification",
          "kyb",
        ],
      },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "50000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        },
      ],
    });
    expect(challenge.resource?.url).toMatch(/\/v1\/verify\/mainnet$/);
    expect(challenge.resource?.iconUrl).toMatch(/\/icon\.svg$/);
    expect(challenge.extensions?.bazaar).toBeTruthy();
    const bazaar = challenge.extensions?.bazaar as {
      info: { input: { method?: string } };
    };
    expect(bazaar.info.input.method).toBe("POST");
    expect(JSON.stringify(challenge.extensions)).not.toContain('"format"');
  });

  it("creates a discoverable 0.10 USDC payment-risk challenge", () => {
    const challenge = buildPaymentRequired("payment-risk-mainnet");
    expect(challenge).toMatchObject({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "100000",
        },
      ],
    });
    expect(challenge.resource?.url).toMatch(/\/v1\/payment-risk\/mainnet$/);
    const bazaar = challenge.extensions?.bazaar as { info: { input: unknown } };
    expect(JSON.stringify(bazaar.info.input)).toContain("invoice_company_name");
  });

  it("creates a discoverable 0.01 USDC company-changes challenge", () => {
    const challenge = buildPaymentRequired("company-changes-mainnet");
    expect(challenge).toMatchObject({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "10000",
        },
      ],
    });
    expect(challenge.resource?.url).toMatch(/\/v1\/company-changes\/mainnet$/);
    expect(JSON.stringify(challenge.extensions)).toContain("lookback_days");
  });

  it("gives non-x402-aware buyers a machine-readable path past the 402", () => {
    const body = buildPaymentRequiredBody(
      buildPaymentRequired("verify-mainnet"),
    );

    expect(body).toMatchObject({
      error: "Payment required",
      x402_version: 2,
      payment: {
        scheme: "exact",
        network: "eip155:8453",
        amount: "50000",
        asset_decimals: 6,
      },
      next_action: {
        buyer_bridge: expect.stringMatching(
          /israel-company-verify-buyer-0\.3\.0\.tgz$/,
        ),
      },
    });
  });
});
