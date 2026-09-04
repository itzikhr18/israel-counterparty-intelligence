const bazaarMcp = "https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp";
const endpoints = [
  "/v1/invoice-gate/mainnet",
  "/v1/company-changes/mainnet",
  "/v1/verify/mainnet",
  "/v1/payment-risk/mainnet",
].map((path) => `https://israel-counterparty-intelligence.vercel.app${path}`);

async function validateEndpoint(url) {
  const response = await fetch(bazaarMcp, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: url,
      method: "tools/call",
      params: {
        name: "validate_endpoint",
        arguments: { url, method: "POST" },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Bazaar MCP returned HTTP ${response.status} for ${url}`);
  }
  const rpc = await response.json();
  if (rpc.error) throw new Error(`${url}: ${rpc.error.message}`);
  const text = rpc.result?.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error(`${url}: Bazaar returned no validation result`);
  return JSON.parse(text);
}

const results = await Promise.all(
  endpoints.map(async (url) => ({ url, ...(await validateEndpoint(url)) })),
);
const summary = results.map((result) => ({
  url: result.url,
  valid: result.valid,
  accepted: result.simulate?.outcome === "accepted",
  indexed: result.indexed,
  active: result.active,
  lastCrawledAt: result.lastCrawledAt ?? null,
  rejectedReason: result.simulate?.rejectedReason ?? null,
}));

console.log(JSON.stringify(summary, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  const rows = summary
    .map(
      (item) =>
        `| ${item.url} | ${item.valid} | ${item.accepted} | ${item.indexed} | ${item.active} |`,
    )
    .join("\n");
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## Coinbase Bazaar readiness\n\n| Endpoint | Valid | Accepted | Indexed | Active |\n|---|---:|---:|---:|---:|\n${rows}\n`,
  );
}

if (summary.some((item) => !item.valid || !item.accepted)) {
  process.exitCode = 1;
}
