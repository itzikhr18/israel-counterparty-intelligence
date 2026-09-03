import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

import { recoverMessageAddress, type Hex } from "viem";

import {
  agentPayeeManifestSchema,
  type AgentPayeeManifest,
  type AgentPaymentTrustQuery,
} from "@/lib/agent-payment-trust-schema";
import type { EntityResolution } from "@/lib/domain";
import { normalizeCompanyNumber } from "@/lib/normalize";

export const AGENT_PAYMENT_TRUST_VERSION = "0.1.0";
export const AGENT_PAYEE_MANIFEST_PATH = "/.well-known/agent-payee.json";

type CheckStatus = "PASS" | "REVIEW" | "FAIL" | "NOT_CHECKED";

interface TrustCheck {
  code: string;
  status: CheckStatus;
  claimed: unknown;
  observed: unknown;
}

export interface ManifestResolution {
  manifest: AgentPayeeManifest | null;
  mode: "fetch" | "inline" | "none";
  sourceUrl: string | null;
  fetchedFromServiceDomain: boolean;
  errorCode: string | null;
}

function sameValue(left: string, right: string): boolean {
  return left.toLocaleLowerCase("en") === right.toLocaleLowerCase("en");
}

function normalizedOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.origin.toLocaleLowerCase("en");
  } catch {
    return null;
  }
}

function isPrivateAddress(address: string): boolean {
  if (address.includes(":")) {
    const lower = address.toLocaleLowerCase("en");
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("::ffff:10.") ||
      lower.startsWith("::ffff:127.") ||
      lower.startsWith("::ffff:169.254.") ||
      lower.startsWith("::ffff:192.168.")
    );
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part)))
    return true;
  const [a = 0, b = 0] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function safeManifestUrl(serviceUrl: string): Promise<URL | null> {
  const service = new URL(serviceUrl);
  const hostname = service.hostname.toLocaleLowerCase("en");
  if (
    service.protocol !== "https:" ||
    service.username ||
    service.password ||
    (service.port && service.port !== "443") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return null;
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) return null;
  } else {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isPrivateAddress(address))
    ) {
      return null;
    }
  }
  return new URL(AGENT_PAYEE_MANIFEST_PATH, service.origin);
}

function manifestUnsignedValue(manifest: AgentPayeeManifest) {
  return {
    version: manifest.version,
    company_number: manifest.company_number,
    ...(manifest.legal_name ? { legal_name: manifest.legal_name } : {}),
    service_origin: manifest.service_origin,
    allowed_payments: manifest.allowed_payments,
    issued_at: manifest.issued_at,
    expires_at: manifest.expires_at,
    signing_address: manifest.signing_address,
  };
}

export function manifestSigningPayload(manifest: AgentPayeeManifest): string {
  return `Israel Counterparty Intelligence Agent Payee Manifest v0.1\n${JSON.stringify(
    manifestUnsignedValue(manifest),
  )}`;
}

export function paymentFingerprint(query: AgentPaymentTrustQuery): string {
  const payment = query.payment;
  return createHash("sha256")
    .update(
      JSON.stringify({
        scheme: payment.scheme,
        network: payment.network,
        asset: payment.asset.toLocaleLowerCase("en"),
        amount: payment.amount,
        pay_to: payment.pay_to.toLocaleLowerCase("en"),
        resource_url: payment.resource_url ?? query.service_url,
      }),
    )
    .digest("hex");
}

async function fetchManifest(
  query: AgentPaymentTrustQuery,
): Promise<ManifestResolution> {
  if (query.manifest_mode === "none") {
    return {
      manifest: null,
      mode: "none",
      sourceUrl: null,
      fetchedFromServiceDomain: false,
      errorCode: "MANIFEST_NOT_REQUESTED",
    };
  }
  if (query.manifest_mode === "inline") {
    return {
      manifest: query.manifest ?? null,
      mode: "inline",
      sourceUrl: null,
      fetchedFromServiceDomain: false,
      errorCode: query.manifest ? null : "MANIFEST_MISSING",
    };
  }

  let url: URL | null;
  try {
    url = await safeManifestUrl(query.service_url);
  } catch {
    url = null;
  }
  if (!url) {
    return {
      manifest: null,
      mode: "fetch",
      sourceUrl: null,
      fetchedFromServiceDomain: false,
      errorCode: "UNSAFE_MANIFEST_URL",
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "IsraelCounterpartyIntelligence/1.4",
      },
      redirect: "error",
      signal: AbortSignal.timeout(3_500),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declaredLength = Number(
      response.headers.get("content-length") ?? "0",
    );
    if (declaredLength > 65_536) throw new Error("Manifest is too large");
    const text = await response.text();
    if (text.length > 65_536) throw new Error("Manifest is too large");
    const parsed = agentPayeeManifestSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error("Manifest schema validation failed");
    return {
      manifest: parsed.data,
      mode: "fetch",
      sourceUrl: url.toString(),
      fetchedFromServiceDomain: true,
      errorCode: null,
    };
  } catch {
    return {
      manifest: null,
      mode: "fetch",
      sourceUrl: url.toString(),
      fetchedFromServiceDomain: false,
      errorCode: "MANIFEST_UNAVAILABLE",
    };
  }
}

async function signatureIsValid(
  manifest: AgentPayeeManifest,
): Promise<boolean> {
  try {
    const recovered = await recoverMessageAddress({
      message: manifestSigningPayload(manifest),
      signature: manifest.signature as Hex,
    });
    return sameValue(recovered, manifest.signing_address);
  } catch {
    return false;
  }
}

function completeMandate(query: AgentPaymentTrustQuery): boolean {
  const mandate = query.mandate;
  return Boolean(
    mandate?.max_amount &&
    mandate.allowed_networks?.length &&
    mandate.allowed_assets?.length &&
    mandate.allowed_pay_to?.length &&
    mandate.allowed_company_numbers?.length,
  );
}

export async function assessAgentPaymentTrust(
  query: AgentPaymentTrustQuery,
  resolution: EntityResolution,
  now = new Date(),
  resolveManifest: (
    query: AgentPaymentTrustQuery,
  ) => Promise<ManifestResolution> = fetchManifest,
) {
  const checks: TrustCheck[] = [];
  const reasons = new Set<string>();
  const hardFailures = new Set<string>();
  const fingerprint = paymentFingerprint(query);
  const manifestResolution = await resolveManifest(query);
  const manifest = manifestResolution.manifest;
  const entity = resolution.status === "RESOLVED" ? resolution.entity : null;

  if (!entity) {
    const code =
      resolution.status === "AMBIGUOUS"
        ? "ENTITY_AMBIGUOUS"
        : "ENTITY_NOT_FOUND";
    reasons.add(code);
    hardFailures.add(code);
    checks.push({
      code: "LEGAL_ENTITY",
      status: "FAIL",
      claimed: query.company_number ?? query.company_name,
      observed: resolution.status,
    });
  } else {
    checks.push({
      code: "LEGAL_ENTITY",
      status: "PASS",
      claimed: query.company_number ?? query.company_name,
      observed: entity.company_number,
    });
    const active = ["פעילה", "active"].includes(
      entity.status.toLocaleLowerCase("he"),
    );
    checks.push({
      code: "ENTITY_STATUS",
      status: active ? "PASS" : "FAIL",
      claimed: "active",
      observed: entity.status,
    });
    if (!active) {
      reasons.add("ENTITY_NOT_ACTIVE");
      hardFailures.add("ENTITY_NOT_ACTIVE");
    }
  }

  let signatureValid = false;
  if (!manifest) {
    const code = manifestResolution.errorCode ?? "MANIFEST_MISSING";
    reasons.add(code);
    checks.push({
      code: "PAYEE_MANIFEST",
      status: "REVIEW",
      claimed: manifestResolution.mode,
      observed: code,
    });
  } else {
    const serviceOrigin = normalizedOrigin(query.service_url);
    const manifestOrigin = normalizedOrigin(manifest.service_origin);
    const originMatches = Boolean(
      serviceOrigin && manifestOrigin && serviceOrigin === manifestOrigin,
    );
    checks.push({
      code: "SERVICE_ORIGIN",
      status: originMatches ? "PASS" : "FAIL",
      claimed: serviceOrigin,
      observed: manifestOrigin,
    });
    if (!originMatches) {
      reasons.add("MANIFEST_SERVICE_ORIGIN_MISMATCH");
      hardFailures.add("MANIFEST_SERVICE_ORIGIN_MISMATCH");
    }

    signatureValid = await signatureIsValid(manifest);
    checks.push({
      code: "MANIFEST_SIGNATURE",
      status: signatureValid ? "PASS" : "FAIL",
      claimed: manifest.signing_address,
      observed: signatureValid,
    });
    if (!signatureValid) {
      reasons.add("MANIFEST_SIGNATURE_INVALID");
      hardFailures.add("MANIFEST_SIGNATURE_INVALID");
    }

    if (!manifestResolution.fetchedFromServiceDomain) {
      reasons.add("MANIFEST_NOT_DOMAIN_FETCHED");
      checks.push({
        code: "MANIFEST_DOMAIN_HOSTING",
        status: "REVIEW",
        claimed: query.service_url,
        observed: manifestResolution.mode,
      });
    } else {
      checks.push({
        code: "MANIFEST_DOMAIN_HOSTING",
        status: "PASS",
        claimed: query.service_url,
        observed: manifestResolution.sourceUrl,
      });
    }

    const manifestCompany = normalizeCompanyNumber(manifest.company_number);
    const entityCompany = entity
      ? normalizeCompanyNumber(entity.company_number)
      : null;
    const companyMatches = Boolean(
      manifestCompany && entityCompany && manifestCompany === entityCompany,
    );
    checks.push({
      code: "MANIFEST_COMPANY",
      status: companyMatches ? "PASS" : "FAIL",
      claimed: manifestCompany,
      observed: entityCompany,
    });
    if (!companyMatches) {
      reasons.add("MANIFEST_COMPANY_MISMATCH");
      hardFailures.add("MANIFEST_COMPANY_MISMATCH");
    }

    const issued = Date.parse(manifest.issued_at);
    const expires = Date.parse(manifest.expires_at);
    const timeValid =
      issued <= now.getTime() + 5 * 60_000 && expires > now.getTime();
    checks.push({
      code: "MANIFEST_VALIDITY",
      status: timeValid ? "PASS" : "FAIL",
      claimed: now.toISOString(),
      observed: {
        issued_at: manifest.issued_at,
        expires_at: manifest.expires_at,
      },
    });
    if (!timeValid) {
      reasons.add("MANIFEST_EXPIRED_OR_NOT_YET_VALID");
      hardFailures.add("MANIFEST_EXPIRED_OR_NOT_YET_VALID");
    }

    const destinationAllowed = manifest.allowed_payments.some(
      (allowed) =>
        allowed.network === query.payment.network &&
        sameValue(allowed.asset, query.payment.asset) &&
        sameValue(allowed.pay_to, query.payment.pay_to),
    );
    checks.push({
      code: "PAYMENT_DESTINATION",
      status: destinationAllowed ? "PASS" : "FAIL",
      claimed: query.payment,
      observed: manifest.allowed_payments,
    });
    if (!destinationAllowed) {
      reasons.add("PAYMENT_DESTINATION_NOT_AUTHORIZED");
      hardFailures.add("PAYMENT_DESTINATION_NOT_AUTHORIZED");
    }
  }

  if (query.payment.resource_url) {
    const resourceMatches =
      normalizedOrigin(query.payment.resource_url) ===
      normalizedOrigin(query.service_url);
    checks.push({
      code: "PAYMENT_RESOURCE_ORIGIN",
      status: resourceMatches ? "PASS" : "FAIL",
      claimed: query.service_url,
      observed: query.payment.resource_url,
    });
    if (!resourceMatches) {
      reasons.add("PAYMENT_RESOURCE_ORIGIN_MISMATCH");
      hardFailures.add("PAYMENT_RESOURCE_ORIGIN_MISMATCH");
    }
  } else {
    reasons.add("PAYMENT_RESOURCE_URL_NOT_PROVIDED");
    checks.push({
      code: "PAYMENT_RESOURCE_ORIGIN",
      status: "REVIEW",
      claimed: query.service_url,
      observed: null,
    });
  }

  const mandate = query.mandate;
  if (!completeMandate(query)) {
    reasons.add("BUYER_MANDATE_INCOMPLETE");
    checks.push({
      code: "BUYER_MANDATE",
      status: "REVIEW",
      claimed: mandate ?? null,
      observed: "complete payment constraints required",
    });
  } else if (mandate) {
    const companyNumber = entity?.company_number ?? query.company_number ?? "";
    const violations = [
      BigInt(query.payment.amount) > BigInt(mandate.max_amount ?? "0") &&
        "amount",
      !mandate.allowed_networks?.includes(query.payment.network) && "network",
      !mandate.allowed_assets?.some((asset) =>
        sameValue(asset, query.payment.asset),
      ) && "asset",
      !mandate.allowed_pay_to?.some((address) =>
        sameValue(address, query.payment.pay_to),
      ) && "pay_to",
      !mandate.allowed_company_numbers?.some(
        (number) =>
          normalizeCompanyNumber(number) ===
          normalizeCompanyNumber(companyNumber),
      ) && "company_number",
    ].filter((value): value is string => Boolean(value));
    checks.push({
      code: "BUYER_MANDATE",
      status: violations.length ? "FAIL" : "PASS",
      claimed: mandate,
      observed: violations,
    });
    if (violations.length) {
      reasons.add("BUYER_MANDATE_VIOLATION");
      hardFailures.add("BUYER_MANDATE_VIOLATION");
    }
  }

  if (
    query.previous_payment_fingerprint &&
    !sameValue(query.previous_payment_fingerprint, fingerprint)
  ) {
    reasons.add("PAYMENT_TERMS_CHANGED");
    checks.push({
      code: "PAYMENT_FINGERPRINT",
      status: "REVIEW",
      claimed: query.previous_payment_fingerprint,
      observed: fingerprint,
    });
  } else {
    checks.push({
      code: "PAYMENT_FINGERPRINT",
      status: "PASS",
      claimed: query.previous_payment_fingerprint ?? null,
      observed: fingerprint,
    });
  }

  const action = hardFailures.size
    ? "DENY"
    : reasons.size === 0 &&
        manifestResolution.fetchedFromServiceDomain &&
        completeMandate(query)
      ? "ALLOW"
      : "REVIEW";
  const assuranceLevel =
    signatureValid && manifestResolution.fetchedFromServiceDomain && entity
      ? "LEVEL_2_REGISTRY"
      : signatureValid
        ? "LEVEL_1_SIGNED"
        : "LEVEL_0_UNVERIFIED";

  return {
    assessment_version: AGENT_PAYMENT_TRUST_VERSION,
    mode: "dry_run" as const,
    entity: entity
      ? {
          legal_name: entity.legal_name,
          company_number: entity.company_number,
          status: entity.status,
        }
      : null,
    payment_fingerprint: fingerprint,
    decision: {
      action,
      automation_safe: action === "ALLOW",
      assurance_level: assuranceLevel,
      reason_codes: [...reasons],
      explanation:
        action === "ALLOW"
          ? "The legal entity, domain-hosted signed manifest, payment destination, resource origin, and buyer mandate are consistent."
          : action === "DENY"
            ? `Payment should not be signed because hard failures were found: ${[...hardFailures].join(", ")}.`
            : `Human review is required before signing: ${[...reasons].join(", ")}.`,
    },
    checks,
    manifest: {
      mode: manifestResolution.mode,
      source_url: manifestResolution.sourceUrl,
      fetched_from_service_domain: manifestResolution.fetchedFromServiceDomain,
      signature_valid: signatureValid,
      signing_payload: manifest ? manifestSigningPayload(manifest) : null,
    },
    limitations: [
      "Dry-run only; this result never signs or submits a payment",
      "Level 1 or 2 does not prove legal ownership of the recipient wallet",
      "No bank-account ownership, invoice-authenticity, sanctions, PEP, UBO, adverse-media, or credit check is performed",
      "A buyer remains responsible for its payment policy and human-review thresholds",
    ],
    next_action: {
      proceed_to_payment: action === "ALLOW",
      human_review_required: action === "REVIEW",
      reason:
        action === "ALLOW"
          ? "The buyer policy may proceed to its own signing step."
          : action === "REVIEW"
            ? "Do not sign automatically; resolve the listed review reasons first."
            : "Do not sign or submit this payment.",
    },
    checked_at: now.toISOString(),
  } as const;
}
