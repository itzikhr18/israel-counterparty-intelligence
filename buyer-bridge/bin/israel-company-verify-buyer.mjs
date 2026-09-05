#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createx402MCPClient } from "@x402/mcp";
import { privateKeyToAccount } from "viem/accounts";

import { enforceAgentPaymentTrust } from "../lib/pre-sign-policy.mjs";
import {
  acceptsCappedPayment,
  enforceInvoicePreview,
  readInvoiceFile,
  INVOICE_PREVIEW_TOOL,
  INVOICE_PAID_TOOL,
  INVOICE_MAX_AMOUNT,
} from "../lib/invoice-flow.mjs";

const ENDPOINT = "https://israel-counterparty-intelligence.vercel.app/mcp";
const NETWORK = "eip155:8453";
const MAX_VERIFY_AMOUNT = 50_000n;
const MAX_PAYMENT_RISK_AMOUNT = 100_000n;
const PREVIEW_TOOL = "preview_israeli_company_free";
const PAID_TOOL = "verify_israeli_company_paid";
const PAYMENT_RISK_PREVIEW_TOOL = "preview_israeli_vendor_payment_risk_free";
const PAYMENT_RISK_PAID_TOOL = "assess_israeli_vendor_payment_risk_paid";
const AGENT_PAYMENT_TRUST_TOOL = "preview_agent_payment_trust";
const SAMPLE_TOOL = "get_sample_verification_report";

function usage() {
  return `Israel Company Verify Buyer

Invoice gate: download invoice-request.json from the free website check first.
  israel-company-verify-buyer --invoice-file invoice-request.json
  israel-company-verify-buyer --invoice-file invoice-request.json --pay
  Free by default. --pay authorizes one report, capped at 0.25 USDC on Base.
  This purchases decision support, not a supplier payment or guaranteed PAY result.

Free live preview:
  israel-company-verify-buyer --company-number 514744887
  israel-company-verify-buyer --company-name "Example Ltd" [--language en|he]

Static full-report sample, no live lookup and no payment:
  israel-company-verify-buyer --sample

Paid full report, fixed maximum 0.05 USDC on Base Mainnet:
  BUYER_PRIVATE_KEY=<secret> israel-company-verify-buyer --company-number 514744887 --pay

Free vendor payment-risk preview:
  israel-company-verify-buyer --payment-risk --company-number 514744887 \\
    --invoice-company-name "Example Ltd" --vendor-email billing@example.com

Free x402 pre-sign firewall dry-run:
  israel-company-verify-buyer --agent-payment-trust --company-number 514744887 \\
    --service-url https://merchant.example/pay \\
    --payment-network eip155:8453 \\
    --payment-asset 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \\
    --payment-amount 50000 \\
    --payment-pay-to 0x1111111111111111111111111111111111111111 \\
    --payment-resource-url https://merchant.example/pay

Paid vendor payment-risk decision, fixed maximum 0.10 USDC on Base Mainnet:
  BUYER_PRIVATE_KEY=<secret> israel-company-verify-buyer --payment-risk \\
    --company-number 514744887 --invoice-company-number 514744887 --pay

Options:
  --invoice-file <path>      Use a local invoice JSON file (not a company lookup)
  --company-number <number>  Israeli company number
  --company-name <name>      Israeli legal or trading name
  --language <en|he>         Summary language, default en
  --depth <basic|standard>   Paid report depth, default standard
  --payment-risk             Assess the vendor immediately before payment
  --agent-payment-trust      Run the free dry-run firewall; never signs or pays
  --invoice-company-number <number>
  --invoice-company-name <name>
  --invoice-city <city>
  --invoice-website <url>
  --vendor-email <email>
  --payment-details-changed  Mark buyer-observed changed payment instructions
  --urgent-payment-request   Mark buyer-observed unusual payment urgency
  --first-time-vendor        Mark a first transaction with this vendor
  --service-url <url>        Service requesting the x402 payment
  --payment-network <caip2>  Requested payment network, for example eip155:8453
  --payment-asset <asset>    Requested token contract or native
  --payment-amount <atomic>  Requested positive amount in atomic units
  --payment-pay-to <address> Requested EVM recipient address
  --payment-resource-url <url>
  --max-payment-amount <atomic> Buyer mandate cap; defaults to exact requested amount
  --previous-payment-fingerprint <sha256>
  --manifest-mode <fetch|none>  Default fetch from the service domain
  --pay                      Explicitly authorize one capped payment
  --sample                   Return a free static full-report example
  --help                     Show this help

Security:
  The private key is accepted only through BUYER_PRIVATE_KEY. It is never printed.
  The payment policy rejects every network except Base Mainnet, every asset except
  native Base USDC. It caps verification at 50,000 atomic units (0.05 USDC)
  payment-risk assessment at 100,000 atomic units (0.10 USDC),
  and the invoice gate at 250,000 atomic units (0.25 USDC).`;
}

function parseArgs(argv) {
  const parsed = {
    language: "en",
    depth: "standard",
    pay: false,
    sample: false,
    paymentRisk: false,
    agentPaymentTrust: false,
    paymentDetailsChanged: false,
    urgentPaymentRequest: false,
    firstTimeVendor: false,
  };
  const values = new Set([
    "--invoice-file",
    "--company-number",
    "--company-name",
    "--language",
    "--depth",
    "--invoice-company-number",
    "--invoice-company-name",
    "--invoice-city",
    "--invoice-website",
    "--vendor-email",
    "--service-url",
    "--payment-network",
    "--payment-asset",
    "--payment-amount",
    "--payment-pay-to",
    "--payment-resource-url",
    "--max-payment-amount",
    "--previous-payment-fingerprint",
    "--manifest-mode",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h")
      return { ...parsed, help: true };
    if (argument === "--pay") {
      parsed.pay = true;
      continue;
    }
    if (argument === "--sample") {
      parsed.sample = true;
      continue;
    }
    if (argument === "--payment-risk") {
      parsed.paymentRisk = true;
      continue;
    }
    if (argument === "--agent-payment-trust") {
      parsed.agentPaymentTrust = true;
      continue;
    }
    if (argument === "--payment-details-changed") {
      parsed.paymentDetailsChanged = true;
      continue;
    }
    if (argument === "--urgent-payment-request") {
      parsed.urgentPaymentRequest = true;
      continue;
    }
    if (argument === "--first-time-vendor") {
      parsed.firstTimeVendor = true;
      continue;
    }
    if (!values.has(argument)) throw new Error(`Unknown option: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`Missing value for ${argument}`);
    index += 1;
    if (argument === "--invoice-file") parsed.invoiceFile = value;
    if (argument === "--company-number") parsed.companyNumber = value;
    if (argument === "--company-name") parsed.companyName = value;
    if (argument === "--language") parsed.language = value;
    if (argument === "--depth") parsed.depth = value;
    if (argument === "--invoice-company-number")
      parsed.invoiceCompanyNumber = value;
    if (argument === "--invoice-company-name")
      parsed.invoiceCompanyName = value;
    if (argument === "--invoice-city") parsed.invoiceCity = value;
    if (argument === "--invoice-website") parsed.invoiceWebsite = value;
    if (argument === "--vendor-email") parsed.vendorEmail = value;
    if (argument === "--service-url") parsed.serviceUrl = value;
    if (argument === "--payment-network") parsed.paymentNetwork = value;
    if (argument === "--payment-asset") parsed.paymentAsset = value;
    if (argument === "--payment-amount") parsed.paymentAmount = value;
    if (argument === "--payment-pay-to") parsed.paymentPayTo = value;
    if (argument === "--payment-resource-url")
      parsed.paymentResourceUrl = value;
    if (argument === "--max-payment-amount") parsed.maxPaymentAmount = value;
    if (argument === "--previous-payment-fingerprint") {
      parsed.previousPaymentFingerprint = value;
    }
    if (argument === "--manifest-mode") parsed.manifestMode = value;
  }

  if (!new Set(["en", "he"]).has(parsed.language)) {
    throw new Error("--language must be en or he");
  }
  if (!new Set(["basic", "standard"]).has(parsed.depth)) {
    throw new Error("--depth must be basic or standard");
  }
  if (parsed.sample && parsed.pay)
    throw new Error("--sample and --pay cannot be combined");
  if (parsed.sample && parsed.paymentRisk) {
    throw new Error("--sample and --payment-risk cannot be combined");
  }
  if (parsed.agentPaymentTrust && parsed.paymentRisk) {
    throw new Error(
      "--agent-payment-trust and --payment-risk cannot be combined",
    );
  }
  if (parsed.agentPaymentTrust && parsed.sample) {
    throw new Error("--agent-payment-trust and --sample cannot be combined");
  }
  if (parsed.agentPaymentTrust && parsed.pay) {
    throw new Error(
      "The agent payment trust MVP is dry-run only and cannot be combined with --pay",
    );
  }
  if (parsed.agentPaymentTrust) {
    const required = [
      ["--service-url", parsed.serviceUrl],
      ["--payment-network", parsed.paymentNetwork],
      ["--payment-asset", parsed.paymentAsset],
      ["--payment-amount", parsed.paymentAmount],
      ["--payment-pay-to", parsed.paymentPayTo],
      ["--payment-resource-url", parsed.paymentResourceUrl],
    ];
    const missing = required
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missing.length)
      throw new Error(`Missing required trust options: ${missing.join(", ")}`);
    if (!/^[1-9][0-9]*$/.test(parsed.paymentAmount)) {
      throw new Error(
        "--payment-amount must be a positive integer in atomic units",
      );
    }
    if (
      parsed.maxPaymentAmount &&
      !/^[1-9][0-9]*$/.test(parsed.maxPaymentAmount)
    ) {
      throw new Error(
        "--max-payment-amount must be a positive integer in atomic units",
      );
    }
    if (
      parsed.manifestMode &&
      !new Set(["fetch", "none"]).has(parsed.manifestMode)
    ) {
      throw new Error("--manifest-mode must be fetch or none");
    }
  }
  if (
    parsed.invoiceFile &&
    (parsed.sample ||
      parsed.paymentRisk ||
      parsed.agentPaymentTrust ||
      parsed.companyNumber ||
      parsed.companyName)
  ) {
    throw new Error(
      "--invoice-file cannot be combined with company, sample, payment-risk, or trust modes",
    );
  }
  if (
    !parsed.invoiceFile &&
    !parsed.sample &&
    !parsed.companyNumber &&
    !parsed.companyName
  ) {
    throw new Error("Provide --company-number, --company-name, or --sample");
  }
  if (
    parsed.paymentRisk &&
    !parsed.invoiceCompanyNumber &&
    !parsed.invoiceCompanyName &&
    !parsed.invoiceCity &&
    !parsed.invoiceWebsite &&
    !parsed.vendorEmail &&
    !parsed.paymentDetailsChanged &&
    !parsed.urgentPaymentRequest &&
    !parsed.firstTimeVendor
  ) {
    throw new Error(
      "--payment-risk requires at least one invoice or payment-context signal",
    );
  }
  return parsed;
}

function agentPaymentTrustArguments(options) {
  const companyNumber = options.companyNumber;
  return {
    ...(companyNumber ? { company_number: companyNumber } : {}),
    ...(options.companyName ? { company_name: options.companyName } : {}),
    service_url: options.serviceUrl,
    payment: {
      scheme: "exact",
      network: options.paymentNetwork,
      asset: options.paymentAsset,
      amount: options.paymentAmount,
      pay_to: options.paymentPayTo,
      resource_url: options.paymentResourceUrl,
    },
    manifest_mode: options.manifestMode ?? "fetch",
    mandate: {
      max_amount: options.maxPaymentAmount ?? options.paymentAmount,
      allowed_networks: [options.paymentNetwork],
      allowed_assets: [options.paymentAsset],
      allowed_pay_to: [options.paymentPayTo],
      ...(companyNumber ? { allowed_company_numbers: [companyNumber] } : {}),
    },
    ...(options.previousPaymentFingerprint
      ? { previous_payment_fingerprint: options.previousPaymentFingerprint }
      : {}),
    language: options.language,
  };
}

function paymentRiskArguments(options) {
  return {
    ...requestArguments(options),
    ...(options.invoiceCompanyNumber
      ? { invoice_company_number: options.invoiceCompanyNumber }
      : {}),
    ...(options.invoiceCompanyName
      ? { invoice_company_name: options.invoiceCompanyName }
      : {}),
    ...(options.invoiceCity ? { invoice_city: options.invoiceCity } : {}),
    ...(options.invoiceWebsite
      ? { invoice_website: options.invoiceWebsite }
      : {}),
    ...(options.vendorEmail ? { vendor_email: options.vendorEmail } : {}),
    payment_details_changed: options.paymentDetailsChanged,
    urgent_payment_request: options.urgentPaymentRequest,
    first_time_vendor: options.firstTimeVendor,
  };
}

function requestArguments(options, includeDepth = false) {
  return {
    ...(options.companyNumber ? { company_number: options.companyNumber } : {}),
    ...(options.companyName ? { company_name: options.companyName } : {}),
    language: options.language,
    ...(includeDepth ? { depth: options.depth } : {}),
  };
}

function structuredResult(result) {
  if (result?.structuredContent) return result.structuredContent;
  const text = result?.content?.find((item) => item.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function transport() {
  return new StreamableHTTPClientTransport(new URL(ENDPOINT), {
    requestInit: {
      headers: {
        "x-discovery-source":
          process.env.BUYER_INTERNAL_SMOKE === "1"
            ? "internal-post-deploy-smoke"
            : "public-buyer-bridge",
      },
    },
  });
}

async function freeCall(tool, args) {
  const client = new Client(
    { name: "israel-company-verify-buyer", version: "0.4.0" },
    { capabilities: {} },
  );
  try {
    await client.connect(transport());
    return await client.callTool({ name: tool, arguments: args });
  } finally {
    await client.close();
  }
}

async function paidCall(options, preview) {
  const privateKey = process.env.BUYER_PRIVATE_KEY;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey ?? "")) {
    throw new Error(
      "--pay requires a valid BUYER_PRIVATE_KEY in the buyer's secret environment",
    );
  }

  const maxAmount = options.invoiceFile
    ? INVOICE_MAX_AMOUNT
    : options.paymentRisk
      ? MAX_PAYMENT_RISK_AMOUNT
      : MAX_VERIFY_AMOUNT;
  const accepted = (requirement) =>
    acceptsCappedPayment(requirement, maxAmount);
  const account = privateKeyToAccount(privateKey);
  const client = createx402MCPClient({
    name: "israel-company-verify-buyer",
    version: "0.4.0",
    schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }],
    policies: [(_version, requirements) => requirements.filter(accepted)],
    autoPayment: true,
    onPaymentRequested: ({ paymentRequired }) =>
      paymentRequired.accepts.length > 0 &&
      paymentRequired.accepts.every(accepted),
  });

  const recommended = options.paymentRisk
    ? preview?.paid_assessment?.recommended_arguments
    : preview?.next_action?.arguments;
  const args = options.invoiceFile
    ? options.invoiceQuery
    : recommended && typeof recommended === "object"
      ? options.paymentRisk
        ? recommended
        : { ...recommended, depth: options.depth }
      : options.paymentRisk
        ? paymentRiskArguments(options)
        : requestArguments(options, true);
  const tool = options.invoiceFile
    ? INVOICE_PAID_TOOL
    : options.paymentRisk
      ? PAYMENT_RISK_PAID_TOOL
      : PAID_TOOL;

  try {
    await client.connect(transport());
    return await client.callTool(tool, args);
  } finally {
    await client.close();
  }
}

export async function main(
  argv = process.argv.slice(2),
  calls = { free: freeCall, paid: paidCall },
) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }

  if (options.invoiceFile) {
    options.invoiceQuery = await readInvoiceFile(options.invoiceFile);
    const result = await calls.free(INVOICE_PREVIEW_TOOL, options.invoiceQuery);
    if (result.isError)
      throw new Error(
        "The free invoice preview rejected the request; check the JSON fields",
      );
    const preview = structuredResult(result);
    if (!options.pay) {
      console.log(
        JSON.stringify(
          { mode: "free_invoice_preview", result: preview },
          null,
          2,
        ),
      );
      return;
    }
    enforceInvoicePreview(preview);
    // Resolve the supplier for free before any signing or paid invocation.
    const supplier = await calls.free(PREVIEW_TOOL, {
      company_number: options.invoiceQuery.supplier_company_number,
    });
    if (
      supplier.isError ||
      structuredResult(supplier)?.resolution_status !== "RESOLVED"
    ) {
      throw new Error(
        "Payment blocked: supplier did not resolve in the free company preview",
      );
    }
    if (
      preview.policy.allocation_applicability === "REQUIRED" &&
      options.invoiceQuery.official_verification?.status !== "MATCH"
    ) {
      console.error(
        "The paid report can still return HOLD: official allocation verification is not supplied. The service does not independently authenticate Tax Authority results.",
      );
    }
    const paid = await calls.paid(options, preview);
    if (paid.isError)
      throw new Error("The paid invoice tool returned an error");
    console.log(
      JSON.stringify(
        {
          mode: "paid_invoice_gate",
          payment_made: paid.paymentMade,
          settlement: paid.paymentResponse ?? null,
          result: structuredResult(paid),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (options.sample) {
    const result = await freeCall(SAMPLE_TOOL, {});
    console.log(
      JSON.stringify(
        { mode: "sample", result: structuredResult(result) },
        null,
        2,
      ),
    );
    return;
  }

  if (options.agentPaymentTrust) {
    const result = await freeCall(
      AGENT_PAYMENT_TRUST_TOOL,
      agentPaymentTrustArguments(options),
    );
    const structured = structuredResult(result);
    if (result.isError)
      throw new Error("The agent payment trust dry-run failed");
    console.log(
      JSON.stringify(
        { mode: "agent_payment_trust_dry_run", result: structured },
        null,
        2,
      ),
    );
    try {
      enforceAgentPaymentTrust(structured);
    } catch (error) {
      console.error(
        `Pre-sign gate: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 2;
    }
    return;
  }

  const previewResult = await freeCall(
    options.paymentRisk ? PAYMENT_RISK_PREVIEW_TOOL : PREVIEW_TOOL,
    options.paymentRisk
      ? paymentRiskArguments(options)
      : requestArguments(options),
  );
  const preview = structuredResult(previewResult);
  if (previewResult.isError) throw new Error("The free preview failed");

  if (!options.pay) {
    console.log(
      JSON.stringify(
        {
          mode: options.paymentRisk
            ? "free_payment_risk_preview"
            : "free_preview",
          result: preview,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (preview?.resolution_status !== "RESOLVED") {
    throw new Error(
      `Payment blocked because the free preview returned ${preview?.resolution_status ?? "an unknown status"}`,
    );
  }

  const paid = await paidCall(options, preview);
  if (paid.isError) throw new Error("The paid tool returned an error");
  console.log(
    JSON.stringify(
      {
        mode: options.paymentRisk ? "paid_payment_risk" : "paid_verification",
        payment_made: paid.paymentMade,
        settlement: paid.paymentResponse ?? null,
        result: structuredResult(paid),
      },
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
)
  main().catch((error) => {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
