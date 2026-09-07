import { describe, expect, it, vi } from "vitest";

// Retain the active-service discovery contract. The real suspension default is
// tested separately in service-suspension.integration.test.ts.
vi.mock("@/lib/service-availability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/service-availability")>()),
  PAID_SERVICE_SUSPENDED: false,
}));

import { GET } from "@/app/.well-known/x402/route";

describe("x402 well-known discovery", () => {
  it("publishes current Mainnet payment requirements", async () => {
    const response = GET();
    const manifest = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(manifest).toMatchObject({
      x402Version: 2,
      name: "Israel Counterparty Intelligence",
      mcp: {
        registry: "io.github.itzikhr18/israel-business-intelligence",
      },
    });

    expect(manifest.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource: expect.stringMatching(/\/v1\/verify\/mainnet$/),
          method: "POST",
          environment: "production",
          price: "$0.05",
          accepts: [
            expect.objectContaining({
              network: "eip155:8453",
              amount: "50000",
            }),
          ],
        }),
        expect.objectContaining({
          resource: expect.stringMatching(/\/v1\/payment-risk\/mainnet$/),
          method: "POST",
          environment: "production",
          price: "$0.10",
          accepts: [
            expect.objectContaining({
              network: "eip155:8453",
              amount: "100000",
            }),
          ],
        }),
        expect.objectContaining({
          resource: expect.stringMatching(/\/v1\/invoice-gate\/mainnet$/),
          method: "POST",
          environment: "production",
          price: "$0.25",
          accepts: [
            expect.objectContaining({
              network: "eip155:8453",
              amount: "250000",
            }),
          ],
        }),
      ]),
    );
  });
});
