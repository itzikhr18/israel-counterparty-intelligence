import type { Evidence, ResolvedEntity, RiskResult } from "@/lib/domain";
import { SCORING_VERSION } from "@/lib/domain";

const INACTIVE_POINTS = 40;
const LAW_VIOLATION_POINTS = 25;
const STALE_REPORT_POINTS = 10;

function isActive(status: string): boolean {
  const normalized = status.trim().toLocaleLowerCase("he");
  return normalized === "פעילה" || normalized === "active";
}

export function scoreRisk(
  entity: ResolvedEntity,
  resolutionConfidence: number,
  now = new Date(),
): { risk: RiskResult; evidence: Evidence } {
  const reasons: string[] = [];
  let score = 0;

  if (!isActive(entity.status)) {
    score += INACTIVE_POINTS;
    reasons.push("ENTITY_NOT_ACTIVE");
  }
  if (entity.law_violation_flag === true) {
    score += LAW_VIOLATION_POINTS;
    reasons.push("LAW_VIOLATION_FLAG");
  }
  const staleThreshold = now.getUTCFullYear() - 2;
  if (
    entity.latest_annual_report_year !== null &&
    entity.latest_annual_report_year < staleThreshold
  ) {
    score += STALE_REPORT_POINTS;
    reasons.push("ANNUAL_REPORT_STALE");
  }
  if (entity.latest_annual_report_year === null)
    reasons.push("ANNUAL_REPORT_UNKNOWN");

  score = Math.min(100, score);
  const level = score >= 50 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";
  const confidence = Number(
    Math.max(
      0,
      Math.min(
        1,
        resolutionConfidence -
          (entity.latest_annual_report_year === null ? 0.1 : 0),
      ),
    ).toFixed(3),
  );
  const risk: RiskResult = {
    score,
    level,
    reason_codes: reasons,
    explanation:
      reasons.length === 0
        ? "No material public warning flags were found in the checked sources."
        : `The score reflects these public signals: ${reasons.join(", ")}.`,
    confidence,
    scoring_version: SCORING_VERSION,
  };

  return {
    risk,
    evidence: {
      field: "risk_level",
      value: level,
      type: "inference",
      source: "Israel Counterparty Intelligence scoring engine",
      source_url: null,
      retrieved_at: now.toISOString(),
      source_record_id: entity.company_number,
      confidence,
      based_on: [
        "company_status",
        "law_violation_flag",
        "latest_annual_report_year",
      ],
      scoring_version: SCORING_VERSION,
    },
  };
}
