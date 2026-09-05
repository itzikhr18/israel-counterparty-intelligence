import { pathToFileURL } from "node:url";

export function summarizeRevenueFunnel(lines) {
  const counts = {};
  const seenLogs = new Set();
  const seenTransactions = new Set();
  let amount = 0n;
  let ignored = 0;
  let internal = 0;
  const times = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      ignored++;
      continue;
    }
    if (row.id && seenLogs.has(row.id)) continue;
    if (row.id) seenLogs.add(row.id);
    let event;
    try {
      event = typeof row.message === "string" ? JSON.parse(row.message) : row;
    } catch {
      ignored++;
      continue;
    }
    if (!event || typeof event.event !== "string") {
      ignored++;
      continue;
    }
    if (
      event.client_class === "internal_test" ||
      event.client_class === "pilot" ||
      event.discovery_source?.startsWith("internal-") ||
      event.environment === "testnet"
    ) {
      internal++;
      continue;
    }
    const time = Date.parse(event.timestamp);
    if (Number.isFinite(time)) times.push(time);
    if (event.event === "external_paid_call") {
      if (
        event.settlement_status !== "success" ||
        event.network !== "eip155:8453" ||
        event.asset?.toLowerCase() !==
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" ||
        !/^0x[a-fA-F0-9]{64}$/.test(event.tx_hash ?? "") ||
        !/^[1-9][0-9]{0,20}$/.test(event.amount ?? "")
      ) {
        ignored++;
        continue;
      }
      const transaction = event.tx_hash.toLowerCase();
      if (seenTransactions.has(transaction)) continue;
      seenTransactions.add(transaction);
      amount += BigInt(event.amount);
    }
    counts[event.event] = (counts[event.event] ?? 0) + 1;
  }
  return {
    scope:
      "Provided log rows only; retention and query limits may omit traffic. Events are not unique people. Gross receipts are not profit.",
    first_observed_event: times.length
      ? new Date(Math.min(...times)).toISOString()
      : null,
    last_observed_event: times.length
      ? new Date(Math.max(...times)).toISOString()
      : null,
    external_events: counts,
    observed_settled_transactions: seenTransactions.size,
    observed_gross_usdc:
      (amount / 1_000_000n).toString() +
      "." +
      (amount % 1_000_000n).toString().padStart(6, "0"),
    internal_or_pilot_rows_excluded: internal,
    unrecognized_rows: ignored,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  console.log(
    JSON.stringify(summarizeRevenueFunnel(input.split(/\r?\n/)), null, 2),
  );
}
