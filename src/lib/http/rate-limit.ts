import { config } from "@/lib/config";

interface WindowState {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowState>();
export const MAX_RATE_LIMIT_KEYS = 10_000;
let nextSweepAt = 0;

export function checkRateLimit(key: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  if (now >= nextSweepAt || windows.size >= MAX_RATE_LIMIT_KEYS) {
    for (const [entryKey, state] of windows) {
      if (state.resetAt <= now) windows.delete(entryKey);
    }
    nextSweepAt = now + config.RATE_LIMIT_WINDOW_SECONDS * 1000;
  }
  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    // Fail closed for new identities while full; do not evict an active limit.
    if (!existing && windows.size >= MAX_RATE_LIMIT_KEYS) {
      return {
        allowed: false,
        retryAfterSeconds: config.RATE_LIMIT_WINDOW_SECONDS,
      };
    }
    windows.set(key, {
      count: 1,
      resetAt: now + config.RATE_LIMIT_WINDOW_SECONDS * 1000,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count <= config.RATE_LIMIT_REQUESTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}
