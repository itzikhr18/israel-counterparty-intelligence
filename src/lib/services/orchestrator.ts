import {
  budgetKeyAdapter,
  type BudgetKeyAdapter,
} from "@/lib/adapters/budget-key";
import type { AgentPaymentTrustQuery } from "@/lib/agent-payment-trust-schema";
import type { CounterpartyQuery, EntityResolution } from "@/lib/domain";
import { API_VERSION, ApiError } from "@/lib/domain";
import type { CompanyChangesQuery } from "@/lib/company-changes-schema";
import type { PaymentRiskQuery } from "@/lib/payment-risk-schema";
import {
  entityResolutionService,
  type EntityResolutionService,
} from "@/lib/services/entity-resolution";
import { assessAgentPaymentTrust } from "@/lib/services/agent-payment-trust";
import { assessPaymentRisk } from "@/lib/services/payment-risk";
import { companyChangesService } from "@/lib/services/company-changes";
import { scoreRisk } from "@/lib/services/risk-scoring";

function requireResolved(resolution: EntityResolution) {
  if (resolution.status === "AMBIGUOUS") {
    throw new ApiError(
      409,
      "AMBIGUOUS_ENTITY",
      "Multiple plausible entities were found; provide company_number or more context",
      { candidates: resolution.candidates },
    );
  }
  if (resolution.status === "NOT_FOUND") {
    throw new ApiError(
      422,
      "ENTITY_NOT_FOUND",
      "No reliable registered company was found",
    );
  }
  return resolution;
}

function summaryFor(resolution: EntityResolution, language: "en" | "he") {
  if (resolution.status !== "RESOLVED") return null;
  const { entity } = resolution;
  if (language === "he") {
    return `${entity.legal_name} (${entity.company_number}) רשומה במצב ${entity.status}.`;
  }
  return `${entity.legal_name} (${entity.company_number}) is registered with status ${entity.status}.`;
}

export class CounterpartyOrchestrator {
  constructor(
    private readonly resolver: EntityResolutionService = entityResolutionService,
    private readonly budgetKey: BudgetKeyAdapter = budgetKeyAdapter,
  ) {}

  async verify(query: CounterpartyQuery) {
    const resolution = await this.resolver.resolve(query);
    return {
      api_version: API_VERSION,
      query,
      resolution_status: resolution.status,
      resolved_entity: resolution.entity,
      candidates: resolution.candidates,
      confidence: resolution.confidence,
      summary: summaryFor(resolution, query.language),
      evidence: resolution.evidence,
      missing_data: resolution.missing_data,
      checked_at: new Date().toISOString(),
    };
  }

  async governmentFootprint(query: CounterpartyQuery) {
    const resolution = requireResolved(await this.resolver.resolve(query));
    const footprint = await this.budgetKey.getFootprint(
      resolution.entity.company_number,
    );
    return {
      api_version: API_VERSION,
      query,
      entity: resolution.entity,
      entity_resolution_confidence: resolution.confidence,
      government_footprint: footprint,
      evidence: [...resolution.evidence, ...footprint.evidence],
      missing_data: [
        ...new Set([...resolution.missing_data, ...footprint.missing_data]),
      ],
      checked_at: new Date().toISOString(),
    };
  }

  async counterpartyRisk(query: CounterpartyQuery) {
    const resolution = requireResolved(await this.resolver.resolve(query));
    const footprint = await this.budgetKey.getFootprint(
      resolution.entity.company_number,
    );
    const { risk, evidence: riskEvidence } = scoreRisk(
      resolution.entity,
      resolution.confidence,
    );
    return {
      api_version: API_VERSION,
      query,
      entity: resolution.entity,
      verify: {
        confidence: resolution.confidence,
        evidence: resolution.evidence,
      },
      government_footprint: footprint,
      public_flags: {
        law_violation: resolution.entity.law_violation_flag,
        entity_active: ["פעילה", "active"].includes(
          resolution.entity.status.toLocaleLowerCase("he"),
        ),
        latest_annual_report_year: resolution.entity.latest_annual_report_year,
      },
      nonprofit: null,
      listed_company: null,
      risk,
      summary: risk.explanation,
      evidence: [...resolution.evidence, ...footprint.evidence, riskEvidence],
      missing_data: [
        ...new Set([
          ...resolution.missing_data,
          ...footprint.missing_data,
          "sanctions_check",
          "insolvency_check",
          "nonprofit_enrichment",
          "listed_company_enrichment",
        ]),
      ],
      disclaimer:
        "Heuristic operational intelligence from public sources; not legal, credit, sanctions, or investment advice.",
      checked_at: new Date().toISOString(),
    };
  }

  async paymentRisk(query: PaymentRiskQuery) {
    const identityQuery: CounterpartyQuery = {
      company_number: query.company_number ?? query.invoice_company_number,
      company_name: query.company_name ?? query.invoice_company_name,
      website: query.invoice_website,
      city: query.invoice_city,
      language: query.language,
      depth: "standard",
    };
    const resolution = requireResolved(
      await this.resolver.resolve(identityQuery),
    );
    return {
      api_version: API_VERSION,
      query,
      ...assessPaymentRisk(
        query,
        resolution.entity,
        resolution.confidence,
        resolution.evidence,
      ),
    };
  }

  async companyChanges(query: CompanyChangesQuery) {
    const resolution = requireResolved(
      await this.resolver.resolve({
        company_number: query.company_number,
        language: query.language,
        depth: "standard",
      }),
    );
    const recent = await companyChangesService.getRecentChanges(
      query,
      resolution.entity,
    );
    return {
      api_version: API_VERSION,
      query,
      entity: {
        legal_name: resolution.entity.legal_name,
        company_number: resolution.entity.company_number,
        status: resolution.entity.status,
      },
      changes: recent.changes,
      evidence: [...resolution.evidence, ...recent.evidence],
      limitations: recent.limitations,
      checked_at: new Date().toISOString(),
    };
  }

  async agentPaymentTrust(query: AgentPaymentTrustQuery) {
    const resolution = await this.resolver.resolve({
      company_number: query.company_number,
      company_name: query.company_name,
      website: query.service_url,
      language: query.language,
      depth: "standard",
    });
    return assessAgentPaymentTrust(query, resolution);
  }
}

export const counterpartyOrchestrator = new CounterpartyOrchestrator();
