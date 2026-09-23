import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createExternalPaidCallEvent,
  type SettlementTelemetryInput,
  getFirstExternalPaidCall,
  getFirstExternalPaidCallDurable,
  recordFirstExternalPaidCall,
  resetFirstExternalPaidCallForTests,
} from "@/lib/payment-telemetry";

const externalPayer = "0x1111111111111111111111111111111111111111";
const internalPayer = "0x2222222222222222222222222222222222222222";
const receivingWallet = "0xa0A3BB49eA4AC723Bcf4d2d1ecde2EE01BA03C82";

function settlement(
  overrides: Partial<SettlementTelemetryInput> = {},
): SettlementTelemetryInput {
  return {
    success: true,
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amount: "10000",
    payTo: receivingWallet,
    payer: externalPayer,
    transaction: `0x${"a".repeat(64)}`,
    resource:
      "https://israel-counterparty-intelligence.vercel.app/v1/company-changes/mainnet",
    expectedNetwork: "eip155:8453",
    expectedAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    expectedAmount: "10000",
    expectedPayTo: receivingWallet,
    expectedResource:
      "https://israel-counterparty-intelligence.vercel.app/v1/company-changes/mainnet",
    internalPayers: [internalPayer, receivingWallet],
    discoverySource: "payapi-canary",
    timestamp: "2026-09-23T00:00:00.000Z",
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
      amount: "10000",
      amount_usdc: "0.010000",
      payer: externalPayer,
      discovery_source: "payapi-canary",
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
    { payer: receivingWallet },
    { payer: receivingWallet.toLowerCase() },
  ])(
    "does not count non-production, internal, or receiving-wallet settlements: %o",
    (overrides) => {
      expect(createExternalPaidCallEvent(settlement(overrides))).toBeNull();
    },
  );
});

describe("First external paid call celebration", () => {
  beforeEach(() => {
    resetFirstExternalPaidCallForTests();
    delete process.env.FIRST_EXTERNAL_PAID_CALL_TX;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.FIRST_PAID_CALL_WEBHOOK_URL;
    delete process.env.NOTIFY_EMAIL;
  });

  afterEach(() => {
    resetFirstExternalPaidCallForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("records the first external settlement loudly and exposes it via getter", async () => {
    const event = createExternalPaidCallEvent(settlement());
    expect(event).not.toBeNull();
    const record = await recordFirstExternalPaidCall(event!);
    expect(record).toMatchObject({
      tx_hash: event!.tx_hash,
      durable: false,
      source: "process_memory",
    });
    expect(record?.operator_env?.FIRST_EXTERNAL_PAID_CALL_TX).toBe(
      event!.tx_hash,
    );
    expect(getFirstExternalPaidCall()?.tx_hash).toBe(event!.tx_hash);
    const again = await recordFirstExternalPaidCall({
      ...event!,
      tx_hash: `0x${"c".repeat(64)}`,
    });
    expect(again?.tx_hash).toBe(event!.tx_hash);
  });

  it("prefers durable env milestone over process memory", async () => {
    const tx = `0x${"b".repeat(64)}`;
    process.env.FIRST_EXTERNAL_PAID_CALL_TX = tx;
    process.env.FIRST_EXTERNAL_PAID_CALL_AMOUNT_USDC = "0.010000";
    process.env.FIRST_EXTERNAL_PAID_CALL_PAYER = externalPayer;
    process.env.FIRST_EXTERNAL_PAID_CALL_AT = "2026-09-23T01:00:00.000Z";
    const record = await getFirstExternalPaidCallDurable();
    expect(record).toMatchObject({
      tx_hash: tx,
      source: "env",
      durable: true,
    });
  });

  it("persists to Upstash when configured and reads it back as durable", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/get/")) {
          return new Response(JSON.stringify({ result: null }), {
            status: 200,
          });
        }
        // SET NX command body
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body[0]).toBe("SET");
        expect(body[3]).toBe("NX");
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const event = createExternalPaidCallEvent(settlement());
    const record = await recordFirstExternalPaidCall(event!);
    expect(record).toMatchObject({
      source: "upstash",
      durable: true,
      tx_hash: event!.tx_hash,
    });

    // Simulate cold start: clear memory, return stored value from Upstash GET
    resetFirstExternalPaidCallForTests();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/get/")) {
        return new Response(
          JSON.stringify({
            result: JSON.stringify({
              tx_hash: event!.tx_hash,
              resource: event!.resource,
              network: event!.network,
              amount_usdc: event!.amount_usdc,
              payer: event!.payer,
              timestamp: event!.timestamp,
            }),
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ result: null }), { status: 200 });
    });

    const durable = await getFirstExternalPaidCallDurable();
    expect(durable).toMatchObject({
      source: "upstash",
      durable: true,
      tx_hash: event!.tx_hash,
    });
  });
});
