import {
  buildRegistryEvidence,
  companyRegistryAdapter,
  registryRecordToEntity,
  type CompanyRegistryAdapter,
  type RegistryRecord,
} from "@/lib/adapters/company-registry";
import type {
  CounterpartyQuery,
  EntityCandidate,
  EntityResolution,
  ResolvedEntity,
} from "@/lib/domain";
import { ApiError } from "@/lib/domain";
import {
  nameSimilarity,
  normalizeCompanyNumber,
  normalizeName,
} from "@/lib/normalize";

type RegistryReader = Pick<
  CompanyRegistryAdapter,
  "findByCompanyNumber" | "findByName"
>;

function missingFields(entity: ResolvedEntity): string[] {
  return [
    ...(entity.english_name ? [] : ["english_name"]),
    ...(entity.registered_address ? [] : ["registered_address"]),
    ...(entity.incorporation_date ? [] : ["incorporation_date"]),
    ...(entity.latest_annual_report_year ? [] : ["latest_annual_report_year"]),
  ];
}

function candidateScore(
  record: RegistryRecord,
  query: CounterpartyQuery,
): number {
  const names = [record["שם חברה"], record["שם באנגלית"]].filter(
    (name): name is string => Boolean(name),
  );
  let score = Math.max(
    ...names.map((name) => nameSimilarity(query.company_name ?? "", name)),
  );
  if (
    query.city &&
    normalizeName(record["שם עיר"] ?? "") === normalizeName(query.city)
  ) {
    score = Math.min(1, score + 0.05);
  }
  return score;
}

function toCandidate(
  record: RegistryRecord,
  confidence: number,
): EntityCandidate {
  return {
    legal_name: record["שם חברה"].trim(),
    english_name: record["שם באנגלית"]?.trim() || null,
    company_number: String(record["מספר חברה"]).padStart(9, "0"),
    status: record["סטטוס חברה"]?.trim() || "UNKNOWN",
    city: record["שם עיר"]?.trim() || null,
    confidence,
  };
}

export class EntityResolutionService {
  constructor(
    private readonly registry: RegistryReader = companyRegistryAdapter,
  ) {}

  async resolve(query: CounterpartyQuery): Promise<EntityResolution> {
    if (query.company_number) {
      const companyNumber = normalizeCompanyNumber(query.company_number);
      if (!companyNumber) {
        throw new ApiError(
          400,
          "INVALID_COMPANY_NUMBER",
          "company_number must contain 9 digits",
        );
      }
      const result = await this.registry.findByCompanyNumber(companyNumber);
      if (!result.ok) {
        throw new ApiError(
          502,
          "REGISTRY_UNAVAILABLE",
          result.error.message,
          result.error,
        );
      }
      const exact = result.data.records.find(
        (record) =>
          String(record["מספר חברה"]).padStart(9, "0") === companyNumber,
      );
      if (!exact) {
        return {
          status: "NOT_FOUND",
          entity: null,
          candidates: [],
          confidence: 0,
          evidence: [],
          missing_data: ["registered_entity"],
        };
      }
      const entity = registryRecordToEntity(exact);
      return {
        status: "RESOLVED",
        entity,
        candidates: [],
        confidence: 0.99,
        evidence: buildRegistryEvidence(
          exact,
          result.data.sourceUrl,
          result.retrieved_at,
          0.99,
        ),
        missing_data: missingFields(entity),
      };
    }

    const companyName = query.company_name!;
    const result = await this.registry.findByName(companyName);
    if (!result.ok) {
      throw new ApiError(
        502,
        "REGISTRY_UNAVAILABLE",
        result.error.message,
        result.error,
      );
    }
    if (!result.data.records.length) {
      return {
        status: "NOT_FOUND",
        entity: null,
        candidates: [],
        confidence: 0,
        evidence: [],
        missing_data: ["registered_entity"],
      };
    }

    const ranked = result.data.records
      .map((record) => ({ record, confidence: candidateScore(record, query) }))
      .sort((a, b) => b.confidence - a.confidence);
    const top = ranked[0];
    const runnerUp = ranked[1];
    if (
      !top ||
      top.confidence < 0.7 ||
      (runnerUp && top.confidence - runnerUp.confidence < 0.08)
    ) {
      return {
        status: "AMBIGUOUS",
        entity: null,
        candidates: ranked
          .slice(0, 5)
          .map(({ record, confidence }) =>
            toCandidate(record, Number(confidence.toFixed(3))),
          ),
        confidence: Number((top?.confidence ?? 0).toFixed(3)),
        evidence: [],
        missing_data: ["unambiguous_entity_resolution"],
      };
    }

    const exactNormalized = [top.record["שם חברה"], top.record["שם באנגלית"]]
      .filter((name): name is string => Boolean(name))
      .some((name) => normalizeName(name) === normalizeName(companyName));
    const confidence = exactNormalized ? 0.9 : Math.min(0.84, top.confidence);
    const entity = registryRecordToEntity(top.record);

    return {
      status: "RESOLVED",
      entity,
      candidates: [],
      confidence: Number(confidence.toFixed(3)),
      evidence: buildRegistryEvidence(
        top.record,
        result.data.sourceUrl,
        result.retrieved_at,
        confidence,
      ),
      missing_data: missingFields(entity),
    };
  }
}

export const entityResolutionService = new EntityResolutionService();
