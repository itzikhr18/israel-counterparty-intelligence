import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = process.env.MCP_URL ?? "http://localhost:3000/mcp";
const expectedNetwork = process.env.EXPECTED_X402_NETWORK;
const expectedAmount = process.env.EXPECTED_X402_AMOUNT ?? "50000";
const expectedPaymentRiskAmount =
  process.env.EXPECTED_X402_PAYMENT_RISK_AMOUNT ?? "100000";
const expectedInvoiceGateAmount =
  process.env.EXPECTED_X402_INVOICE_GATE_AMOUNT ?? "250000";
const expectedCompanyChangesAmount =
  process.env.EXPECTED_X402_COMPANY_CHANGES_AMOUNT ?? "10000";
const expectedAsset = process.env.EXPECTED_X402_ASSET;
const expectedPayTo = process.env.EXPECTED_X402_PAY_TO;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const client = new Client(
  { name: "israel-bi-mcp-smoke", version: "1.0.0" },
  { capabilities: {} },
);
const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: { headers: { "x-discovery-source": "internal-mcp-smoke" } },
});

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort();
  assert(
    JSON.stringify(names) ===
      JSON.stringify([
        "assess_israeli_vendor_payment_risk_paid",
        "authorize_israeli_invoice_payment_paid",
        "describe_service",
        "get_israeli_company_changes_paid",
        "get_sample_verification_report",
        "get_schema",
        "preview_agent_payment_trust",
        "preview_company",
        "preview_israeli_company_free",
        "preview_israeli_invoice_payment_gate_free",
        "preview_israeli_vendor_payment_risk_free",
        "verify_company",
        "verify_israeli_company_paid",
      ]),
    `Unexpected tools: ${names.join(", ")}`,
  );

  const description = await client.callTool({
    name: "describe_service",
    arguments: {},
  });
  assert(!description.isError, "describe_service failed");
  assert(
    description.structuredContent?.name === "Israel Business Intelligence MCP",
    "Bad service description",
  );

  const schema = await client.callTool({ name: "get_schema", arguments: {} });
  assert(!schema.isError, "get_schema failed");
  assert(
    schema.structuredContent?.tool === "verify_company",
    "get_schema returned the wrong tool",
  );

  const sample = await client.callTool({
    name: "get_sample_verification_report",
    arguments: {},
  });
  assert(!sample.isError, "get_sample_verification_report failed");
  assert(
    sample.structuredContent?.sample === true,
    "sample report was not marked as a sample",
  );
  assert(
    sample.structuredContent?.live_lookup === false,
    "sample report claimed to be live",
  );

  const preview = await client.callTool({
    name: "preview_israeli_company_free",
    arguments: { company_number: "514744887", language: "en" },
  });
  assert(!preview.isError, "preview_company failed");
  assert(
    preview.structuredContent?.mode === "free_preview",
    "preview_company returned full data",
  );
  assert(
    preview.structuredContent?.next_action?.tool === "company_changes",
    "preview_company did not recommend the paid next tool",
  );
  assert(
    preview.structuredContent?.next_action?.preferred_tool ===
      "get_israeli_company_changes_paid",
    "preview did not identify the preferred paid tool",
  );
  assert(
    preview.structuredContent?.next_action?.arguments?.company_number ===
      "514744887",
    "preview_company did not return reusable resolved arguments",
  );

  const paymentRiskArguments = {
    company_number: "514744887",
    invoice_company_number: "514744887",
    invoice_company_name: "מנדיי. קום בעמ",
    language: "en",
  };
  const invoiceGateArguments = {
    supplier_company_number: "514744887",
    supplier_name: "מנדיי. קום בעמ",
    invoice_number: "INV-2026-001",
    invoice_date: "2026-09-04",
    amount_before_vat: 6000,
    vat_amount: 1080,
    total_amount: 7080,
    buyer_is_authorized_dealer: true,
    buyer_requested_allocation_number: true,
    allocation_number: "123456789",
    language: "en",
  };
  const invoiceGatePreview = await client.callTool({
    name: "preview_israeli_invoice_payment_gate_free",
    arguments: invoiceGateArguments,
  });
  assert(!invoiceGatePreview.isError, "invoice-gate preview failed");
  assert(
    invoiceGatePreview.structuredContent?.decision?.action === "HOLD",
    "invoice-gate preview did not fail closed",
  );
  const paymentRiskPreview = await client.callTool({
    name: "preview_israeli_vendor_payment_risk_free",
    arguments: paymentRiskArguments,
  });
  assert(!paymentRiskPreview.isError, "payment-risk preview failed");
  assert(
    paymentRiskPreview.structuredContent?.resolution_status === "RESOLVED",
    "payment-risk preview did not resolve the company",
  );

  const paymentTrust = await client.callTool({
    name: "preview_agent_payment_trust",
    arguments: {
      company_number: "514744887",
      service_url: "https://merchant.example/pay",
      payment: {
        network: "eip155:8453",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amount: "50000",
        pay_to: "0x1111111111111111111111111111111111111111",
        resource_url: "https://merchant.example/pay",
      },
      manifest_mode: "none",
    },
  });
  assert(!paymentTrust.isError, "agent payment trust preview failed");
  assert(
    paymentTrust.structuredContent?.decision?.action === "REVIEW" &&
      paymentTrust.structuredContent?.decision?.automation_safe === false,
    "agent payment trust preview did not fail closed",
  );

  const unpaid = await client.callTool({
    name: "verify_israeli_company_paid",
    arguments: { company_number: "514744887", language: "en" },
  });
  assert(unpaid.isError === true, "verify_company did not require payment");
  const challenge = unpaid.structuredContent;
  assert(challenge?.x402Version === 2, "MCP challenge is not x402 v2");
  const requirement = challenge.accepts?.[0];
  assert(
    requirement?.amount === expectedAmount,
    `Unexpected amount ${requirement?.amount}`,
  );
  if (expectedNetwork)
    assert(
      requirement?.network === expectedNetwork,
      `Unexpected network ${requirement?.network}`,
    );
  if (expectedAsset)
    assert(
      requirement?.asset === expectedAsset,
      `Unexpected asset ${requirement?.asset}`,
    );
  if (expectedPayTo)
    assert(
      requirement?.payTo === expectedPayTo,
      `Unexpected payTo ${requirement?.payTo}`,
    );
  assert(
    challenge.extensions?.bazaar,
    "MCP Bazaar discovery extension is missing",
  );
  assert(
    challenge.extensions.bazaar.info?.input?.toolName === "verify_company",
    "MCP Bazaar metadata has the wrong tool name",
  );

  const unpaidPaymentRisk = await client.callTool({
    name: "assess_israeli_vendor_payment_risk_paid",
    arguments: paymentRiskArguments,
  });
  assert(
    unpaidPaymentRisk.isError === true,
    "payment-risk tool did not require payment",
  );
  const paymentRiskRequirement =
    unpaidPaymentRisk.structuredContent?.accepts?.[0];
  assert(
    paymentRiskRequirement?.amount === expectedPaymentRiskAmount,
    `Unexpected payment-risk amount ${paymentRiskRequirement?.amount}`,
  );
  if (expectedNetwork)
    assert(
      paymentRiskRequirement?.network === expectedNetwork,
      `Unexpected payment-risk network ${paymentRiskRequirement?.network}`,
    );

  const unpaidCompanyChanges = await client.callTool({
    name: "get_israeli_company_changes_paid",
    arguments: {
      company_number: "514744887",
      lookback_days: 366,
      limit: 25,
      language: "en",
    },
  });
  assert(
    unpaidCompanyChanges.isError === true,
    "company-changes tool did not require payment",
  );
  const companyChangesRequirement =
    unpaidCompanyChanges.structuredContent?.accepts?.[0];
  assert(
    companyChangesRequirement?.amount === expectedCompanyChangesAmount,
    `Unexpected company-changes amount ${companyChangesRequirement?.amount}`,
  );
  if (expectedNetwork)
    assert(
      companyChangesRequirement?.network === expectedNetwork,
      `Unexpected company-changes network ${companyChangesRequirement?.network}`,
    );

  const unpaidInvoiceGate = await client.callTool({
    name: "authorize_israeli_invoice_payment_paid",
    arguments: invoiceGateArguments,
  });
  assert(
    unpaidInvoiceGate.isError === true,
    "invoice-gate tool did not require payment",
  );
  const invoiceGateRequirement =
    unpaidInvoiceGate.structuredContent?.accepts?.[0];
  assert(
    invoiceGateRequirement?.amount === expectedInvoiceGateAmount,
    `Unexpected invoice-gate amount ${invoiceGateRequirement?.amount}`,
  );
  if (expectedNetwork)
    assert(
      invoiceGateRequirement?.network === expectedNetwork,
      `Unexpected invoice-gate network ${invoiceGateRequirement?.network}`,
    );

  console.log(
    JSON.stringify({
      status: "ok",
      endpoint,
      initialized: true,
      tools: names,
      freeTools: [
        "describe_service",
        "get_sample_verification_report",
        "get_schema",
        "preview_agent_payment_trust",
        "preview_company",
        "preview_israeli_company_free",
        "preview_israeli_invoice_payment_gate_free",
        "preview_israeli_vendor_payment_risk_free",
      ],
      previewNextAction: preview.structuredContent?.next_action,
      paymentRequired: requirement,
      paymentRiskRequired: paymentRiskRequirement,
      companyChangesRequired: companyChangesRequirement,
      invoiceGateRequired: invoiceGateRequirement,
    }),
  );
} finally {
  await client.close();
}
