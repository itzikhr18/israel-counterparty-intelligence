import { describe, expect, it } from "vitest";

import { GET } from "@/app/partner/he/route";

describe("GET /partner/he", () => {
  it("serves the Hebrew partner page as right-to-left HTML without crypto onboarding", async () => {
    const response = GET();
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-language")).toBe("he");
    expect(html).toContain('lang="he"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("לשלם / לעכב / לחסום");
    expect(html).toContain("/v1/pilot/invoice-gate");
    expect(html).toContain("בלי קריפטו");
    expect(html).toContain('href="/partner"');
    expect(html).toContain("mailto:itzikhr18@gmail.com");
    expect(html).not.toContain("USDC");
  });
});
