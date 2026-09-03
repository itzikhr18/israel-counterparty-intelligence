import { describe, expect, it } from "vitest";

import {
  nameSimilarity,
  normalizeCompanyNumber,
  normalizeName,
} from "@/lib/normalize";

describe("normalization", () => {
  it("normalizes a formatted Israeli company number", () => {
    expect(normalizeCompanyNumber("51-474488-7")).toBe("514744887");
    expect(normalizeCompanyNumber("123")).toBeNull();
  });

  it("removes common company suffixes without changing core words", () => {
    expect(normalizeName("מנדיי. קום בע״מ")).toBe("מנדיי קום");
    expect(normalizeName("Example Israel Limited")).toBe("example israel");
  });

  it("scores exact normalized names above unrelated names", () => {
    expect(nameSimilarity("Example Ltd", "Example Limited")).toBe(1);
    expect(
      nameSimilarity("Example Ltd", "Completely Different Ltd"),
    ).toBeLessThan(0.4);
  });
});
