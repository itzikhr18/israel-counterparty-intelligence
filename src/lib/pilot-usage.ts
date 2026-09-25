import { upstashConfigured } from "@/lib/payment-telemetry";
import type { PilotPartner, PilotTool } from "@/lib/pilot";

/**
 * Durable per-partner pilot metering on Upstash Redis REST (optional, free
 * tier). Two hashes per partner: a pilot-period total used to enforce the
 * partner's call allowance, and a calendar-month hash used for the invoice.
 * Without Upstash the caller falls back to the in-process safety cap and the
 * response says so (`durable: false`).
 */

const KEY_PREFIX = "ici:pilot:usage";
const REQUEST_TIMEOUT_MS = 2_500;

export function usageMonth(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function periodKey(partnerId: string): string {
  return `${KEY_PREFIX}:${partnerId}`;
}

function monthKey(partnerId: string, month: string): string {
  return `${KEY_PREFIX}:${partnerId}:${month}`;
}

type PipelineResult = Array<{ result?: unknown; error?: string }>;

async function pipeline(
  commands: Array<Array<string | number>>,
  eventOnFailure: string,
): Promise<PipelineResult | null> {
  const upstash = upstashConfigured();
  if (!upstash) return null;
  try {
    const response = await fetch(`${upstash.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstash.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(
        JSON.stringify({ event: eventOnFailure, status: response.status }),
      );
      return null;
    }
    const payload = (await response.json()) as PipelineResult;
    if (!Array.isArray(payload) || payload.some((entry) => entry.error)) {
      console.error(JSON.stringify({ event: eventOnFailure, status: "error" }));
      return null;
    }
    return payload;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: eventOnFailure,
        error_name: error instanceof Error ? error.name : "unknown",
      }),
    );
    return null;
  }
}

function integerResult(entry: { result?: unknown } | undefined): number {
  const value = Number(entry?.result);
  return Number.isFinite(value) ? value : 0;
}

export type PilotUsageReservation =
  | { durable: true; period_total: number; month: string; month_total: number }
  | { durable: false };

/** Increments the durable counters before the operation runs. */
export async function reservePilotUsage(
  partner: PilotPartner,
  tool: PilotTool,
): Promise<PilotUsageReservation> {
  const month = usageMonth();
  const period = periodKey(partner.partner_id);
  const monthly = monthKey(partner.partner_id, month);
  const results = await pipeline(
    [
      ["HINCRBY", period, "total", 1],
      ["HINCRBY", period, tool, 1],
      ["HINCRBY", monthly, "total", 1],
      ["HINCRBY", monthly, tool, 1],
    ],
    "pilot_usage_durable_write_failed",
  );
  if (!results) return { durable: false };
  return {
    durable: true,
    period_total: integerResult(results[0]),
    month: month,
    month_total: integerResult(results[2]),
  };
}

/** Reverses a reservation after a failed or rejected operation. */
export async function releasePilotUsage(
  partner: PilotPartner,
  tool: PilotTool,
  month: string = usageMonth(),
): Promise<void> {
  const period = periodKey(partner.partner_id);
  const monthly = monthKey(partner.partner_id, month);
  await pipeline(
    [
      ["HINCRBY", period, "total", -1],
      ["HINCRBY", period, tool, -1],
      ["HINCRBY", monthly, "total", -1],
      ["HINCRBY", monthly, tool, -1],
    ],
    "pilot_usage_durable_release_failed",
  );
}

export interface PilotUsageSnapshot {
  durable: boolean;
  period_total: number;
  by_tool: Record<string, number>;
  month: string;
  month_total: number;
  month_by_tool: Record<string, number>;
  note?: string;
}

function parseHash(entry: { result?: unknown } | undefined): {
  total: number;
  fields: Record<string, number>;
} {
  const raw = entry?.result;
  const fields: Record<string, number> = {};
  if (Array.isArray(raw)) {
    for (let index = 0; index + 1 < raw.length; index += 2) {
      const field = String(raw[index]);
      const value = Number(raw[index + 1]);
      if (field !== "total" && Number.isFinite(value)) fields[field] = value;
    }
    const totalIndex = raw.findIndex((value) => value === "total");
    const total = totalIndex >= 0 ? Number(raw[totalIndex + 1]) : 0;
    return { total: Number.isFinite(total) ? total : 0, fields };
  }
  return { total: 0, fields };
}

/** Reads the durable counters, or reports the in-process count when Upstash is not configured. */
export async function readPilotUsage(
  partner: PilotPartner,
  localCount: number,
  month: string = usageMonth(),
): Promise<PilotUsageSnapshot> {
  const results = upstashConfigured()
    ? await pipeline(
        [
          ["HGETALL", periodKey(partner.partner_id)],
          ["HGETALL", monthKey(partner.partner_id, month)],
        ],
        "pilot_usage_durable_read_failed",
      )
    : null;
  if (!results) {
    return {
      durable: false,
      period_total: localCount,
      by_tool: {},
      month,
      month_total: localCount,
      month_by_tool: {},
      note: "In-process count for this instance only. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for a durable, invoice-grade count.",
    };
  }
  const period = parseHash(results[0]);
  const monthly = parseHash(results[1]);
  return {
    durable: true,
    period_total: period.total,
    by_tool: period.fields,
    month,
    month_total: monthly.total,
    month_by_tool: monthly.fields,
  };
}
