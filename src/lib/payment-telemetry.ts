const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const TRANSACTION_HASH = /^0x[a-fA-F0-9]{64}$/;
const UPSTASH_KEY = "ici:first_external_paid_call";

export type SettlementTelemetryInput = {
  success: boolean;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  payer?: string;
  transaction: string;
  resource: string;
  expectedNetwork: string;
  expectedAsset: string;
  expectedAmount: string;
  expectedPayTo: string;
  expectedResource: string;
  internalPayers: Array<string | undefined>;
  discoverySource?: string;
  timestamp?: string;
};

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function cleanDiscoverySource(value?: string): string | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9._:/-]/g, "");
  return cleaned || null;
}

export type ExternalPaidCallEvent = {
  event: "external_paid_call";
  status: 200;
  settlement_status: "success";
  network: string;
  asset: string;
  payer: string;
  amount: string;
  amount_usdc: string;
  pay_to: string;
  tx_hash: string;
  resource: string;
  timestamp: string;
  discovery_source: string | null;
};

export function createExternalPaidCallEvent(
  input: SettlementTelemetryInput,
): ExternalPaidCallEvent | null {
  if (!input.success) return null;
  if (input.network !== input.expectedNetwork) return null;
  if (!sameAddress(input.asset, input.expectedAsset)) return null;
  if (input.amount !== input.expectedAmount) return null;
  if (!sameAddress(input.payTo, input.expectedPayTo)) return null;
  if (input.resource !== input.expectedResource) return null;
  if (!input.payer || !EVM_ADDRESS.test(input.payer)) return null;
  if (!TRANSACTION_HASH.test(input.transaction)) return null;
  // Never count a payment from the receiving/operator wallet as "external".
  if (sameAddress(input.payer, input.payTo)) return null;
  if (sameAddress(input.payer, input.expectedPayTo)) return null;
  if (
    input.internalPayers.some(
      (address) => address && sameAddress(input.payer as string, address),
    )
  ) {
    return null;
  }

  return {
    event: "external_paid_call",
    status: 200,
    settlement_status: "success",
    network: input.network,
    asset: input.asset,
    payer: input.payer,
    amount: input.amount,
    amount_usdc: (Number(input.amount) / 1_000_000).toFixed(6),
    pay_to: input.payTo,
    tx_hash: input.transaction,
    resource: input.resource,
    timestamp: input.timestamp ?? new Date().toISOString(),
    discovery_source: cleanDiscoverySource(input.discoverySource),
  };
}

export type FirstExternalPaidCallSource = "env" | "upstash" | "process_memory";

export type FirstExternalPaidCallRecord = {
  tx_hash: string;
  resource: string;
  route: string;
  network: string;
  amount_usdc: string;
  payer: string;
  timestamp: string;
  source: FirstExternalPaidCallSource;
  durable: boolean;
  note?: string;
  operator_env?: Record<string, string>;
};

type ObservedSettlement = {
  tx_hash: string;
  resource: string;
  network: string;
  amount_usdc: string;
  payer: string;
  timestamp: string;
};

declare global {
  var __iciFirstExternalPaidCall: ObservedSettlement | undefined;
  var __iciFirstExternalPaidNotifySent: boolean | undefined;
}

function routeFromResource(resource: string): string {
  try {
    return new URL(resource).pathname;
  } catch {
    return resource;
  }
}

function operatorEnvFromObserved(
  observed: ObservedSettlement,
): Record<string, string> {
  return {
    FIRST_EXTERNAL_PAID_CALL_TX: observed.tx_hash,
    FIRST_EXTERNAL_PAID_CALL_RESOURCE: observed.resource,
    FIRST_EXTERNAL_PAID_CALL_ROUTE: routeFromResource(observed.resource),
    FIRST_EXTERNAL_PAID_CALL_NETWORK: observed.network,
    FIRST_EXTERNAL_PAID_CALL_AMOUNT_USDC: observed.amount_usdc,
    FIRST_EXTERNAL_PAID_CALL_PAYER: observed.payer,
    FIRST_EXTERNAL_PAID_CALL_AT: observed.timestamp,
  };
}

function envConfiguredFirstPaidCall(): FirstExternalPaidCallRecord | null {
  const tx = process.env.FIRST_EXTERNAL_PAID_CALL_TX?.trim();
  if (!tx || !TRANSACTION_HASH.test(tx)) return null;
  return {
    tx_hash: tx,
    resource:
      process.env.FIRST_EXTERNAL_PAID_CALL_RESOURCE?.trim() || "unknown",
    route:
      process.env.FIRST_EXTERNAL_PAID_CALL_ROUTE?.trim() ||
      routeFromResource(
        process.env.FIRST_EXTERNAL_PAID_CALL_RESOURCE?.trim() || "",
      ) ||
      "unknown",
    network:
      process.env.FIRST_EXTERNAL_PAID_CALL_NETWORK?.trim() || "eip155:8453",
    amount_usdc:
      process.env.FIRST_EXTERNAL_PAID_CALL_AMOUNT_USDC?.trim() || "unknown",
    payer: process.env.FIRST_EXTERNAL_PAID_CALL_PAYER?.trim() || "unknown",
    timestamp: process.env.FIRST_EXTERNAL_PAID_CALL_AT?.trim() || "unknown",
    source: "env",
    durable: true,
  };
}

function upstashConfigured(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

function recordFromObserved(
  observed: ObservedSettlement,
  source: FirstExternalPaidCallSource,
  durable: boolean,
  note?: string,
): FirstExternalPaidCallRecord {
  return {
    ...observed,
    route: routeFromResource(observed.resource),
    source,
    durable,
    note,
    operator_env: durable ? undefined : operatorEnvFromObserved(observed),
  };
}

async function readUpstashFirstPaidCall(): Promise<ObservedSettlement | null> {
  const upstash = upstashConfigured();
  if (!upstash) return null;
  try {
    const response = await fetch(`${upstash.url}/get/${UPSTASH_KEY}`, {
      headers: { Authorization: `Bearer ${upstash.token}` },
      signal: AbortSignal.timeout(2_500),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { result?: string | null };
    if (!payload.result || typeof payload.result !== "string") return null;
    const parsed = JSON.parse(payload.result) as ObservedSettlement;
    if (
      !TRANSACTION_HASH.test(parsed.tx_hash) ||
      !EVM_ADDRESS.test(parsed.payer) ||
      !parsed.resource ||
      !parsed.network ||
      !parsed.amount_usdc ||
      !parsed.timestamp
    ) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "first_external_paid_call_upstash_read_failed",
        error_name: error instanceof Error ? error.name : "unknown",
      }),
    );
    return null;
  }
}

async function writeUpstashFirstPaidCall(
  observed: ObservedSettlement,
): Promise<boolean> {
  const upstash = upstashConfigured();
  if (!upstash) return false;
  try {
    // NX: only the first writer wins across instances/cold starts.
    // Use the Redis REST command body so JSON values stay intact.
    const response = await fetch(upstash.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstash.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        "SET",
        UPSTASH_KEY,
        JSON.stringify(observed),
        "NX",
      ]),
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { result?: string | null };
    return payload.result === "OK";
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "first_external_paid_call_upstash_write_failed",
        error_name: error instanceof Error ? error.name : "unknown",
      }),
    );
    return false;
  }
}

/** Sync getter for env + in-process memory (no network). Prefer async for health. */
export function getFirstExternalPaidCall(): FirstExternalPaidCallRecord | null {
  const fromEnv = envConfiguredFirstPaidCall();
  if (fromEnv) return fromEnv;
  const observed = globalThis.__iciFirstExternalPaidCall;
  if (!observed) return null;
  return recordFromObserved(
    observed,
    "process_memory",
    false,
    "In-process observation only; lost on cold start. Set FIRST_EXTERNAL_PAID_CALL_TX (and companion env vars) or configure Upstash REST for durable /health across cold starts.",
  );
}

/**
 * Durable-aware getter: env → Upstash (optional free tier) → process memory.
 * Health should use this so External Paid #1 survives cold starts when Upstash
 * or operator env is configured.
 */
export async function getFirstExternalPaidCallDurable(): Promise<FirstExternalPaidCallRecord | null> {
  const fromEnv = envConfiguredFirstPaidCall();
  if (fromEnv) return fromEnv;

  const fromUpstash = await readUpstashFirstPaidCall();
  if (fromUpstash) {
    globalThis.__iciFirstExternalPaidCall ??= fromUpstash;
    return recordFromObserved(
      fromUpstash,
      "upstash",
      true,
      "Durable via Upstash Redis REST. Optionally mirror into FIRST_EXTERNAL_PAID_CALL_TX for env-only operators.",
    );
  }

  return getFirstExternalPaidCall();
}

async function notifyFirstPaidCallWebhook(
  record: FirstExternalPaidCallRecord,
): Promise<void> {
  const url = process.env.FIRST_PAID_CALL_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "first_external_paid_call",
        ...record,
        notify_email: process.env.NOTIFY_EMAIL?.trim() || null,
      }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "first_external_paid_call_webhook_failed",
        error_name: error instanceof Error ? error.name : "unknown",
      }),
    );
  }
}

function emitStatusHook(record: FirstExternalPaidCallRecord): void {
  const notifyEmail = process.env.NOTIFY_EMAIL?.trim() || null;
  console.info(
    JSON.stringify({
      event: "first_external_paid_call",
      milestone: "FIRST_EXTERNAL_PAID_CALL",
      celebration: true,
      status_hook: "SCRAPE_THIS_FOR_OPERATOR_ENV",
      ...record,
      notify_email: notifyEmail,
      celebrate_email:
        notifyEmail == null
          ? "No NOTIFY_EMAIL configured; scrape this STATUS_HOOK / set FIRST_PAID_CALL_WEBHOOK_URL."
          : "NOTIFY_EMAIL set — deliver celebrate mail via FIRST_PAID_CALL_WEBHOOK_URL (no in-process SMTP).",
      operator_action:
        "Paste operator_env into Vercel Project → Settings → Environment Variables (Production), then redeploy. Or set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for automatic durable storage.",
      operator_env: record.operator_env ?? operatorEnvFromObserved(record),
    }),
  );
}

/**
 * Celebrate External Paid Call #1. Never invents a settlement: only runs when
 * createExternalPaidCallEvent already classified a non-internal Mainnet success
 * from a wallet that is not the receiving/operator payTo.
 *
 * Durability tiers (first match wins on read):
 * 1. FIRST_EXTERNAL_PAID_CALL_TX (+ companions) — operator env, always durable
 * 2. Upstash Redis REST (optional, zero-cost free tier) — automatic across cold starts
 * 3. Process memory — best-effort until cold start; STATUS_HOOK tells operator what to set
 */
export async function recordFirstExternalPaidCall(
  event: Pick<
    ExternalPaidCallEvent,
    "tx_hash" | "resource" | "network" | "amount_usdc" | "payer" | "timestamp"
  >,
): Promise<FirstExternalPaidCallRecord | null> {
  if (!TRANSACTION_HASH.test(event.tx_hash)) return null;
  if (!event.resource) return null;
  if (!event.network) return null;
  if (!event.amount_usdc) return null;
  if (!EVM_ADDRESS.test(event.payer)) return null;
  if (!event.timestamp) return null;

  const existing = await getFirstExternalPaidCallDurable();
  if (existing?.durable) {
    console.info(
      JSON.stringify({
        event: "external_paid_call_after_recorded_first",
        recorded_first_tx: existing.tx_hash,
        recorded_source: existing.source,
        tx_hash: event.tx_hash,
        resource: event.resource,
        timestamp: event.timestamp,
      }),
    );
    return existing;
  }

  if (globalThis.__iciFirstExternalPaidCall) {
    return getFirstExternalPaidCall();
  }

  const observed: ObservedSettlement = {
    tx_hash: event.tx_hash,
    resource: event.resource,
    network: event.network,
    amount_usdc: event.amount_usdc,
    payer: event.payer,
    timestamp: event.timestamp,
  };

  globalThis.__iciFirstExternalPaidCall = observed;

  const wroteUpstash = await writeUpstashFirstPaidCall(observed);
  const record = wroteUpstash
    ? recordFromObserved(
        observed,
        "upstash",
        true,
        "Durable via Upstash Redis REST (NX first-write).",
      )
    : recordFromObserved(
        observed,
        "process_memory",
        false,
        "In-process observation only; lost on cold start. Set FIRST_EXTERNAL_PAID_CALL_TX or configure Upstash REST for durable /health.",
      );

  if (!globalThis.__iciFirstExternalPaidNotifySent) {
    globalThis.__iciFirstExternalPaidNotifySent = true;
    emitStatusHook(record);
    await notifyFirstPaidCallWebhook(record);
  }

  return record;
}

/** Test helper: clear in-process first-paid observation. */
export function resetFirstExternalPaidCallForTests(): void {
  globalThis.__iciFirstExternalPaidCall = undefined;
  globalThis.__iciFirstExternalPaidNotifySent = undefined;
}
