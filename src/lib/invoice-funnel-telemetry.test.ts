import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logInvoiceFunnel } from "./invoice-funnel-telemetry";
import { logMcpRequest, logMcpResponse } from "./mcp-telemetry";

afterEach(() => vi.restoreAllMocks());

describe("invoice funnel telemetry", () => {
  it("logs only bounded outcomes and separates internal browser tests", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    logInvoiceFunnel(
      new NextRequest("https://example.com/invoice-preview", {
        headers: { "x-discovery-source": "internal-post-deploy-smoke" },
      }),
      "invoice_preview_delivered",
      { action: "HOLD", allocationApplicability: "REQUIRED" },
    );
    const event = JSON.parse(log.mock.calls[0]?.[0] ?? "{}");
    expect(event).toMatchObject({
      event: "invoice_preview_delivered",
      client_class: "internal_test",
      decision: "HOLD",
    });
    expect(Object.keys(event).sort()).toEqual([
      "allocation_applicability",
      "client_class",
      "decision",
      "event",
      "telemetry_version",
      "timestamp",
      "transport",
    ]);
  });

  it("counts invoice previews and unpaid invoice challenges as distinct steps", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const request = new NextRequest("https://example.com/mcp", {
      headers: { "x-discovery-source": "internal-post-deploy-smoke" },
    });
    const preview = {
      method: "tools/call",
      params: { name: "preview_israeli_invoice_payment_gate_free" },
    };
    logMcpRequest(request, preview, "mainnet");
    logMcpResponse(
      request,
      preview,
      { result: { structuredContent: { decision: { action: "HOLD" } } } },
      "mainnet",
    );
    const paid = {
      method: "tools/call",
      params: { name: "authorize_israeli_invoice_payment_paid" },
    };
    logMcpRequest(request, paid, "mainnet");
    logMcpResponse(
      request,
      paid,
      { result: { structuredContent: { x402Version: 2, accepts: [] } } },
      "mainnet",
    );
    const events = log.mock.calls.map(([line]) => JSON.parse(line));
    expect(events.map((event) => event.event)).toEqual([
      "mcp_preview_called",
      "mcp_preview_delivered",
      "mcp_verify_unpaid",
      "mcp_payment_required_delivered",
    ]);
    expect(
      events.every((event) => event.client_class === "internal_test"),
    ).toBe(true);
    expect(events.some((event) => event.event === "external_paid_call")).toBe(
      false,
    );
  });
});
