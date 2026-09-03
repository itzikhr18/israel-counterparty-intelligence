import { describe, expect, it } from "vitest";

import {
  AgentPaymentTrustError,
  enforceAgentPaymentTrust,
} from "../lib/pre-sign-policy.mjs";

describe("buyer bridge pre-sign policy", () => {
  it("passes only an automation-safe ALLOW decision", () => {
    const result = {
      decision: { action: "ALLOW", automation_safe: true, reason_codes: [] },
    };
    expect(enforceAgentPaymentTrust(result)).toBe(result);
  });

  it("fails closed for REVIEW, DENY, and malformed results", () => {
    for (const result of [
      {
        decision: {
          action: "REVIEW",
          automation_safe: false,
          reason_codes: ["MISSING"],
        },
      },
      {
        decision: {
          action: "DENY",
          automation_safe: false,
          reason_codes: ["MISMATCH"],
        },
      },
      {},
    ]) {
      expect(() => enforceAgentPaymentTrust(result)).toThrow(
        AgentPaymentTrustError,
      );
    }
  });
});
