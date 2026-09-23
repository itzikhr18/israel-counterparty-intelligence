import { describe, expect, it } from "vitest";

import {
  SAMPLE_COMPANY_NUMBER,
  companyChangesQuerySchema,
} from "./company-changes-schema";

describe("companyChangesQuerySchema", () => {
  it("defaults company_number for empty marketplace canary bodies", () => {
    const parsed = companyChangesQuerySchema.parse({});
    expect(parsed.company_number).toBe(SAMPLE_COMPANY_NUMBER);
    expect(parsed.lookback_days).toBe(366);
    expect(parsed.limit).toBe(25);
    expect(parsed.language).toBe("en");
  });

  it("still rejects malformed company_number", () => {
    expect(() =>
      companyChangesQuerySchema.parse({ company_number: "123" }),
    ).toThrow();
  });
});
