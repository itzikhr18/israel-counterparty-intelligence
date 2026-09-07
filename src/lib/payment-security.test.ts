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
  it("withholds actual MCP wrapper report on unsuccessful settlement", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (url) =>
        new Response(
          JSON.stringify(
            String(url).endsWith("/verify")
              ? { isValid: true }
              : {
                  success: false,
                  transaction: "",
                  network: "eip155:84532",
                  errorReason: "insufficient_funds",
                },
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
