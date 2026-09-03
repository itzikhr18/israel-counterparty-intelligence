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

export function createExternalPaidCallEvent(
  input: SettlementTelemetryInput,
): Record<string, unknown> | null {
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
