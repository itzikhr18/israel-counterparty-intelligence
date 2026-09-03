import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { type NextRequest, NextResponse } from "next/server";

import type { PaymentEnvironmentName } from "@/lib/config";
import { config } from "@/lib/config";
import { createIsraelMcpServer } from "@/lib/mcp-server";
import { logMcpRequest, logMcpResponse } from "@/lib/mcp-telemetry";
import { authorizePilotRequest, pilotResponseHeaders } from "@/lib/pilot";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id, x-discovery-source, x-internal-test-token",
  "access-control-expose-headers": "mcp-protocol-version, mcp-session-id",
  "cache-control": "no-store",
};

function withHeaders(
  response: Response,
  extraHeaders: Record<string, string> = {},
): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS))
    headers.set(name, value);
  for (const [name, value] of Object.entries(extraHeaders))
    headers.set(name, value);
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createMcpRoute(
  environmentName: PaymentEnvironmentName,
  options: { accessMode?: "paid" | "pilot" } = {},
) {
  const accessMode = options.accessMode ?? "paid";
  const responseHeaders = accessMode === "pilot" ? pilotResponseHeaders() : {};

  async function handle(request: NextRequest): Promise<Response> {
    if (accessMode === "pilot") {
      const unauthorized = authorizePilotRequest(request);
      if (unauthorized) return withHeaders(unauthorized, responseHeaders);
    }

    let parsedBody: unknown;
    if (request.method === "POST") {
      try {
        parsedBody = await request.json();
      } catch {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error" },
          },
          { status: 400, headers: CORS_HEADERS },
        );
      }
      logMcpRequest(
        request,
        parsedBody,
        environmentName,
        accessMode === "pilot"
          ? { clientClass: "pilot", partnerId: config.PILOT_PARTNER_ID }
          : undefined,
      );
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = await createIsraelMcpServer(environmentName, { accessMode });
    await server.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody });
    if (request.method === "POST") {
      try {
        const responseBody = await response.clone().json();
        logMcpResponse(request, parsedBody, responseBody, environmentName);
      } catch {
        // Non-JSON transport responses are not payment funnel events.
      }
    }
    return withHeaders(response, responseHeaders);
  }

  async function methodNotAllowed(): Promise<Response> {
    return withHeaders(
      NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32600,
            message:
              "This stateless MCP server accepts JSON-RPC over POST only",
          },
        },
        { status: 405, headers: { allow: "POST, OPTIONS" } },
      ),
      responseHeaders,
    );
  }

  return {
    GET: methodNotAllowed,
    POST: handle,
    DELETE: methodNotAllowed,
    OPTIONS: async () =>
      withHeaders(
        new Response(null, { status: 204, headers: CORS_HEADERS }),
        responseHeaders,
      ),
  };
}
