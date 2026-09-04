import { describe, expect, it } from "vitest";

import { GET } from "@/app/.well-known/x402/route";

describe("x402 well-known discovery", () => {
  it("publishes current Mainnet payment requirements", async () => {
    const response = GET();
    const manifest = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toContain("s-maxage=3600");
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
      ]),
    );
  });
});
