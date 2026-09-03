import type { SourceErrorCode } from "@/lib/domain";

export class UpstreamError extends Error {
  constructor(
    public readonly source: string,
    public readonly code: SourceErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export interface FetchJsonOptions {
  source: string;
  timeoutMs: number;
  retries: number;
  init?: RequestInit;
}

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(url, {
        ...options.init,
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "user-agent": "IsraelCounterpartyIntelligence/0.1",
          ...options.init?.headers,
        },
      });

      if (!response.ok) {
        throw new UpstreamError(
          options.source,
          response.status >= 500 ? "UNAVAILABLE" : "INVALID_RESPONSE",
          `Upstream returned HTTP ${response.status}`,
          response.status >= 500 || response.status === 429,
          response.status,
        );
      }

      try {
        return (await response.json()) as T;
      } catch {
        throw new UpstreamError(
          options.source,
          "INVALID_RESPONSE",
          "Upstream returned invalid JSON",
          false,
          response.status,
        );
      }
    } catch (error) {
      lastError = error;
      const normalized =
        error instanceof UpstreamError
          ? error
          : new UpstreamError(
              options.source,
              error instanceof Error && error.name === "AbortError"
                ? "TIMEOUT"
                : "UNAVAILABLE",
              error instanceof Error && error.name === "AbortError"
                ? `Upstream timed out after ${options.timeoutMs}ms`
                : "Upstream request failed",
              true,
            );

      if (!normalized.retryable || attempt === options.retries)
        throw normalized;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}
