import { describe, expect, it } from "vitest";

import {
  MCP_SERVER_NAME,
  mcpCompanyChangesPrice,
  mcpCompanyChangesRequirements,
  mcpCompanyChangesResourceUrl,
  mcpEndpointPath,
  mcpInvoiceGatePrice,
  mcpInvoiceGateRequirements,
  mcpInvoiceGateResourceUrl,
  mcpPaymentRequirements,
  mcpPaymentRiskPrice,
  mcpPaymentRiskRequirements,
  mcpPaymentRiskResourceUrl,
  mcpPrice,
  mcpToolResourceUrl,
} from "@/lib/mcp-server";

describe("Israel Business Intelligence MCP configuration", () => {
  it("keeps Mainnet and Testnet payment requirements isolated", () => {
    const testnet = mcpPaymentRequirements("testnet")[0];
    const mainnet = mcpPaymentRequirements("mainnet")[0];
    expect(testnet).toBeDefined();
    expect(mainnet).toBeDefined();
    if (!testnet || !mainnet)
      throw new Error("Missing MCP payment requirement");

    expect(MCP_SERVER_NAME).toBe("Israel Business Intelligence MCP");
    expect(mcpPrice("testnet")).toBe("$0.05");
    expect(mcpPrice("mainnet")).toBe("$0.05");
    expect(mcpPaymentRiskPrice("mainnet")).toBe("$0.10");
    expect(testnet).toMatchObject({
      scheme: "exact",
      network: "eip155:84532",
      amount: "50000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    });
    expect(mainnet).toMatchObject({
      scheme: "exact",
      network: "eip155:8453",
      amount: "50000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    });
    expect(testnet.network).not.toBe(mainnet.network);
    expect(testnet.asset).not.toBe(mainnet.asset);
  });

  it("charges 0.10 USDC for the distinct payment-risk resource", () => {
    const requirement = mcpPaymentRiskRequirements("mainnet")[0];
    expect(requirement).toMatchObject({
      scheme: "exact",
      network: "eip155:8453",
      amount: "100000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    });
    expect(mcpPaymentRiskResourceUrl("mainnet")).toContain(
      "assess_payment_risk/mainnet",
    );
    expect(mcpPaymentRiskResourceUrl("mainnet")).not.toBe(
      mcpToolResourceUrl("mainnet"),
    );
  });

  it("charges 0.25 USDC for the distinct invoice-gate resource", () => {
    const requirement = mcpInvoiceGateRequirements("mainnet")[0];
    expect(mcpInvoiceGatePrice("mainnet")).toBe("$0.25");
    expect(requirement).toMatchObject({
      scheme: "exact",
      network: "eip155:8453",
      amount: "250000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    });
    expect(mcpInvoiceGateResourceUrl("mainnet")).toContain(
      "invoice_payment_gate/mainnet",
    );
  });

  it("charges 0.01 USDC for the distinct company-changes resource", () => {
    const requirement = mcpCompanyChangesRequirements("mainnet")[0];
    expect(mcpCompanyChangesPrice("mainnet")).toBe("$0.01");
    expect(requirement).toMatchObject({
      scheme: "exact",
      network: "eip155:8453",
      amount: "10000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    });
    expect(mcpCompanyChangesResourceUrl("mainnet")).toContain(
      "company_changes/mainnet",
    );
    expect(mcpCompanyChangesResourceUrl("mainnet")).not.toBe(
      mcpToolResourceUrl("mainnet"),
    );
  });

  it("uses distinct MCP endpoints and payment resource identifiers", () => {
    expect(mcpEndpointPath("mainnet")).toBe("/mcp");
    expect(mcpEndpointPath("testnet")).toBe("/mcp/testnet");
    expect(mcpToolResourceUrl("mainnet")).not.toBe(
      mcpToolResourceUrl("testnet"),
    );
  });
});
