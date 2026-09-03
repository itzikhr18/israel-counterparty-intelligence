import { createHash, randomUUID } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";

import { config } from "@/lib/config";
import { ApiError } from "@/lib/domain";
import { checkRateLimit } from "@/lib/http/rate-limit";

type Operation<TInput> = (query: TInput) => Promise<Record<string, unknown>>;

interface JsonHandlerOptions {
  clientClass?: "pilot";
  paymentStatus?: "pilot_waived";
  rateLimitKey?: (request: NextRequest, fingerprint: string) => string;
  responseHeaders?: () => Record<string, string>;
}

function fingerprint(request: NextRequest): string {
  const forwarded =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  return createHash("sha256")
    .update(`${forwarded}|${agent}`)
    .digest("hex")
    .slice(0, 16);
}

function isInternalTest(request: NextRequest): boolean {
  const supplied = request.headers.get("x-internal-test-token");
  if (config.INTERNAL_TEST_TOKEN && supplied === config.INTERNAL_TEST_TOKEN)
    return true;
  const payment = request.headers.get("payment-signature");
  if (!payment) return false;
  try {
    const decoded = JSON.parse(
      Buffer.from(payment, "base64").toString("utf8"),
    ) as {
      payload?: { authorization?: { from?: unknown } };
    };
    const payer = decoded.payload?.authorization?.from;
    return (
      typeof payer === "string" &&
      [config.INTERNAL_TEST_PAYER, config.MAINNET_INTERNAL_TEST_PAYER].some(
        (address) => address && payer.toLowerCase() === address.toLowerCase(),
      )
    );
  } catch {
    return false;
  }
}

function sourceCalls(result: Record<string, unknown>): string[] {
  const evidence = result.evidence;
  if (!Array.isArray(evidence)) return [];
  return [
    ...new Set(
      evidence
        .map((item) =>
          item && typeof item === "object" && "source" in item
            ? String(item.source)
            : null,
        )
        .filter((source): source is string => Boolean(source)),
    ),
  ];
}

function logRequest(entry: Record<string, unknown>): void {
  console.info(JSON.stringify({ event: "api_request", ...entry }));
}

export function createJsonHandler<TInput>(
  endpoint: string,
  schema: ZodType<TInput>,
  operation: Operation<TInput>,
  options: JsonHandlerOptions = {},
) {
  return async function handler(request: NextRequest): Promise<NextResponse> {
    const startedAt = performance.now();
    const requestId = randomUUID();
    const clientFingerprint = fingerprint(request);
    const internalTest = isInternalTest(request);
    const paymentPresent = request.headers.has("payment-signature");

    const clientClass =
      options.clientClass ?? (internalTest ? "internal_test" : "external");
    const paymentStatus =
      options.paymentStatus ??
      (paymentPresent
        ? "present"
        : config.X402_ENABLED
          ? "missing"
          : "disabled");
    const rate = checkRateLimit(
      options.rateLimitKey?.(request, clientFingerprint) ?? clientFingerprint,
    );
    if (!rate.allowed) {
      logRequest({
        request_id: requestId,
        endpoint,
        status: 429,
        duration_ms: Math.round(performance.now() - startedAt),
        external_client_fingerprint: clientFingerprint,
        client_class: clientClass,
        payment_status: paymentStatus,
        error_category: "RATE_LIMITED",
      });
      return NextResponse.json(
        {
          request_id: requestId,
          error: { code: "RATE_LIMITED", message: "Too many requests" },
        },
        {
          status: 429,
          headers: { "retry-after": String(rate.retryAfterSeconds) },
        },
      );
    }

    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        throw new ApiError(
          400,
          "INVALID_JSON",
          "Request body must be valid JSON",
        );
      }
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(
          400,
          "INVALID_INPUT",
          "Request validation failed",
          parsed.error.issues,
        );
      }

      const result = await operation(parsed.data);
      const response = { request_id: requestId, ...result };
      logRequest({
        request_id: requestId,
        endpoint,
        timestamp: new Date().toISOString(),
        duration_ms: Math.round(performance.now() - startedAt),
        status: 200,
        source_calls: sourceCalls(result),
        payment_status: paymentStatus,
        response_confidence: result.confidence ?? null,
        external_client_fingerprint: clientFingerprint,
        client_class: clientClass,
        error_category: null,
      });
      return NextResponse.json(response, {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "x-request-id": requestId,
          ...options.responseHeaders?.(),
        },
      });
    } catch (error) {
      const normalized =
        error instanceof ApiError
          ? error
          : new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred");
      logRequest({
        request_id: requestId,
        endpoint,
        timestamp: new Date().toISOString(),
        duration_ms: Math.round(performance.now() - startedAt),
        status: normalized.status,
        payment_status: paymentStatus,
        external_client_fingerprint: clientFingerprint,
        client_class: clientClass,
        error_category: normalized.code,
      });
      return NextResponse.json(
        {
          request_id: requestId,
          error: {
            code: normalized.code,
            message: normalized.message,
            details: normalized.details,
          },
        },
        {
          status: normalized.status,
          headers: {
            "cache-control": "no-store",
            "x-request-id": requestId,
            ...options.responseHeaders?.(),
          },
        },
      );
    }
  };
}
