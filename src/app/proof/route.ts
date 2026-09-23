import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const html = readFileSync(join(process.cwd(), "public", "proof.html"), "utf8");
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
