import { describe, expect, it } from "vitest";

import {
  createExternalPaidCallEvent,
  type SettlementTelemetryInput,
} from "@/lib/payment-telemetry";

const externalPayer = "0x1111111111111111111111111111111111111111";
const internalPayer = "0x2222222222222222222222222222222222222222";

function settlement(
  overrides: Partial<SettlementTelemetryInput> = {},
): SettlementTelemetryInput {
  return {
    success: true,
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amount: "50000",
    payTo: "0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82",
    payer: externalPayer,
    transaction: `0x${"a".repeat(64)}`,
    resource:
      "https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet",
    expectedNetwork: "eip155:8453",
    expectedAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    expectedAmount: "50000",
    expectedPayTo: "0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82",
    expectedResource:
      "https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet",
    internalPayers: [internalPayer],
    discoverySource: "agent-tools",
    timestamp: "2026-08-29T00:00:00.000Z",
    ...overrides,
  };
}

describe("External Paid Call #1 telemetry", () => {
  it("emits only for a successful exact Base Mainnet USDC settlement", () => {
    expect(createExternalPaidCallEvent(settlement())).toMatchObject({
      event: "external_paid_call",
      status: 200,
      settlement_status: "success",
      network: "eip155:8453",
      amount: "50000",
      amount_usdc: "0.050000",
      payer: externalPayer,
      discovery_source: "agent-tools",
    });
  });

  it.each([
    { network: "eip155:84532" },
    { asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
    { amount: "100000" },
    { success: false },
    { transaction: "" },
    {
      resource: "https://israel-counterparty-intelligence.vercel.app/v1/verify",
    },
    { payer: internalPayer },
  ])(
    "does not count non-production or internal settlements: %o",
    (overrides) => {
      expect(createExternalPaidCallEvent(settlement(overrides))).toBeNull();
    },
  );
});
