import { config } from "@/lib/config";

interface WindowState {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowState>();

export function checkRateLimit(key: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
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
