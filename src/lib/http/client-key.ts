import { createHash } from "node:crypto";
import { isIP } from "node:net";

/** Proxy must replace X-Forwarded-For. This is a local abuse guard, not identity/auth. */
export function rateLimitClientKey(request: Request): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const address = forwarded && isIP(forwarded) ? forwarded : "unknown";
  // User-Agent is caller-controlled and must not let a caller reset its allowance.
  return createHash("sha256").update(address).digest("hex");
}
