import { createHash, timingSafeEqual } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";

import { config } from "@/lib/config";
import { ApiError } from "@/lib/domain";
import { createJsonHandler } from "@/lib/http/handler";

/**
 * Invitation-only partner pilot.
 *
 * A partner authenticates with a bearer key whose SHA-256 digest is configured
 * in `PILOT_KEYS` (JSON array, one entry per partner) or, for a single partner,
 * in the legacy `PILOT_TOKEN_SHA256` / `PILOT_PARTNER_ID` / `PILOT_EXPIRES_AT` /
 * `PILOT_VERIFICATION_LIMIT` variables. Payment is waived on the pilot routes;
 * every successful call is metered per partner through a `pilot_call` event so
 * the month-end invoice can be produced from centralized logs.
 */

export const PILOT_TOOLS = [
  "verify",
  "invoice_gate",
  "payment_risk",
  "company_changes",
] as const;
export type PilotTool = (typeof PILOT_TOOLS)[number];

export interface PilotPartner {
  readonly partner_id: string;
  readonly token_sha256: string;
  readonly expires_at: string;
  readonly call_limit: number;
}

export const PILOT_QUOTA_ENFORCEMENT =
  "per-instance safety cap plus centralized pilot_call telemetry";

export const pilotPartners: readonly PilotPartner[] = config.PILOT_KEYS ?? [
  {
    partner_id: config.PILOT_PARTNER_ID,
    token_sha256: config.PILOT_TOKEN_SHA256,
    expires_at: config.PILOT_EXPIRES_AT,
    call_limit: config.PILOT_VERIFICATION_LIMIT,
  },
];

export function pilotMetadata(partner: PilotPartner) {
  return {
    partner_id: partner.partner_id,
    expires_at: partner.expires_at,
    call_limit: partner.call_limit,
    tools: PILOT_TOOLS,
    quota_enforcement: PILOT_QUOTA_ENFORCEMENT,
  } as const;
}

function suppliedBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

function matchPartner(token: string): PilotPartner | null {
  const suppliedHash = createHash("sha256").update(token).digest();
  let matched: PilotPartner | null = null;
  // Compare against every configured digest so the response time does not
  // reveal which partner entry (if any) matched.
  for (const partner of pilotPartners) {
    const expectedHash = Buffer.from(partner.token_sha256, "hex");
    const equal =
      expectedHash.length === suppliedHash.length &&
      timingSafeEqual(suppliedHash, expectedHash);
    if (equal && !matched) matched = partner;
  }
  return matched;
}

export type PilotAuthorization =
  { ok: true; partner: PilotPartner } | { ok: false; response: NextResponse };

export function authorizePilotRequest(
  request: NextRequest,
): PilotAuthorization {
  const token = suppliedBearerToken(request);
  const partner = token ? matchPartner(token) : null;
  if (!partner) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "PILOT_UNAUTHORIZED",
            message: "A valid pilot bearer key is required",
          },
        },
        {
          status: 401,
          headers: {
            "cache-control": "no-store",
            "www-authenticate":
              'Bearer realm="Israel Counterparty Intelligence partner pilot"',
          },
        },
      ),
    };
  }

  if (Date.now() >= Date.parse(partner.expires_at)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "PILOT_EXPIRED",
            message: "This pilot access period has ended",
          },
        },
        {
          status: 410,
          headers: {
            "cache-control": "no-store",
            ...pilotResponseHeaders(partner),
          },
        },
      ),
    };
  }

  return { ok: true, partner };
}

export function pilotResponseHeaders(
  partner: PilotPartner,
): Record<string, string> {
  return {
    "x-pilot-partner": partner.partner_id,
    "x-pilot-expires-at": partner.expires_at,
    "x-pilot-call-limit": String(partner.call_limit),
  };
}

const localUsage = new Map<string, number>();

/**
 * Runs one pilot operation under the partner's call allowance.
 *
 * The in-process counter is a safety cap for a single serverless instance; the
 * authoritative usage total is the centralized count of successful `pilot_call`
 * events. Failed operations do not consume the allowance.
 */
export async function runPilotOperation<T extends Record<string, unknown>>(
  partner: PilotPartner,
  tool: PilotTool,
  operation: () => Promise<T>,
): Promise<T & { pilot: ReturnType<typeof pilotMetadata> }> {
  const previous = localUsage.get(partner.partner_id) ?? 0;
  if (previous >= partner.call_limit) {
    throw new ApiError(
      429,
      "PILOT_QUOTA_EXHAUSTED",
      "The pilot call allowance for this partner has been reached",
    );
  }

  const localSequence = previous + 1;
  localUsage.set(partner.partner_id, localSequence);
  const startedAt = performance.now();
  const log = (status: "success" | "failed") =>
    console.info(
      JSON.stringify({
        event: "pilot_call",
        timestamp: new Date().toISOString(),
        partner_id: partner.partner_id,
        tool,
        status,
        local_sequence: localSequence,
        call_limit: partner.call_limit,
        duration_ms: Math.round(performance.now() - startedAt),
      }),
    );

  try {
    const result = await operation();
    log("success");
    return { ...result, pilot: pilotMetadata(partner) };
  } catch (error) {
    localUsage.set(partner.partner_id, previous);
    log("failed");
    throw error;
  }
}

/**
 * Builds a POST handler for a REST pilot route: bearer authorization first,
 * then the shared JSON handler with the partner's rate-limit bucket, response
 * headers, and metered execution.
 */
export function createPilotRoute<TInput>(
  endpoint: string,
  schema: ZodType<TInput>,
  tool: PilotTool,
  operation: (query: TInput) => Promise<Record<string, unknown>>,
) {
  return async function POST(request: NextRequest): Promise<Response> {
    const authorization = authorizePilotRequest(request);
    if (!authorization.ok) return authorization.response;
    const { partner } = authorization;
    const handler = createJsonHandler(
      endpoint,
      schema,
      (query) => runPilotOperation(partner, tool, () => operation(query)),
      {
        clientClass: "pilot",
        paymentStatus: "pilot_waived",
        rateLimitKey: () => `pilot:${partner.partner_id}`,
        responseHeaders: () => pilotResponseHeaders(partner),
      },
    );
    return handler(request);
  };
}
