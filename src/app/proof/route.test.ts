import { describe, expect, it } from "vitest";

import { GET } from "@/app/proof/route";

describe("proof page", () => {
  it("returns minimal HTML that polls same-origin /health", async () => {
    const response = await GET();
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-security-policy")).toContain(
      "connect-src 'self'",
    );
    expect(html).toContain("Settlement proof");
    expect(html).toContain('href="/health"');
    expect(html).toContain('fetch("/health"');
    expect(html).toContain("cache: \"no-store\"");
    expect(html).toContain("basescan.org");
    expect(html).not.toContain("google.com");
    expect(html).not.toContain("radial-gradient");
    expect(html).not.toContain("#61e6ad");
  });
});
