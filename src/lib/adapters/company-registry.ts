import { z } from "zod";

import { sourceCache } from "@/lib/cache";
import { config } from "@/lib/config";
import type { Evidence, ResolvedEntity, SourceResult } from "@/lib/domain";
import { fetchJson, UpstreamError } from "@/lib/fetch-json";

const registryRecordSchema = z.looseObject({
  _id: z.union([z.string(), z.number()]).transform(String),
  "מספר חברה": z.union([z.string(), z.number()]).transform(String),
  "שם חברה": z.string(),
  "שם באנגלית": z.string().nullish(),
  "סוג תאגיד": z.string().nullish(),
  "סטטוס חברה": z.string().nullish(),
  "תאריך התאגדות": z.string().nullish(),
  מפרה: z.union([z.string(), z.number(), z.boolean()]).nullish(),
  "שנה אחרונה של דוח שנתי (שהוגש)": z.coerce.number().int().nullish(),
  "שם עיר": z.string().nullish(),
  "שם רחוב": z.string().nullish(),
  "מספר בית": z.union([z.string(), z.number()]).transform(String).nullish(),
  מיקוד: z.union([z.string(), z.number()]).transform(String).nullish(),
  מדינה: z.string().nullish(),
  "קוד חברה מפרה": z.union([z.string(), z.number()]).nullish(),
});

const ckanResponseSchema = z.object({
  success: z.literal(true),
  result: z.object({
    records: z.array(registryRecordSchema),
  }),
});

export type RegistryRecord = z.infer<typeof registryRecordSchema>;

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isLawViolation(record: RegistryRecord): boolean | null {
  if (
    record["קוד חברה מפרה"] !== null &&
    record["קוד חברה מפרה"] !== undefined
  ) {
    return Number(record["קוד חברה מפרה"]) !== 0;
  }
  const value = record["מפרה"];
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "boolean") return value;
  return !["0", "לא", "false"].includes(
    String(value).trim().toLocaleLowerCase("he"),
  );
}

export function registryRecordToEntity(record: RegistryRecord): ResolvedEntity {
  const addressParts = [
    record["שם עיר"],
    record["שם רחוב"],
    record["מספר בית"],
    record["מיקוד"],
    record["מדינה"],
  ].filter((value) => clean(value ? String(value) : null));

  return {
    legal_name: record["שם חברה"].trim(),
    english_name: clean(record["שם באנגלית"]),
    company_number: String(record["מספר חברה"]).padStart(9, "0"),
    entity_type: clean(record["סוג תאגיד"]) ?? "UNKNOWN",
    status: clean(record["סטטוס חברה"]) ?? "UNKNOWN",
    registered_address: addressParts.length
      ? {
          city: clean(record["שם עיר"]),
          street: clean(record["שם רחוב"]),
          house_number: clean(record["מספר בית"]),
          postal_code: clean(record["מיקוד"]),
          country: clean(record["מדינה"]),
        }
      : null,
    incorporation_date: clean(record["תאריך התאגדות"]),
    law_violation_flag: isLawViolation(record),
    latest_annual_report_year: record["שנה אחרונה של דוח שנתי (שהוגש)"] ?? null,
  };
}

export function buildRegistryEvidence(
  record: RegistryRecord,
  sourceUrl: string,
  retrievedAt: string,
  confidence: number,
): Evidence[] {
  const entity = registryRecordToEntity(record);
  const common = {
    type: "fact" as const,
    source: "Israeli Companies Registry open dataset",
    source_url: sourceUrl,
    retrieved_at: retrievedAt,
    source_record_id: record._id,
    confidence,
  };

  return [
    { field: "company_number", value: entity.company_number, ...common },
    { field: "legal_name", value: entity.legal_name, ...common },
    { field: "english_name", value: entity.english_name, ...common },
    { field: "entity_type", value: entity.entity_type, ...common },
    { field: "company_status", value: entity.status, ...common },
    {
      field: "registered_address",
      value: entity.registered_address,
      ...common,
    },
    {
      field: "incorporation_date",
      value: entity.incorporation_date,
      ...common,
    },
    {
      field: "law_violation_flag",
      value: entity.law_violation_flag,
      ...common,
    },
    {
      field: "latest_annual_report_year",
      value: entity.latest_annual_report_year,
      ...common,
    },
  ];
}

export interface RegistryLookup {
  records: RegistryRecord[];
  sourceUrl: string;
}

export class CompanyRegistryAdapter {
  readonly source = "Israeli Companies Registry";

  async findByCompanyNumber(
    companyNumber: string,
  ): Promise<SourceResult<RegistryLookup>> {
    const filters = JSON.stringify({ "מספר חברה": Number(companyNumber) });
    return this.query({ filters, limit: "5" }, `number:${companyNumber}`);
  }

  async findByName(companyName: string): Promise<SourceResult<RegistryLookup>> {
    return this.query(
      { q: companyName, limit: "15" },
      `name:${companyName.toLocaleLowerCase("he")}`,
    );
  }

  private async query(
    params: Record<string, string>,
    cacheKey: string,
  ): Promise<SourceResult<RegistryLookup>> {
    const key = `registry:v1:${config.COMPANY_REGISTRY_RESOURCE_ID}:${cacheKey}`;
    const cached = sourceCache.get<RegistryLookup>(key);
    const retrievedAt = new Date().toISOString();
    if (cached)
      return {
        ok: true,
        data: cached,
        retrieved_at: retrievedAt,
        cache_hit: true,
      };

    const search = new URLSearchParams({
      resource_id: config.COMPANY_REGISTRY_RESOURCE_ID,
      ...params,
    });
    const sourceUrl = `${config.COMPANY_REGISTRY_BASE_URL}/datastore_search?${search.toString()}`;

    try {
      const raw = await fetchJson<unknown>(sourceUrl, {
        source: this.source,
        timeoutMs: config.UPSTREAM_TIMEOUT_MS,
        retries: config.UPSTREAM_RETRIES,
      });
      const parsed = ckanResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new UpstreamError(
          this.source,
          "INVALID_RESPONSE",
          "Registry response did not match the expected schema",
          false,
        );
      }
      const data = { records: parsed.data.result.records, sourceUrl };
      sourceCache.set(key, data, config.CACHE_TTL_SECONDS);
      return { ok: true, data, retrieved_at: retrievedAt, cache_hit: false };
    } catch (error) {
      const normalized =
        error instanceof UpstreamError
          ? error
          : new UpstreamError(
              this.source,
              "UNAVAILABLE",
              "Registry lookup failed",
              true,
            );
      return {
        ok: false,
        error: {
          source: normalized.source,
          code: normalized.code,
          message: normalized.message,
          retryable: normalized.retryable,
        },
        retrieved_at: retrievedAt,
        cache_hit: false,
      };
    }
  }
}

export const companyRegistryAdapter = new CompanyRegistryAdapter();
