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

async function probeLiveEndpoint(url) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: "{}",
    });
    const paymentRequired = response.headers.get("payment-required");
    let bodySnippet = null;
    let errorCode = null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await response.json().catch(() => null);
      if (body && typeof body === "object") {
        errorCode = body.error?.code ?? null;
        bodySnippet = JSON.stringify(body).slice(0, 280);
      }
    } else {
      bodySnippet = (await response.text().catch(() => "")).slice(0, 280);
    }
    return {
      status: response.status,
      paymentRequiredPresent: Boolean(paymentRequired),
      errorCode,
      bodySnippet,
    };
  } catch (error) {
    return {
      status: null,
      paymentRequiredPresent: false,
      errorCode: null,
      bodySnippet: String(error),
    };
  }
}

function failedPreflight(result) {
  return (result.preflight ?? [])
    .filter((item) => item.severity === "required" && item.passed === false)
    .map((item) => ({
      check: item.check,
      detail: item.detail,
      expected: item.expected ?? null,
      actual: item.actual ?? null,
    }));
}

const results = await Promise.all(
  endpoints.map(async (url) => {
    const [validation, live] = await Promise.all([
      validateEndpoint(url),
      probeLiveEndpoint(url),
    ]);
    return { url, live, ...validation };
  }),
);

const summary = results.map((result) => ({
  url: result.url,
  valid: result.valid,
  accepted: result.simulate?.outcome === "accepted",
  indexed: result.indexed,
  active: result.active,
  lastCrawledAt: result.lastCrawledAt ?? null,
  rejectedReason: result.simulate?.rejectedReason ?? null,
  bazaarStatusCode: result.statusCode ?? null,
  returns402: result.returns402 ?? null,
  liveStatus: result.live.status,
  liveErrorCode: result.live.errorCode,
  livePaymentRequiredHeader: result.live.paymentRequiredPresent,
  failedRequiredPreflight: failedPreflight(result),
}));

console.log(JSON.stringify(summary, null, 2));

const suspended = summary.every(
  (item) =>
    item.liveStatus === 503 && item.liveErrorCode === "PAID_SERVICE_SUSPENDED",
);
const missing402 = summary.some(
  (item) =>
    item.failedRequiredPreflight.some((check) => check.check === "returns_402"),
);

if (suspended) {
  console.error(
    "Root cause: live paid Mainnet routes return HTTP 503 PAID_SERVICE_SUSPENDED instead of HTTP 402 with PAYMENT-REQUIRED. Coinbase Bazaar preflight requires 402. Paid service is currently hard-suspended in src/lib/service-availability.ts (see docs/SECURITY_CONTAINMENT_2026-09-07.md and docs/BAZAAR_RESUME_CHECKLIST.md). Do not flip the flag without commercial-readiness approval.",
  );
} else if (missing402) {
  console.error(
    "Root cause: one or more endpoints did not return HTTP 402 with a valid x402 payment challenge. Inspect failedRequiredPreflight and liveStatus in the JSON summary above.",
  );
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  const rows = summary
    .map(
      (item) =>
        `| ${item.url} | ${item.valid} | ${item.accepted} | ${item.indexed} | ${item.active} | ${item.liveStatus} | ${item.liveErrorCode ?? ""} |`,
    )
    .join("\n");
  const preflightNotes = summary
    .map((item) => {
      if (!item.failedRequiredPreflight.length) return null;
      const details = item.failedRequiredPreflight
        .map((check) => `${check.check}: ${check.detail}`)
        .join("<br>");
      return `- ${item.url}<br>${details}`;
    })
    .filter(Boolean)
    .join("\n");
  const diagnosis = suspended
    ? "\n**Diagnosis:** paid Mainnet routes are hard-suspended (`PAID_SERVICE_SUSPENDED`). Bazaar expects HTTP 402; live routes return HTTP 503. See `docs/BAZAAR_RESUME_CHECKLIST.md`.\n"
    : missing402
      ? "\n**Diagnosis:** required `returns_402` preflight failed. Inspect live status and payment headers.\n"
      : "\n";
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## Coinbase Bazaar readiness\n\n| Endpoint | Valid | Accepted | Indexed | Active | Live status | Live error |\n|---|---:|---:|---:|---:|---:|---|\n${rows}\n${diagnosis}\n### Failed required preflight\n\n${preflightNotes || "_none_"}\n`,
  );
}

if (summary.some((item) => !item.valid || !item.accepted)) {
  process.exitCode = 1;
}
