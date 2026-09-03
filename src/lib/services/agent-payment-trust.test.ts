import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";

import {
  agentPayeeManifestSchema,
  agentPaymentTrustQuerySchema,
  type AgentPayeeManifest,
  type AgentPaymentTrustQuery,
} from "@/lib/agent-payment-trust-schema";
import type { EntityResolution } from "@/lib/domain";
import {
  assessAgentPaymentTrust,
  manifestSigningPayload,
  paymentFingerprint,
  type ManifestResolution,
} from "@/lib/services/agent-payment-trust";

const account = privateKeyToAccount(
  "0x0000000000000000000000000000000000000000000000000000000000000001",
);
const now = new Date("2026-09-03T08:00:00.000Z");
const payTo = "0x1111111111111111111111111111111111111111";
const asset = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const resolution: EntityResolution = {
  status: "RESOLVED",
  entity: {
    legal_name: "מנדיי. קום בעמ",
    english_name: "MONDAY.COM LTD",
    company_number: "514744887",
    entity_type: "חברה פרטית",
    status: "פעילה",
    registered_address: null,
    incorporation_date: null,
    law_violation_flag: false,
    latest_annual_report_year: 2025,
  },
  candidates: [],
  confidence: 0.99,
  evidence: [],
  missing_data: [],
};

function query(overrides: Record<string, unknown> = {}) {
  return agentPaymentTrustQuerySchema.parse({
    company_number: "514744887",
    service_url: "https://merchant.example/pay",
    payment: {
      scheme: "exact",
      network: "eip155:8453",
      asset,
      amount: "50000",
      pay_to: payTo,
      resource_url: "https://merchant.example/pay",
    },
    manifest_mode: "none",
    mandate: {
      max_amount: "100000",
      allowed_networks: ["eip155:8453"],
      allowed_assets: [asset],
      allowed_pay_to: [payTo],
      allowed_company_numbers: ["514744887"],
    },
    language: "en",
    ...overrides,
  });
}

async function signedManifest(overrides: Record<string, unknown> = {}) {
  const unsigned = {
    version: "0.1" as const,
    company_number: "514744887",
    legal_name: "מנדיי. קום בעמ",
    service_origin: "https://merchant.example",
    allowed_payments: [{ network: "eip155:8453", asset, pay_to: payTo }],
    issued_at: "2026-09-02T00:00:00.000Z",
    expires_at: "2026-10-03T00:00:00.000Z",
    signing_address: account.address,
    ...overrides,
  };
  const placeholder = agentPayeeManifestSchema.parse({
    ...unsigned,
    signature: `0x${"00".repeat(65)}`,
  });
  const signature = await account.signMessage({
    message: manifestSigningPayload(placeholder),
  });
  return agentPayeeManifestSchema.parse({ ...unsigned, signature });
}

function resolver(
  manifest: AgentPayeeManifest,
  fetchedFromServiceDomain: boolean,
): (query: AgentPaymentTrustQuery) => Promise<ManifestResolution> {
  return async () => ({
    manifest,
    mode: fetchedFromServiceDomain ? "fetch" : "inline",
    sourceUrl: fetchedFromServiceDomain
      ? "https://merchant.example/.well-known/agent-payee.json"
      : null,
    fetchedFromServiceDomain,
    errorCode: null,
  });
}

describe("agent payment trust firewall", () => {
  it("allows only a registry-resolved, domain-fetched, signed, mandated payment", async () => {
    const input = query({ manifest_mode: "fetch" });
    const manifest = await signedManifest();
    const result = await assessAgentPaymentTrust(
      input,
      resolution,
      now,
      resolver(manifest, true),
    );

    expect(result.decision).toMatchObject({
      action: "ALLOW",
      automation_safe: true,
      assurance_level: "LEVEL_2_REGISTRY",
      reason_codes: [],
    });
    expect(result.next_action.proceed_to_payment).toBe(true);
  });

  it("requires review for a valid inline manifest because domain hosting was not verified", async () => {
    const manifest = await signedManifest();
    const input = query({ manifest_mode: "inline", manifest });
    const result = await assessAgentPaymentTrust(
      input,
      resolution,
      now,
      resolver(manifest, false),
    );

    expect(result.decision.action).toBe("REVIEW");
    expect(result.decision.assurance_level).toBe("LEVEL_1_SIGNED");
    expect(result.decision.reason_codes).toContain(
      "MANIFEST_NOT_DOMAIN_FETCHED",
    );
    expect(result.next_action.proceed_to_payment).toBe(false);
  });

  it("denies a destination that the signed manifest did not authorize", async () => {
    const input = query({
      manifest_mode: "fetch",
      payment: {
        scheme: "exact",
        network: "eip155:8453",
        asset,
        amount: "50000",
        pay_to: "0x2222222222222222222222222222222222222222",
        resource_url: "https://merchant.example/pay",
      },
      mandate: {
        max_amount: "100000",
        allowed_networks: ["eip155:8453"],
        allowed_assets: [asset],
        allowed_pay_to: ["0x2222222222222222222222222222222222222222"],
        allowed_company_numbers: ["514744887"],
      },
    });
    const manifest = await signedManifest();
    const result = await assessAgentPaymentTrust(
      input,
      resolution,
      now,
      resolver(manifest, true),
    );

    expect(result.decision.action).toBe("DENY");
    expect(result.decision.reason_codes).toContain(
      "PAYMENT_DESTINATION_NOT_AUTHORIZED",
    );
  });

  it("uses a stable fingerprint and detects changed payment terms", async () => {
    const input = query();
    const fingerprint = paymentFingerprint(input);
    expect(paymentFingerprint(input)).toBe(fingerprint);

    const changed = query({
      previous_payment_fingerprint: fingerprint,
      payment: { ...input.payment, amount: "50001" },
    });
    const result = await assessAgentPaymentTrust(changed, resolution, now);
    expect(result.decision.action).toBe("REVIEW");
    expect(result.decision.reason_codes).toContain("PAYMENT_TERMS_CHANGED");
  });
});
