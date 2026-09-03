import fs from "node:fs";

import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapMCPClientWithPayment } from "@x402/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { privateKeyToAccount } from "viem/accounts";

const walletFile = process.env.X402_TEST_WALLET_FILE;
if (!walletFile) throw new Error("X402_TEST_WALLET_FILE is required");

const endpoint =
  process.env.MCP_URL ??
  "https://israel-counterparty-intelligence.vercel.app/mcp/testnet";
if (!endpoint.endsWith("/mcp/testnet"))
  throw new Error("Paid MCP smoke is restricted to /mcp/testnet");

const privateKey = JSON.parse(fs.readFileSync(walletFile, "utf8")).privateKey;
const account = privateKeyToAccount(privateKey);
const paymentClient = new x402Client();
registerExactEvmScheme(paymentClient, {
  signer: account,
  networks: ["eip155:84532"],
});

const client = new Client(
  { name: "israel-bi-mcp-internal-paid-smoke", version: "1.0.0" },
  { capabilities: {} },
);
const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: { headers: { "x-discovery-source": "internal-mcp-paid-smoke" } },
});

try {
  await client.connect(transport);
  const listed = await client.listTools();
  if (!listed.tools.some((tool) => tool.name === "verify_company")) {
    throw new Error("verify_company was not discovered");
  }

  const unpaid = await client.callTool({
    name: "verify_company",
    arguments: { company_number: "514744887", language: "en" },
  });
  if (!unpaid.isError || unpaid.structuredContent?.x402Version !== 2) {
    throw new Error("Expected an x402 v2 PaymentRequired tool result");
  }

  const paidClient = wrapMCPClientWithPayment(client, paymentClient, {
    autoPayment: true,
    onPaymentRequested: async ({ paymentRequired }) => {
      const selected = paymentRequired.accepts[0];
      return selected.network === "eip155:84532" && selected.amount === "50000";
    },
  });
  const result = await paidClient.callTool("verify_company", {
    company_number: "514744887",
    language: "en",
  });
  if (result.isError) throw new Error("Paid verify_company returned an error");
  if (!result.paymentMade || !result.paymentResponse?.success) {
    throw new Error("MCP payment did not settle successfully");
  }
  const body = JSON.parse(result.content[0]?.text ?? "{}");
  if (
    body.resolution_status !== "RESOLVED" ||
    body.resolved_entity?.company_number !== "514744887"
  ) {
    throw new Error(
      "Paid MCP result did not contain the expected company response",
    );
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        endpoint,
        payer: account.address,
        discovery: true,
        initialized: true,
        toolsList: true,
        paymentRequired: {
          x402Version: unpaid.structuredContent.x402Version,
          requirement: unpaid.structuredContent.accepts?.[0],
          bazaar: Boolean(unpaid.structuredContent.extensions?.bazaar),
        },
        settlement: result.paymentResponse,
        toolResult: {
          request_id: body.request_id,
          resolution_status: body.resolution_status,
          company_number: body.resolved_entity.company_number,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
