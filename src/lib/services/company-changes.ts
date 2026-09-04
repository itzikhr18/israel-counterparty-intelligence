import {
  companyChangesAdapter,
  type CompanyChangeRecord,
  type CompanyChangesAdapter,
} from "@/lib/adapters/company-changes";
import type { CompanyChangesQuery } from "@/lib/company-changes-schema";
import { ApiError, type Evidence, type ResolvedEntity } from "@/lib/domain";

type ChangesReader = Pick<CompanyChangesAdapter, "findByCompanyNumber">;

export type CompanyChangeCategory =
  | "SECURED_CREDIT"
  | "OWNERSHIP_OR_OFFICER"
  | "LEGAL_STATUS"
  | "COMPLIANCE"
  | "FILING"
  | "ADDRESS"
  | "OTHER";

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function parseIsraeliDate(
  value: string | null | undefined,
): Date | null {
  const match = value?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return parsed;
}

export function classifyCompanyChange(
  requestType: string,
): CompanyChangeCategory {
  const value = requestType.trim();
  if (/שעבוד/.test(value)) return "SECURED_CREDIT";
  if (/מני(ה|ות)|בעל.{0,3}תפקיד|דירקטור/.test(value))
    return "OWNERSHIP_OR_OFFICER";
  if (/פירוק|חיסול|מחיקה|חדלות/.test(value)) return "LEGAL_STATUS";
  if (/הפרה|הגבלה/.test(value)) return "COMPLIANCE";
  if (/דו.?ח|דוח|אגרה/.test(value)) return "FILING";
  if (/כתובת|מען/.test(value)) return "ADDRESS";
  return "OTHER";
}

function eventFromRecord(record: CompanyChangeRecord) {
  const parsedDate = parseIsraeliDate(record["תאריך עדכון סטטוס"]);
  const requestType = clean(record["סוג בקשה"]) ?? "UNKNOWN";
  return {
    event_date: parsedDate?.toISOString().slice(0, 10) ?? null,
    event_timestamp: parsedDate?.getTime() ?? 0,
    request_type: requestType,
    category: classifyCompanyChange(requestType),
    request_type_code: clean(record["קוד סוג בקשה"]),
    charge_id: clean(record["מזהה השיעבוד"]),
    source_record_id: record._id,
  };
}

export class CompanyChangesService {
  constructor(
    private readonly changes: ChangesReader = companyChangesAdapter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getRecentChanges(query: CompanyChangesQuery, entity: ResolvedEntity) {
    const result = await this.changes.findByCompanyNumber(
      entity.company_number,
    );
    if (!result.ok) {
      throw new ApiError(
        502,
        "COMPANY_CHANGES_UNAVAILABLE",
        result.error.message,
        result.error,
      );
    }

    const cutoff =
      this.now().getTime() - query.lookback_days * 24 * 60 * 60 * 1000;
    const matching = result.data.records
      .map(eventFromRecord)
      .filter(
        (event) =>
          event.event_timestamp === 0 || event.event_timestamp >= cutoff,
      )
      .sort((a, b) => b.event_timestamp - a.event_timestamp);
    const events = matching.slice(0, query.limit).map((event) => ({
      event_date: event.event_date,
      request_type: event.request_type,
      category: event.category,
      request_type_code: event.request_type_code,
      charge_id: event.charge_id,
      source_record_id: event.source_record_id,
    }));
    const categories = [...new Set(events.map((event) => event.category))];
    const evidence: Evidence[] = events.map((event) => ({
      field: "company_change",
      value: {
        event_date: event.event_date,
        request_type: event.request_type,
        category: event.category,
        request_type_code: event.request_type_code,
        charge_id: event.charge_id,
      },
      type: "fact",
      source: "Israeli Corporations Authority daily changes dataset",
      source_url: result.data.sourceUrl,
      retrieved_at: result.retrieved_at,
      source_record_id: event.source_record_id,
      confidence: 0.99,
    }));

    return {
      changes: {
        available: true,
        total_matching_events: matching.length,
        returned_count: events.length,
        latest_event_date: events[0]?.event_date ?? null,
        categories_present: categories,
        events,
      },
      evidence,
      limitations: [
        "The official changes dataset covers up to approximately one year; an empty result does not prove that no earlier change occurred.",
        "Request types are official filing/update labels. Categories are deterministic navigation labels, not legal or risk conclusions.",
        "A recorded request or filing does not by itself establish misconduct, solvency, ownership, or current legal effect.",
      ],
    };
  }
}

export const companyChangesService = new CompanyChangesService();
