import { createHash, timingSafeEqual } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { config } from "@/lib/config";
import type { CounterpartyQuery } from "@/lib/domain";
import { ApiError } from "@/lib/domain";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

const localUsage = new Map<string, number>();

export const pilotMetadata = {
  partner_id: config.PILOT_PARTNER_ID,
  expires_at: config.PILOT_EXPIRES_AT,
  verification_limit: config.PILOT_VERIFICATION_LIMIT,
  quota_enforcement: "per-instance safety cap plus centralized usage telemetry",
} as const;

function suppliedBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

function validToken(token: string): boolean {
  const suppliedHash = createHash("sha256").update(token).digest();
  const expectedHash = Buffer.from(config.PILOT_TOKEN_SHA256, "hex");
  return (
    suppliedHash.length === expectedHash.length &&
    timingSafeEqual(suppliedHash, expectedHash)
  );
}

export function authorizePilotRequest(
  request: NextRequest,
): NextResponse | null {
  const token = suppliedBearerToken(request);
  if (!token || !validToken(token)) {
    return NextResponse.json(
      {
        error: {
          code: "PILOT_UNAUTHORIZED",
          message: "A valid pilot bearer token is required",
        },
      },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
          "www-authenticate":
            'Bearer realm="Israel Business Intelligence pilot"',
        },
      },
    );
  }

  if (Date.now() >= Date.parse(config.PILOT_EXPIRES_AT)) {
    return NextResponse.json(
      {
        error: {
          code: "PILOT_EXPIRED",
          message: "This pilot access period has ended",
        },
      },
      { status: 410, headers: { "cache-control": "no-store" } },
    );
  }

  return null;
}

export function pilotResponseHeaders(): Record<string, string> {
  return {
    "x-pilot-partner": config.PILOT_PARTNER_ID,
    "x-pilot-expires-at": config.PILOT_EXPIRES_AT,
    "x-pilot-verification-limit": String(config.PILOT_VERIFICATION_LIMIT),
  };
}

export async function runPilotVerification(
  query: CounterpartyQuery,
): Promise<Record<string, unknown>> {
  const previous = localUsage.get(config.PILOT_PARTNER_ID) ?? 0;
  if (previous >= config.PILOT_VERIFICATION_LIMIT) {
    throw new ApiError(
      429,
      "PILOT_QUOTA_EXHAUSTED",
      "The pilot verification allowance has been reached",
    );
  }

  const localSequence = previous + 1;
  localUsage.set(config.PILOT_PARTNER_ID, localSequence);
  const startedAt = performance.now();

  try {
    const result = await counterpartyOrchestrator.verify(query);
    console.info(
      JSON.stringify({
        event: "pilot_verification",
        timestamp: new Date().toISOString(),
        partner_id: config.PILOT_PARTNER_ID,
        status: "success",
        local_sequence: localSequence,
        verification_limit: config.PILOT_VERIFICATION_LIMIT,
        duration_ms: Math.round(performance.now() - startedAt),
      }),
    );
    return { ...result, pilot: pilotMetadata };
  } catch (error) {
    localUsage.set(config.PILOT_PARTNER_ID, previous);
    console.info(
      JSON.stringify({
        event: "pilot_verification",
        timestamp: new Date().toISOString(),
        partner_id: config.PILOT_PARTNER_ID,
        status: "failed",
        local_sequence: localSequence,
        verification_limit: config.PILOT_VERIFICATION_LIMIT,
        duration_ms: Math.round(performance.now() - startedAt),
      }),
    );
    throw error;
  }
}
