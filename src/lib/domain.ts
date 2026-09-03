import { z } from "zod";

export const API_VERSION = "1.0.0";
export const SCORING_VERSION = "0.1.0";

const companyIdentityQueryShape = {
  company_name: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .describe(
      "Israeli legal or trading name. Provide this or company_number; add city when the name may be ambiguous.",
    )
    .optional(),
  company_number: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .describe(
      "Israeli company registration number. A nine-digit number gives the most reliable exact match.",
    )
    .optional(),
  website: z
    .url()
    .max(500)
    .describe(
      "Optional public company website used only as supporting resolution context.",
    )
    .optional(),
  city: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .describe(
      "Optional Israeli city used to disambiguate companies with similar names.",
    )
    .optional(),
  expected_entity_type: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .describe(
      "Optional expected legal entity type, such as private company, used for disambiguation.",
    )
    .optional(),
  language: z
    .enum(["en", "he"])
    .default("en")
    .describe(
      "Language for the human-readable summary: en or he. Defaults to en.",
    ),
};

export const previewCompanyQuerySchema = z
  .object(companyIdentityQueryShape)
  .describe(
    "Free limited identity lookup. It does not accept a verification depth and never returns the paid evidence set.",
  )
  .refine((value) => value.company_name || value.company_number, {
    message: "Provide company_name or company_number",
    path: ["company_name"],
  });

export const counterpartyQuerySchema = z
  .object({
    ...companyIdentityQueryShape,
    depth: z
      .enum(["basic", "standard"])
      .default("standard")
      .describe(
        "Paid verification processing hint retained for compatibility. Both values currently return the complete evidence-backed public-registry result; standard is the default.",
      ),
  })
  .refine((value) => value.company_name || value.company_number, {
    message: "Provide company_name or company_number",
    path: ["company_name"],
  });

export type CounterpartyQuery = z.infer<typeof counterpartyQuerySchema>;

export type EvidenceType = "fact" | "inference";

export interface Evidence {
  field: string;
  value: unknown;
  type: EvidenceType;
  source: string;
  source_url: string | null;
  retrieved_at: string;
  source_record_id: string | null;
  confidence: number;
  based_on?: string[];
  scoring_version?: string;
}

export interface RegisteredAddress {
  city: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  country: string | null;
}

export interface ResolvedEntity {
  legal_name: string;
  english_name: string | null;
  company_number: string;
  entity_type: string;
  status: string;
  registered_address: RegisteredAddress | null;
  incorporation_date: string | null;
  law_violation_flag: boolean | null;
  latest_annual_report_year: number | null;
}

export interface EntityCandidate {
  legal_name: string;
  english_name: string | null;
  company_number: string;
  status: string;
  city: string | null;
  confidence: number;
}

export type EntityResolution =
  | {
      status: "RESOLVED";
      entity: ResolvedEntity;
      candidates: [];
      confidence: number;
      evidence: Evidence[];
      missing_data: string[];
    }
  | {
      status: "AMBIGUOUS";
      entity: null;
      candidates: EntityCandidate[];
      confidence: number;
      evidence: Evidence[];
      missing_data: string[];
    }
  | {
      status: "NOT_FOUND";
      entity: null;
      candidates: [];
      confidence: 0;
      evidence: Evidence[];
      missing_data: string[];
    };

export interface PublicCounterparty {
  name: string;
  record_count: number;
  approved_amount_ils: number;
  paid_amount_ils: number;
  evidence_url: string | null;
}

export interface GovernmentFootprint {
  available: boolean;
  contracts: {
    count: number | null;
    approved_amount_ils: number | null;
    paid_amount_ils: number | null;
  };
  supports: {
    count: number | null;
    approved_amount_ils: number | null;
    paid_amount_ils: number | null;
  };
  public_counterparties: PublicCounterparty[];
  date_range: { from_year: number | null; to_year: number | null };
  confidence: number;
  evidence: Evidence[];
  missing_data: string[];
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export interface RiskResult {
  score: number | null;
  level: RiskLevel;
  reason_codes: string[];
  explanation: string;
  confidence: number;
  scoring_version: string;
}

export type SourceResult<T> =
  | { ok: true; data: T; retrieved_at: string; cache_hit: boolean }
  | { ok: false; error: SourceError; retrieved_at: string; cache_hit: false };

export type SourceErrorCode =
  "TIMEOUT" | "UNAVAILABLE" | "INVALID_RESPONSE" | "NOT_FOUND";

export interface SourceError {
  source: string;
  code: SourceErrorCode;
  message: string;
  retryable: boolean;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
