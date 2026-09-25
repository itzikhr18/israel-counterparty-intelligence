import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Month-end invoice lines for partner pilots.
 *
 * Reads the operator view of GET /v1/pilot/usage (live, or a saved JSON file),
 * applies the ₪ price card and optional monthly plans, and prints one invoice
 * block per partner: lines, subtotal, VAT, total, and the expected net after
 * the collection rail's commission. Amounts are ₪ before VAT unless stated.
 *
 *   npm run pilot:invoice -- --month 2026-10 --plan morning=starter,icount=payg
 *   npm run pilot:invoice -- --month 2026-10 --usage ./usage-2026-10.json --format csv
 */

export const DEFAULT_PRICE_CARD = Object.freeze({
  invoice_gate: 1.5,
  payment_risk: 0.9,
  verify: 0.6,
  company_changes: 0.2,
});

export const PLANS = Object.freeze({
  payg: null,
  starter: { monthly_fee: 490, included_calls: 500 },
  growth: { monthly_fee: 1900, included_calls: 2500 },
});

export const VAT_RATE = 0.18;
export const COLLECTION_COMMISSION = 0.05;

const TOOL_LABELS = {
  invoice_gate: "Invoice gate (PAY / HOLD / BLOCK)",
  payment_risk: "Vendor payment risk",
  verify: "Company verification",
  company_changes: "Company changes",
};

const round = (value) => Math.round(value * 100) / 100;

function toolLines(monthByTool, prices) {
  return Object.entries(monthByTool)
    .filter(([tool, calls]) => tool !== "total" && calls > 0)
    .map(([tool, calls]) => ({
      tool,
      calls,
      unit_price_ils: prices[tool] ?? 0,
      known_price: tool in prices,
    }))
    .sort((a, b) => b.unit_price_ils - a.unit_price_ils);
}

/**
 * Builds invoice blocks for every partner in an operator usage response.
 * Included plan calls are allocated to the most expensive tools first, so the
 * overage a partner pays consists of its cheapest calls.
 */
export function buildInvoiceLines(usageResponse, options = {}) {
  const prices = { ...DEFAULT_PRICE_CARD, ...(options.prices ?? {}) };
  const plans = options.plans ?? {};
  const vatRate = options.vatRate ?? VAT_RATE;
  const commission = options.commission ?? COLLECTION_COMMISSION;
  const month = options.month ?? usageResponse?.month ?? null;
  const warnings = [];

  if (!usageResponse || !Array.isArray(usageResponse.partners)) {
    throw new Error(
      "Expected the operator view of GET /v1/pilot/usage (an object with partners[]).",
    );
  }
  if (month && usageResponse.month && usageResponse.month !== month) {
    warnings.push(
      `Requested month ${month} but the usage response reports ${usageResponse.month}.`,
    );
  }

  const partners = usageResponse.partners.map((entry) => {
    const usage = entry.usage ?? {};
    const planName = plans[entry.partner_id] ?? "payg";
    const plan = PLANS[planName];
    if (plan === undefined) {
      throw new Error(
        `Unknown plan "${planName}" for ${entry.partner_id}; use ${Object.keys(PLANS).join(", ")}.`,
      );
    }
    const partnerWarnings = [];
    if (!usage.durable) {
      partnerWarnings.push(
        "Usage count is not durable (Upstash not configured or unreachable). Do not invoice from this figure.",
      );
    }
    const lines = [];
    let remainingIncluded = plan?.included_calls ?? 0;
    if (plan) {
      lines.push({
        description: `${planName} plan, monthly fee (includes ${plan.included_calls} calls)`,
        quantity: 1,
        unit_price_ils: plan.monthly_fee,
        amount_ils: plan.monthly_fee,
      });
    }
    for (const line of toolLines(usage.month_by_tool ?? {}, prices)) {
      if (!line.known_price) {
        partnerWarnings.push(
          `No price configured for tool "${line.tool}"; ${line.calls} calls billed at ₪0.`,
        );
      }
      const covered = Math.min(remainingIncluded, line.calls);
      remainingIncluded -= covered;
      const billable = line.calls - covered;
      if (covered > 0) {
        lines.push({
          description: `${TOOL_LABELS[line.tool] ?? line.tool}, included in plan`,
          quantity: covered,
          unit_price_ils: 0,
          amount_ils: 0,
        });
      }
      if (billable > 0) {
        lines.push({
          description: `${TOOL_LABELS[line.tool] ?? line.tool}${plan ? ", above the included calls" : ""}`,
          quantity: billable,
          unit_price_ils: line.unit_price_ils,
          amount_ils: round(billable * line.unit_price_ils),
        });
      }
    }
    const subtotal = round(
      lines.reduce((sum, line) => sum + line.amount_ils, 0),
    );
    const vat = round(subtotal * vatRate);
    const total = round(subtotal + vat);
    return {
      partner_id: entry.partner_id,
      plan: planName,
      month: usage.month ?? month,
      calls: usage.month_total ?? 0,
      durable: Boolean(usage.durable),
      lines,
      subtotal_ils: subtotal,
      vat_ils: vat,
      total_ils: total,
      expected_net_after_commission_ils: round(total * (1 - commission)),
      warnings: partnerWarnings,
    };
  });

  return { month, vat_rate: vatRate, commission, partners, warnings };
}

const money = (value) => value.toFixed(2);

export function renderMarkdown(invoice) {
  const out = [];
  out.push(`# Pilot invoices for ${invoice.month ?? "the reported month"}`);
  out.push("");
  out.push(
    `Amounts in ₪. VAT ${Math.round(invoice.vat_rate * 100)} % added on the subtotal; expected net after the ${Math.round(invoice.commission * 100)} % collection commission on the total.`,
  );
  for (const warning of invoice.warnings) out.push(`> ⚠ ${warning}`);
  for (const partner of invoice.partners) {
    out.push("");
    out.push(
      `## ${partner.partner_id} · ${partner.plan} · ${partner.calls} calls in ${partner.month}${partner.durable ? "" : " · NOT DURABLE"}`,
    );
    for (const warning of partner.warnings) out.push(`> ⚠ ${warning}`);
    out.push("");
    out.push("| Description | Qty | Unit ₪ | Amount ₪ |");
    out.push("| --- | ---: | ---: | ---: |");
    for (const line of partner.lines) {
      out.push(
        `| ${line.description} | ${line.quantity} | ${money(line.unit_price_ils)} | ${money(line.amount_ils)} |`,
      );
    }
    out.push(`| **Subtotal** | | | **${money(partner.subtotal_ils)}** |`);
    out.push(`| VAT | | | ${money(partner.vat_ils)} |`);
    out.push(`| **Total incl. VAT** | | | **${money(partner.total_ils)}** |`);
    out.push(
      `| Expected net after commission | | | ${money(partner.expected_net_after_commission_ils)} |`,
    );
  }
  return out.join("\n") + "\n";
}

export function renderCsv(invoice) {
  const rows = [
    [
      "month",
      "partner_id",
      "plan",
      "description",
      "quantity",
      "unit_price_ils",
      "amount_ils",
      "durable",
    ],
  ];
  for (const partner of invoice.partners) {
    for (const line of partner.lines) {
      rows.push([
        partner.month,
        partner.partner_id,
        partner.plan,
        line.description,
        line.quantity,
        money(line.unit_price_ils),
        money(line.amount_ils),
        partner.durable,
      ]);
    }
    rows.push([
      partner.month,
      partner.partner_id,
      partner.plan,
      "SUBTOTAL",
      "",
      "",
      money(partner.subtotal_ils),
      partner.durable,
    ]);
    rows.push([
      partner.month,
      partner.partner_id,
      partner.plan,
      "VAT",
      "",
      "",
      money(partner.vat_ils),
      partner.durable,
    ]);
    rows.push([
      partner.month,
      partner.partner_id,
      partner.plan,
      "TOTAL_INCL_VAT",
      "",
      "",
      money(partner.total_ils),
      partner.durable,
    ]);
  }
  return (
    rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n") + "\n"
  );
}

function parseKeyValues(raw, parseValue = (value) => value) {
  const result = {};
  for (const pair of (raw ?? "").split(",")) {
    if (!pair.trim()) continue;
    const [key, value] = pair.split("=");
    if (!key || value === undefined) {
      throw new Error(`Expected key=value pairs, got "${pair}".`);
    }
    result[key.trim()] = parseValue(value.trim());
  }
  return result;
}

function parseArgs(argv) {
  const args = { format: "md" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case "--month":
      case "--usage":
      case "--base":
      case "--operator-token":
      case "--format":
        args[flag.slice(2).replace("-", "_")] = value;
        index += 1;
        break;
      case "--plan":
        args.plans = parseKeyValues(value);
        index += 1;
        break;
      case "--price":
        args.prices = parseKeyValues(value, (price) => {
          const parsed = Number(price);
          if (!Number.isFinite(parsed) || parsed < 0) {
            throw new Error(`Invalid price "${price}".`);
          }
          return parsed;
        });
        index += 1;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument "${flag}". Use --help.`);
    }
  }
  return args;
}

const HELP = `Usage: node scripts/pilot-invoice.mjs [--month YYYY-MM] [--usage file.json | --base URL --operator-token TOKEN]
       [--plan partner=starter,other=growth] [--price invoice_gate=1.5,verify=0.6] [--format md|csv|json]

Reads the operator view of GET /v1/pilot/usage (live with the operator token, or from a saved file)
and prints invoice lines per partner. Defaults: ICI_BASE env or the production host, INTERNAL_TEST_TOKEN env,
price card from docs/PRICING_PROPOSAL.md, pay-as-you-go for every partner, Markdown output.`;

async function loadUsage(args) {
  if (args.usage) return JSON.parse(readFileSync(args.usage, "utf8"));
  const base = (
    args.base ??
    process.env.ICI_BASE ??
    "https://israel-counterparty-intelligence.vercel.app"
  ).replace(/\/$/, "");
  const token = args.operator_token ?? process.env.INTERNAL_TEST_TOKEN;
  if (!token) {
    throw new Error(
      "Provide --operator-token or INTERNAL_TEST_TOKEN, or --usage with a saved response.",
    );
  }
  const url = new URL(`${base}/v1/pilot/usage`);
  if (args.month) url.searchParams.set("month", args.month);
  const response = await fetch(url, {
    headers: { "x-internal-test-token": token },
  });
  if (!response.ok) {
    throw new Error(`GET ${url.pathname} failed with HTTP ${response.status}.`);
  }
  return response.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  const usage = await loadUsage(args);
  const invoice = buildInvoiceLines(usage, {
    month: args.month,
    plans: args.plans,
    prices: args.prices,
  });
  if (args.format === "json") console.log(JSON.stringify(invoice, null, 2));
  else if (args.format === "csv") process.stdout.write(renderCsv(invoice));
  else process.stdout.write(renderMarkdown(invoice));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
