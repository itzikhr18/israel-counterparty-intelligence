import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createPaymentWrapper } from "@x402/mcp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaymentFacilitatorClient } from "@/lib/facilitator-client";

const requirements: PaymentRequirements = {
  scheme: "exact",
  network: "eip155:84532",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  amount: "50000",
  payTo: "0x1111111111111111111111111111111111111111",
  maxTimeoutSeconds: 60,
  extra: {},
};
const payment: PaymentPayload = {
  x402Version: 2,
  accepted: requirements,
  payload: { signature: "MOCK_NOT_A_SIGNATURE" },
};

describe("facilitator settlement failure boundary (mocked, no funds)", () => {
  afterEach(() => vi.restoreAllMocks());
  it("rejects HTTP 200 success:false rather than letting MCP deliver a paid report", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          transaction: "",
          network: "eip155:84532",
          errorReason: "insufficient_funds",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = createPaymentFacilitatorClient("testnet");
    await expect(client.settle(payment, requirements)).rejects.toMatchObject({
      name: "SettleError",
      errorReason: "insufficient_funds",
    });
  });
  it("preserves a successful mock settlement receipt", async () => {
    const receipt = {
      success: true,
      transaction: `0x${"1".repeat(64)}`,
      network: "eip155:84532",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(receipt), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    expect(
      await createPaymentFacilitatorClient("testnet").settle(
        payment,
        requirements,
      ),
    ).toMatchObject(receipt);
  });
  it.each([
    { transaction: "" },
    { transaction: "not-a-transaction" },
    { transaction: `0x${"0".repeat(64)}` },
    { network: "eip155:8453" },
    { amount: "0" },
    { amount: "49999" },
    { amount: "50001" },
    { payer: "not-an-address" },
  ])("rejects an inconsistent success receipt: %o", async (overrides) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          transaction: `0x${"1".repeat(64)}`,
          network: requirements.network,
          ...overrides,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    await expect(
      createPaymentFacilitatorClient("testnet").settle(payment, requirements),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("does not resubmit settlement when the network outcome is unknown", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(
        new DOMException("Synthetic timeout after submission", "TimeoutError"),
      );
    await expect(
      createPaymentFacilitatorClient("testnet").settle(payment, requirements),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("rejects facilitator outages and malformed success responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response("unavailable", { status: 503 }),
    );
    await expect(
      createPaymentFacilitatorClient("testnet").settle(payment, requirements),
    ).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      createPaymentFacilitatorClient("testnet").settle(payment, requirements),
    ).rejects.toThrow();
  });
  it.each([
    {
      success: false,
      transaction: "",
      network: requirements.network,
      errorReason: "insufficient_funds",
    },
    { success: true, transaction: "", network: requirements.network },
    {
      success: true,
      transaction: `0x${"1".repeat(64)}`,
      network: "eip155:8453",
    },
    {
      success: true,
      transaction: `0x${"1".repeat(64)}`,
      network: requirements.network,
      amount: "49999",
    },
  ])(
    "withholds actual MCP wrapper report for an unusable receipt: %o",
    async (receipt) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(globalThis, "fetch").mockImplementation(
        async (url) =>
          new Response(
            JSON.stringify(
              String(url).endsWith("/verify") ? { isValid: true } : receipt,
            ),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      );
      const resourceServer = new x402ResourceServer(
        createPaymentFacilitatorClient("testnet"),
      ).register("eip155:*", new ExactEvmScheme());
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "PRIVATE_PAID_REPORT" }],
      });
      const wrapped = createPaymentWrapper(resourceServer, {
        accepts: [requirements],
        resource: { url: "mcp://tool/test" },
      })(handler);
      const result = await wrapped({}, { _meta: { "x402/payment": payment } });
      expect(handler).toHaveBeenCalledOnce();
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).not.toContain("PRIVATE_PAID_REPORT");
      expect(result._meta?.["x402/payment-response"]).toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledTimes(2); // verify + settle, no retry
    },
  );
  it("delivers through the actual MCP wrapper only after a consistent mocked receipt", async () => {
    const receipt = {
      success: true,
      transaction: `0x${"1".repeat(64)}`,
      network: requirements.network,
      amount: requirements.amount,
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (url) =>
        new Response(
          JSON.stringify(
            String(url).endsWith("/verify") ? { isValid: true } : receipt,
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const resourceServer = new x402ResourceServer(
      createPaymentFacilitatorClient("testnet"),
    ).register("eip155:*", new ExactEvmScheme());
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "SYNTHETIC_PAID_REPORT" }],
    });
    const result = await createPaymentWrapper(resourceServer, {
      accepts: [requirements],
    })(handler)({}, { _meta: { "x402/payment": payment } });
    expect(result.isError).not.toBe(true);
    expect(result._meta?.["x402/payment-response"]).toMatchObject(receipt);
    expect(JSON.stringify(result)).toContain("SYNTHETIC_PAID_REPORT");
    expect(handler).toHaveBeenCalledOnce();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
  it("never executes the MCP handler for an invalid payment signature", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          isValid: false,
          invalidReason: "invalid_signature",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const resourceServer = new x402ResourceServer(
      createPaymentFacilitatorClient("testnet"),
    ).register("eip155:*", new ExactEvmScheme());
    const handler = vi.fn();
    const wrapped = createPaymentWrapper(resourceServer, {
      accepts: [requirements],
    })(handler);
    expect(
      (await wrapped({}, { _meta: { "x402/payment": payment } })).isError,
    ).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
