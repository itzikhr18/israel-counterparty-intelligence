import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("MCP ingress security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it("bounds POST bytes before parsing or logging a tool payload", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/mcp/route");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(
      new NextRequest("https://example.test/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": "1" },
        body: '"PRIVATE-INVOICE' + "x".repeat(1_048_576) + '"',
      }),
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE-INVOICE");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("rate limits before service construction even if the caller changes User-Agent", async () => {
    vi.resetModules();
    vi.stubEnv("RATE_LIMIT_REQUESTS", "1");
    const { POST } = await import("@/app/mcp/route");
    const send = (agent: string) =>
      POST(
        new NextRequest("https://example.test/mcp", {
          method: "POST",
          headers: { "user-agent": agent, "x-forwarded-for": "203.0.113.42" },
          body: "{",
        }),
      );
    expect((await send("a")).status).toBe(400);
    const rejected = await send("b");
    expect(rejected.status).toBe(429);
    expect(rejected.headers.get("retry-after")).toBeTruthy();
    expect(rejected.headers.get("cache-control")).toBe("no-store");
  });
});
