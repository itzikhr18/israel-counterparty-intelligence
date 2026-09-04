import { z } from "zod";

import { sourceCache } from "@/lib/cache";
import { config } from "@/lib/config";
import type { SourceResult } from "@/lib/domain";
import { fetchJson, UpstreamError } from "@/lib/fetch-json";

const changeRecordSchema = z.looseObject({
  _id: z.union([z.string(), z.number()]).transform(String),
  "מספר תאגיד": z.union([z.string(), z.number()]).transform(String),
  "שם תאגיד": z.string().nullish(),
  "סוג בקשה": z.string().nullish(),
  "תאריך עדכון סטטוס": z.string().nullish(),
  "מזהה השיעבוד": z.union([z.string(), z.number()]).transform(String).nullish(),
  "קוד סוג בקשה": z.union([z.string(), z.number()]).transform(String).nullish(),
});

const ckanResponseSchema = z.object({
  success: z.literal(true),
  result: z.object({
    records: z.array(changeRecordSchema),
  }),
});

export type CompanyChangeRecord = z.infer<typeof changeRecordSchema>;

export interface CompanyChangesLookup {
  records: CompanyChangeRecord[];
  sourceUrl: string;
}

export class CompanyChangesAdapter {
  readonly source = "Israeli Corporations Authority daily changes dataset";

  async findByCompanyNumber(
    companyNumber: string,
  ): Promise<SourceResult<CompanyChangesLookup>> {
    const key = `company-changes:v1:${config.COMPANY_CHANGES_RESOURCE_ID}:${companyNumber}`;
    const cached = sourceCache.get<CompanyChangesLookup>(key);
    const retrievedAt = new Date().toISOString();
    if (cached) {
      return {
        ok: true,
        data: cached,
        retrieved_at: retrievedAt,
        cache_hit: true,
      };
    }

    const search = new URLSearchParams({
      resource_id: config.COMPANY_CHANGES_RESOURCE_ID,
      filters: JSON.stringify({ "מספר תאגיד": Number(companyNumber) }),
      limit: "500",
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
          "Company changes response did not match the expected schema",
          false,
        );
      }
      const data = { records: parsed.data.result.records, sourceUrl };
      sourceCache.set(key, data, config.COMPANY_CHANGES_CACHE_TTL_SECONDS);
      return { ok: true, data, retrieved_at: retrievedAt, cache_hit: false };
    } catch (error) {
      const normalized =
        error instanceof UpstreamError
          ? error
          : new UpstreamError(
              this.source,
              "UNAVAILABLE",
              "Company changes lookup failed",
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

export const companyChangesAdapter = new CompanyChangesAdapter();
