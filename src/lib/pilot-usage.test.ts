import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hex = (character: string) => character.repeat(64);
const farFuture = "2099-01-01T00:00:00.000Z";
const partner = {
  partner_id: "morning",
  token_sha256: hex("a"),
  expires_at: farFuture,
  call_limit: 500,
};

type Call = { url: string; body: unknown };

function upstashMock(
  respond: (commands: Array<Array<string | number>>) => unknown[],
) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Array<
        Array<string | number>
      >;
      calls.push({ url: String(input), body });
      return new Response(
        JSON.stringify(respond(body).map((result) => ({ result }))),
        { status: 200 },
      );
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

describe("durable pilot usage on Upstash", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io/");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reserves period and month counters in one pipeline and returns the new totals", async () => {
    const calls = upstashMock(() => [42, 7, 12, 3]);
    const { reservePilotUsage, usageMonth } = await import("@/lib/pilot-usage");
    const reservation = await reservePilotUsage(partner, "invoice_gate");
    expect(reservation).toEqual({
      durable: true,
      period_total: 42,
      month: usageMonth(),
      month_total: 12,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.upstash.io/pipeline");
    expect(calls[0]?.body).toEqual([
      ["HINCRBY", "ici:pilot:usage:morning", "total", 1],
      ["HINCRBY", "ici:pilot:usage:morning", "invoice_gate", 1],
      ["HINCRBY", `ici:pilot:usage:morning:${usageMonth()}`, "total", 1],
      ["HINCRBY", `ici:pilot:usage:morning:${usageMonth()}`, "invoice_gate", 1],
    ]);
  });

  it("releases a reservation with the matching decrements", async () => {
    const calls = upstashMock(() => [41, 6, 11, 2]);
    const { releasePilotUsage } = await import("@/lib/pilot-usage");
    await releasePilotUsage(partner, "verify", "2026-09");
    expect(calls[0]?.body).toEqual([
      ["HINCRBY", "ici:pilot:usage:morning", "total", -1],
      ["HINCRBY", "ici:pilot:usage:morning", "verify", -1],
      ["HINCRBY", "ici:pilot:usage:morning:2026-09", "total", -1],
      ["HINCRBY", "ici:pilot:usage:morning:2026-09", "verify", -1],
    ]);
  });

  it("reads durable totals by tool for the period and the month", async () => {
    upstashMock(() => [
      ["total", "42", "invoice_gate", "30", "verify", "12"],
      ["total", "12", "invoice_gate", "9", "verify", "3"],
    ]);
    const { readPilotUsage } = await import("@/lib/pilot-usage");
    const usage = await readPilotUsage(partner, 3, "2026-09");
    expect(usage).toEqual({
      durable: true,
      period_total: 42,
      by_tool: { invoice_gate: 30, verify: 12 },
      month: "2026-09",
      month_total: 12,
      month_by_tool: { invoice_gate: 9, verify: 3 },
    });
  });

  it("falls back to the in-process count and says so when Upstash is not configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { readPilotUsage, reservePilotUsage } =
      await import("@/lib/pilot-usage");
    expect(await reservePilotUsage(partner, "verify")).toEqual({
      durable: false,
    });
    const usage = await readPilotUsage(partner, 3, "2026-09");
    expect(usage).toMatchObject({
      durable: false,
      period_total: 3,
      month_total: 3,
    });
    expect(usage.note).toContain("UPSTASH_REDIS_REST_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a failed Upstash call as not durable instead of failing the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { reservePilotUsage } = await import("@/lib/pilot-usage");
    expect(await reservePilotUsage(partner, "verify")).toEqual({
      durable: false,
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
