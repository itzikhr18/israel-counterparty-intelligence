import { z } from "zod";

import { sourceCache } from "@/lib/cache";
import { config } from "@/lib/config";
import type {
  Evidence,
  GovernmentFootprint,
  PublicCounterparty,
} from "@/lib/domain";
import { fetchJson, UpstreamError } from "@/lib/fetch-json";

const footprintRowSchema = z.object({
  item_url: z.string().nullish(),
  counterparty: z.string().nullish(),
  record_count: z.coerce.number().int().nonnegative(),
  approved_amount: z.coerce.number().nonnegative().nullish(),
  paid_amount: z.coerce.number().nonnegative().nullish(),
  from_year: z.coerce.number().int().nullish(),
  to_year: z.coerce.number().int().nullish(),
});

const queryResponseSchema = z.object({
  warnings: z.union([z.array(z.unknown()), z.string()]).nullish(),
  rows: z.array(footprintRowSchema),
});

type FootprintRow = z.infer<typeof footprintRowSchema>;

interface DatasetResult {
  rows: FootprintRow[];
  sourceUrl: string;
  retrievedAt: string;
  cacheHit: boolean;
}

function sum(
  rows: FootprintRow[],
  field: "record_count" | "approved_amount" | "paid_amount",
) {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

function yearRange(rows: FootprintRow[]): {
  from_year: number | null;
  to_year: number | null;
} {
  const starts = rows.flatMap((row) => (row.from_year ? [row.from_year] : []));
  const ends = rows.flatMap((row) => (row.to_year ? [row.to_year] : []));
  return {
    from_year: starts.length ? Math.min(...starts) : null,
    to_year: ends.length ? Math.max(...ends) : null,
  };
}

function counterparties(rows: FootprintRow[]): PublicCounterparty[] {
  return rows.slice(0, 5).map((row) => ({
    name: row.counterparty?.trim() || "UNKNOWN",
    record_count: row.record_count,
    approved_amount_ils: Number(row.approved_amount ?? 0),
    paid_amount_ils: Number(row.paid_amount ?? 0),
    evidence_url: row.item_url ?? null,
  }));
}

export class BudgetKeyAdapter {
  readonly source = "BudgetKey public data API";

  async getFootprint(companyNumber: string): Promise<GovernmentFootprint> {
    const [contracts, supports] = await Promise.allSettled([
      this.queryDataset(
        "contracts_data",
        `SELECT MIN(item_url) AS item_url, purchasing_ministry AS counterparty, COUNT(*)::int AS record_count, COALESCE(SUM(volume), 0) AS approved_amount, COALESCE(SUM(executed), 0) AS paid_amount, MIN(start_year) AS from_year, MAX(end_year) AS to_year FROM contracts_data WHERE supplier_entity_id = '${companyNumber}' GROUP BY purchasing_ministry ORDER BY approved_amount DESC LIMIT 50`,
      ),
      this.queryDataset(
        "supports_transactions_data",
        `SELECT MIN(item_url) AS item_url, supporting_ministry AS counterparty, COUNT(*)::int AS record_count, COALESCE(SUM(amount_approved), 0) AS approved_amount, COALESCE(SUM(amount_paid), 0) AS paid_amount, MIN(year) AS from_year, MAX(year) AS to_year FROM supports_transactions_data WHERE recipient_entity_id = '${companyNumber}' GROUP BY supporting_ministry ORDER BY approved_amount DESC LIMIT 50`,
      ),
    ]);

    const contractRows =
      contracts.status === "fulfilled" ? contracts.value.rows : null;
    const supportRows =
      supports.status === "fulfilled" ? supports.value.rows : null;
    const available = contractRows !== null || supportRows !== null;
    const allRows = [...(contractRows ?? []), ...(supportRows ?? [])];
    const evidence: Evidence[] = [];

    if (contracts.status === "fulfilled") {
      evidence.push({
        field: "government_contracts",
        value: {
          count: sum(contractRows ?? [], "record_count"),
          approved_amount_ils: sum(contractRows ?? [], "approved_amount"),
          paid_amount_ils: sum(contractRows ?? [], "paid_amount"),
        },
        type: "fact",
        source: this.source,
        source_url: contracts.value.sourceUrl,
        retrieved_at: contracts.value.retrievedAt,
        source_record_id: companyNumber,
        confidence: 0.95,
      });
    }

    if (supports.status === "fulfilled") {
      evidence.push({
        field: "government_supports",
        value: {
          count: sum(supportRows ?? [], "record_count"),
          approved_amount_ils: sum(supportRows ?? [], "approved_amount"),
          paid_amount_ils: sum(supportRows ?? [], "paid_amount"),
        },
        type: "fact",
        source: this.source,
        source_url: supports.value.sourceUrl,
        retrieved_at: supports.value.retrievedAt,
        source_record_id: companyNumber,
        confidence: 0.95,
      });
    }

    const range = yearRange(allRows);
    const missingData = [
      ...(contracts.status === "rejected" ? ["government_contracts"] : []),
      ...(supports.status === "rejected" ? ["government_supports"] : []),
    ];

    return {
      available,
      contracts: {
        count: contractRows === null ? null : sum(contractRows, "record_count"),
        approved_amount_ils:
          contractRows === null ? null : sum(contractRows, "approved_amount"),
        paid_amount_ils:
          contractRows === null ? null : sum(contractRows, "paid_amount"),
      },
      supports: {
        count: supportRows === null ? null : sum(supportRows, "record_count"),
        approved_amount_ils:
          supportRows === null ? null : sum(supportRows, "approved_amount"),
        paid_amount_ils:
          supportRows === null ? null : sum(supportRows, "paid_amount"),
      },
      public_counterparties: counterparties(
        allRows.sort(
          (a, b) =>
            Number(b.approved_amount ?? 0) - Number(a.approved_amount ?? 0),
        ),
      ),
      date_range: range,
      confidence: available ? (missingData.length ? 0.75 : 0.95) : 0,
      evidence,
      missing_data: missingData,
    };
  }

  private async queryDataset(
    dataset: string,
    query: string,
  ): Promise<DatasetResult> {
    const key = `budgetkey:v1:${dataset}:${query}`;
    const cached = sourceCache.get<Omit<DatasetResult, "cacheHit">>(key);
    if (cached) return { ...cached, cacheHit: true };

    const params = new URLSearchParams({ query, page_size: "50" });
    const sourceUrl = `${config.BUDGETKEY_API_BASE}/api/tables/${dataset}/query?${params.toString()}`;
    const retrievedAt = new Date().toISOString();
    const raw = await fetchJson<unknown>(sourceUrl, {
      source: this.source,
      timeoutMs: Math.max(config.UPSTREAM_TIMEOUT_MS, 15000),
      retries: config.UPSTREAM_RETRIES,
    });
    const parsed = queryResponseSchema.safeParse(raw);
    if (!parsed.success || parsed.data.warnings) {
      throw new UpstreamError(
        this.source,
        "INVALID_RESPONSE",
        parsed.success
          ? "BudgetKey returned query warnings"
          : "BudgetKey response schema changed",
        false,
      );
    }

    const result = { rows: parsed.data.rows, sourceUrl, retrievedAt };
    sourceCache.set(key, result, config.CACHE_TTL_SECONDS);
    return { ...result, cacheHit: false };
  }
}

export const budgetKeyAdapter = new BudgetKeyAdapter();
