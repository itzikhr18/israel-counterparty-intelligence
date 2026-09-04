import { z } from "zod";

export const companyChangesQuerySchema = z.object({
  company_number: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "company_number must contain exactly 9 digits")
    .describe("Exact nine-digit Israeli company registration number."),
  lookback_days: z
    .number()
    .int()
    .min(1)
    .max(366)
    .default(366)
    .describe("Return events recorded during this many recent days."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Maximum number of most-recent events to return."),
  language: z.enum(["en", "he"]).default("en"),
});

export type CompanyChangesQuery = z.infer<typeof companyChangesQuerySchema>;

export const companyChangesInputJsonSchema = z.toJSONSchema(
  companyChangesQuerySchema,
) as Record<string, unknown>;

export const companyChangesOutputJsonSchema = {
  type: "object",
  required: [
    "request_id",
    "api_version",
    "query",
    "entity",
    "changes",
    "evidence",
    "limitations",
    "checked_at",
  ],
  properties: {
    request_id: { type: "string" },
    api_version: { type: "string" },
    query: companyChangesInputJsonSchema,
    entity: {
      type: "object",
      required: ["legal_name", "company_number", "status"],
      properties: {
        legal_name: { type: "string" },
        company_number: { type: "string" },
        status: { type: "string" },
      },
    },
    changes: {
      type: "object",
      required: [
        "available",
        "total_matching_events",
        "returned_count",
        "latest_event_date",
        "categories_present",
        "events",
      ],
      properties: {
        available: { type: "boolean" },
        total_matching_events: { type: "integer" },
        returned_count: { type: "integer" },
        latest_event_date: { type: ["string", "null"] },
        categories_present: { type: "array", items: { type: "string" } },
        events: {
          type: "array",
          items: {
            type: "object",
            required: [
              "event_date",
              "request_type",
              "category",
              "request_type_code",
              "charge_id",
              "source_record_id",
            ],
            properties: {
              event_date: { type: ["string", "null"] },
              request_type: { type: "string" },
              category: { type: "string" },
              request_type_code: { type: ["string", "null"] },
              charge_id: { type: ["string", "null"] },
              source_record_id: { type: "string" },
            },
          },
        },
      },
    },
    evidence: { type: "array", items: { type: "object" } },
    limitations: { type: "array", items: { type: "string" } },
    checked_at: { type: "string" },
  },
} as const;

export const companyChangesExample = {
  request_id: "example",
  api_version: "1.0.0",
  query: {
    company_number: "514744887",
    lookback_days: 366,
    limit: 25,
    language: "en",
  },
  entity: {
    legal_name: "מנדיי. קום בעמ",
    company_number: "514744887",
    status: "פעילה",
  },
  changes: {
    available: true,
    total_matching_events: 2,
    returned_count: 2,
    latest_event_date: "2026-06-23",
    categories_present: ["COMPLIANCE", "FILING"],
    events: [
      {
        event_date: "2026-06-23",
        request_type: "דו~ח שנתי",
        category: "FILING",
        request_type_code: null,
        charge_id: null,
        source_record_id: "example-2",
      },
      {
        event_date: "2026-05-26",
        request_type: "עדכון הפרה",
        category: "COMPLIANCE",
        request_type_code: null,
        charge_id: null,
        source_record_id: "example-1",
      },
    ],
  },
  evidence: [],
  limitations: [
    "The official changes dataset covers up to approximately one year; an empty result does not prove that no earlier change occurred.",
  ],
  checked_at: "2026-09-04T00:00:00.000Z",
};
