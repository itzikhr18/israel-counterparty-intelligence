import { describe, expect, it } from "vitest";

import {
  POLICY_ID,
  POLICY_VERSION,
  allocationPolicy,
  evaluateAllocationPolicy,
  thresholdIlsForInvoiceDate,
} from "@/lib/policies/israel-allocation-policy";

describe("Israel allocation policy (golden)", () => {
  it("exposes a stable policy id and version", () => {
    const result = evaluateAllocationPolicy("2026-09-01", 1000);
    expect(result.policy_id).toBe(POLICY_ID);
    expect(result.policy_version).toBe(POLICY_VERSION);
    expect(result.policy_id).toMatch(/^israel-allocation-v/);
  });

  it("uses the legislated threshold schedule by invoice date", () => {
    expect(thresholdIlsForInvoiceDate("2025-12-31")).toBe(20_000);
    expect(thresholdIlsForInvoiceDate("2026-01-01")).toBe(10_000);
    expect(thresholdIlsForInvoiceDate("2026-05-31")).toBe(10_000);
    expect(thresholdIlsForInvoiceDate("2026-06-01")).toBe(5_000);
  });

  it("treats amount exactly at the threshold as not exceeding (strictly greater than)", () => {
    expect(allocationPolicy("2026-06-01", 5_000)).toMatchObject({
      allocation_threshold_ils: 5_000,
      amount_exceeds_threshold: false,
      allocation_applicability: "NOT_REQUIRED",
      allocation_required: false,
      policy_as_of: "2026-06-01",
    });
    expect(allocationPolicy("2026-01-01", 10_000)).toMatchObject({
      allocation_threshold_ils: 10_000,
      amount_exceeds_threshold: false,
      allocation_required: false,
      policy_as_of: "2026-01-01",
    });
    expect(allocationPolicy("2025-12-31", 20_000)).toMatchObject({
      allocation_threshold_ils: 20_000,
      amount_exceeds_threshold: false,
      allocation_required: false,
      policy_as_of: "2025-01-01",
    });
  });

  it("marks one agora above the threshold as exceeding", () => {
    expect(allocationPolicy("2026-06-01", 5_000.01)).toMatchObject({
      amount_exceeds_threshold: true,
      allocation_applicability: "UNKNOWN",
      allocation_required: null,
      missing_inputs: [
        "has_vat_component",
        "buyer_is_authorized_dealer",
        "buyer_requested_allocation_number",
      ],
    });
  });

  it("returns NOT_REQUIRED when VAT component is absent", () => {
    expect(
      evaluateAllocationPolicy("2026-06-01", 6_000, {
        has_vat_component: false,
      }),
    ).toMatchObject({
      allocation_applicability: "NOT_REQUIRED",
      allocation_required: false,
      has_vat_component: false,
    });
  });

  it("returns NOT_REQUIRED when the buyer is not an authorized dealer", () => {
    expect(
      evaluateAllocationPolicy("2026-06-01", 6_000, {
        has_vat_component: true,
        buyer_is_authorized_dealer: false,
        buyer_requested_allocation_number: true,
      }),
    ).toMatchObject({
      allocation_applicability: "NOT_REQUIRED",
      allocation_required: false,
    });
  });

  it("returns NOT_REQUIRED when the buyer did not request an allocation number", () => {
    expect(
      evaluateAllocationPolicy("2026-06-01", 6_000, {
        has_vat_component: true,
        buyer_is_authorized_dealer: true,
        buyer_requested_allocation_number: false,
      }),
    ).toMatchObject({
      allocation_applicability: "NOT_REQUIRED",
      allocation_required: false,
    });
  });

  it("returns REQUIRED when all applicability conditions are met", () => {
    expect(
      evaluateAllocationPolicy("2026-06-01", 6_000, {
        has_vat_component: true,
        buyer_is_authorized_dealer: true,
        buyer_requested_allocation_number: true,
      }),
    ).toMatchObject({
      allocation_applicability: "REQUIRED",
      allocation_required: true,
      missing_inputs: [],
      policy_id: POLICY_ID,
      policy_version: POLICY_VERSION,
    });
  });

  it("fails safely to UNKNOWN/HOLD context when buyer attestations are missing above threshold", () => {
    expect(
      evaluateAllocationPolicy("2026-06-01", 6_000, {
        has_vat_component: true,
      }),
    ).toMatchObject({
      allocation_applicability: "UNKNOWN",
      allocation_required: null,
      missing_inputs: [
        "buyer_is_authorized_dealer",
        "buyer_requested_allocation_number",
      ],
    });
  });

  it("documents that this policy does not authenticate Tax Authority results", () => {
    const note = evaluateAllocationPolicy("2026-06-01", 100).note.toLowerCase();
    expect(note).toContain("does not call");
    expect(note).toContain("decision-support");
    expect(note).not.toContain("we authenticated");
  });
});
