const bazaarMcp = "https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp";
const serviceOrigin = "https://israel-counterparty-intelligence.vercel.app";

const searches = [
  "verify Israeli company",
  "Israeli supplier verification",
  "Israel company registry",
  "Israel KYB",
  "Israeli vendor payment risk",
  "recent Israeli company changes",
  "Israel invoice payment gate",
  "Israeli invoice allocation number verification",
  "verify Israeli tax invoice before payment",
];

async function searchResources(query) {
  const response = await fetch(bazaarMcp, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: query,
      method: "tools/call",
      params: {
        name: "search_resources",
        arguments: {
          query,
          network: "eip155:8453",
          curatedOnly: false,
          limit: 20,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Bazaar MCP returned HTTP ${response.status} for ${query}`);
  }
  const rpc = await response.json();
  if (rpc.error) throw new Error(`${query}: ${rpc.error.message}`);
  const text = rpc.result?.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error(`${query}: Bazaar returned no search result`);
  return JSON.parse(text);
}

const results = await Promise.all(
  searches.map(async (query) => {
    const result = await searchResources(query);
    const tools = result.tools ?? [];
    const rank = tools.findIndex((tool) =>
      JSON.stringify(tool).includes(serviceOrigin),
    );
    const leader = tools[0]?._meta?.["x402/service"]?.name ?? null;
    return {
      query,
      rank: rank === -1 ? null : rank + 1,
      returned: tools.length,
      searchMethod: result.searchMethod ?? null,
      leader,
    };
  }),
);

console.log(JSON.stringify(results, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  const rows = results
    .map(
      (item) =>
        `| ${item.query} | ${item.rank ?? "Not indexed"} | ${item.returned} | ${item.leader ?? "—"} |`,
    )
    .join("\n");
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## Coinbase Bazaar buyer-intent rank\n\n| Query | Our rank | Results | Current leader |\n|---|---:|---:|---|\n${rows}\n`,
  );
}

if (
  process.env.BAZAAR_REQUIRE_INDEXED === "true" &&
  results.some((item) => item.rank === null)
) {
  process.exitCode = 1;
}
