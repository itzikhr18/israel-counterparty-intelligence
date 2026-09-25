import { type NextRequest, NextResponse } from "next/server";

import { config } from "@/lib/config";
import { checkRateLimit } from "@/lib/http/rate-limit";
import {
  authorizePilotRequest,
  localPilotUsage,
  PILOT_TOOLS,
  type PilotPartner,
  pilotPartners,
  pilotResponseHeaders,
} from "@/lib/pilot";
import { readPilotUsage, usageMonth } from "@/lib/pilot-usage";

const NO_STORE = { "cache-control": "no-store" };

async function partnerUsage(partner: PilotPartner) {
  return {
    partner_id: partner.partner_id,
    expires_at: partner.expires_at,
    call_limit: partner.call_limit,
    tools: PILOT_TOOLS,
    usage: await readPilotUsage(partner, localPilotUsage(partner.partner_id)),
  };
}

function operatorAuthorized(request: NextRequest): boolean {
  const supplied = request.headers.get("x-internal-test-token");
  return Boolean(
    config.INTERNAL_TEST_TOKEN && supplied === config.INTERNAL_TEST_TOKEN,
  );
}

/**
 * GET /v1/pilot/usage
 * - Partner key: that partner's allowance and usage (durable when Upstash is set).
 * - Operator token (x-internal-test-token): every partner, for month-end invoicing.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const authorization = authorizePilotRequest(request);
  if (authorization.ok) {
    const { partner } = authorization;
    const rate = checkRateLimit(`pilot:${partner.partner_id}`);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        {
          status: 429,
          headers: {
            ...NO_STORE,
            "retry-after": String(rate.retryAfterSeconds),
            ...pilotResponseHeaders(partner),
          },
        },
      );
    }
    return NextResponse.json(await partnerUsage(partner), {
      headers: { ...NO_STORE, ...pilotResponseHeaders(partner) },
    });
  }

  if (operatorAuthorized(request)) {
    const partners = await Promise.all(pilotPartners.map(partnerUsage));
    return NextResponse.json(
      { operator_view: true, month: usageMonth(), partners },
      { headers: NO_STORE },
    );
  }

  return authorization.response;
}
