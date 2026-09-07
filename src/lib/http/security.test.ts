import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { readBoundedJson } from "@/lib/http/body";
import { rateLimitClientKey } from "@/lib/http/client-key";

describe("request security boundaries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
  it("bounds bytes, not characters or attacker-supplied length", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ value: "א".repeat(40_000) }),
      headers: { "content-length": "1" },
    });
    await expect(readBoundedJson(request)).rejects.toMatchObject({
      status: 413,
      code: "BODY_TOO_LARGE",
    });
  });
  it("cancels an oversized stream before consuming the rest", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(101));
      },
      cancel,
    });
    const request = new Request("https://example.test", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    await expect(readBoundedJson(request, 100)).rejects.toMatchObject({
      status: 413,
    });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("allows the exact byte boundary and rejects malformed JSON", async () => {
    expect(
      await readBoundedJson(
        new Request("https://example.test", { method: "POST", body: "{}" }),
        2,
      ),
    ).toEqual({});
    await expect(
      readBoundedJson(
        new Request("https://example.test", { method: "POST", body: "{" }),
      ),
    ).rejects.toThrow();
  });
  it("does not reset quota when User-Agent changes", () => {
    const first = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "a" },
    });
    const second = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "b" },
    });
    expect(rateLimitClientKey(first)).toBe(rateLimitClientKey(second));
    expect(rateLimitClientKey(first)).not.toContain("203.0.113.10");
  });
  it("bounds local limiter state without evicting an active identity", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { checkRateLimit, MAX_RATE_LIMIT_KEYS } =
      await import("@/lib/http/rate-limit");
    for (let i = 0; i < MAX_RATE_LIMIT_KEYS; i++)
      expect(checkRateLimit(`key-${i}`).allowed).toBe(true);
    expect(checkRateLimit("overflow").allowed).toBe(false);
    expect(checkRateLimit("key-0").allowed).toBe(true);
    vi.advanceTimersByTime(3_600_001);
    expect(checkRateLimit("overflow").allowed).toBe(true);
  });
  it("REST default cap rejects oversized input before the operation and without payload logs", async () => {
    vi.resetModules();
    const { createJsonHandler } = await import("@/lib/http/handler");
    const operation = vi.fn().mockResolvedValue({ ok: true });
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const handler = createJsonHandler(
      "/security-test",
      z.object({ value: z.string() }),
      operation,
    );
    const response = await handler(
      new NextRequest("https://example.test/security-test", {
        method: "POST",
        body: JSON.stringify({ value: "PRIVATE-INVOICE".repeat(6_000) }),
      }),
    );
    expect(response.status).toBe(413);
    expect(operation).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE-INVOICE");
  });
  it("bounds form bytes before multipart parsing", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/invoice-preview/route");
    const response = await POST(
      new NextRequest("https://example.test/invoice-preview", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "content-length": "1",
        },
        body: "invoice_request=" + "x".repeat(70_000),
      }),
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("applies the local limit to browser preview routes as well", async () => {
    vi.resetModules();
    vi.stubEnv("RATE_LIMIT_REQUESTS", "1");
    const { GET } = await import("@/app/preview/route");
    const { POST } = await import("@/app/invoice-preview/route");
    expect(
      (await GET(new NextRequest("https://example.test/preview"))).status,
    ).toBe(400);
    const blocked = await POST(
      new NextRequest("https://example.test/invoice-preview", {
        method: "POST",
        body: "",
      }),
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });
});
