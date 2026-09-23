const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const TRANSACTION_HASH = /^0x[a-fA-F0-9]{64}$/;

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

export type FirstExternalPaidCallRecord = {
  tx_hash: string;
  resource: string;
  route: string;
  network: string;
  amount_usdc: string;
  payer: string;
  timestamp: string;
  source: "env" | "process_memory";
  durable: boolean;
  note?: string;
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
  // eslint-disable-next-line no-var
  var __iciFirstExternalPaidCall: ObservedSettlement | undefined;
}

function routeFromResource(resource: string): string {
  try {
    return new URL(resource).pathname;
  } catch {
    return resource;
  }
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

export function getFirstExternalPaidCall(): FirstExternalPaidCallRecord | null {
  const fromEnv = envConfiguredFirstPaidCall();
  if (fromEnv) return fromEnv;
  const observed = globalThis.__iciFirstExternalPaidCall;
  if (!observed) return null;
  return {
    ...observed,
    route: routeFromResource(observed.resource),
    source: "process_memory",
    durable: false,
    note: "In-process observation only; lost on cold start. Set FIRST_EXTERNAL_PAID_CALL_TX (and optional companion env vars) for a durable operator-recorded milestone.",
  };
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

/**
 * Celebrate External Paid Call #1. Never invents a settlement: only runs when
 * createExternalPaidCallEvent already classified a non-internal Mainnet success.
 * Persistence is best-effort (process memory + optional operator env); Vercel
 * has no durable store wired in this MVP.
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

  // Env already records the durable milestone — still log loud observation.
  const existing = getFirstExternalPaidCall();
  if (existing?.source === "env") {
    console.info(
      JSON.stringify({
        event: "external_paid_call_after_recorded_first",
        recorded_first_tx: existing.tx_hash,
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

  globalThis.__iciFirstExternalPaidCall = {
    tx_hash: event.tx_hash,
    resource: event.resource,
    network: event.network,
    amount_usdc: event.amount_usdc,
    payer: event.payer,
    timestamp: event.timestamp,
  };

  const record = getFirstExternalPaidCall();
  if (!record) return null;

  console.info(
    JSON.stringify({
      event: "first_external_paid_call",
      milestone: "FIRST_EXTERNAL_PAID_CALL",
      celebration: true,
      ...record,
      operator_action:
        "Set FIRST_EXTERNAL_PAID_CALL_TX to this tx_hash in Vercel env for durable /health display across cold starts.",
    }),
  );

  await notifyFirstPaidCallWebhook(record);
  return record;
}
