import { createMcpRoute } from "@/lib/mcp-handler";

const route = createMcpRoute("testnet");

export const GET = route.GET;
export const POST = route.POST;
export const DELETE = route.DELETE;
export const OPTIONS = route.OPTIONS;
