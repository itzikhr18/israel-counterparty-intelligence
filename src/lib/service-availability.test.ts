import { describe, expect, it } from "vitest";

import {
  PAID_SERVICE_SUSPENDED,
  paidServiceUnavailableBody,
} from "@/lib/service-availability";

describe("service availability resume default", () => {
  it("reopens paid service in the reviewed resume release", () => {
    expect(PAID_SERVICE_SUSPENDED).toBe(false);
  });

  it("keeps a machine-readable suspended body helper for rollback", () => {
    expect(paidServiceUnavailableBody()).toMatchObject({
      error: { code: "PAID_SERVICE_SUSPENDED", message: expect.any(String) },
      payment_attempted: false,
    });
  });
});
