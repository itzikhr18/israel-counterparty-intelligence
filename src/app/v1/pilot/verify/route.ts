import { type NextRequest } from "next/server";

import { config } from "@/lib/config";
import { counterpartyQuerySchema } from "@/lib/domain";
import { createJsonHandler } from "@/lib/http/handler";
import {
  authorizePilotRequest,
  pilotResponseHeaders,
  runPilotVerification,
} from "@/lib/pilot";

const handler = createJsonHandler(
  "/v1/pilot/verify",
  counterpartyQuerySchema,
  runPilotVerification,
  {
    clientClass: "pilot",
    paymentStatus: "pilot_waived",
    rateLimitKey: () => `pilot:${config.PILOT_PARTNER_ID}`,
    responseHeaders: pilotResponseHeaders,
  },
);

export async function POST(request: NextRequest) {
  return authorizePilotRequest(request) ?? handler(request);
}
