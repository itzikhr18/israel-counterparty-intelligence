import assert from "node:assert/strict";
import test from "node:test";
import { matchesServiceOrigin } from "./bazaar-rank-match.mjs";

const origin = "https://israel-counterparty-intelligence.vercel.app";
const tool = (url) => ({
  _meta: { "x402/payment-required": { resource: { url } } },
});

test("matches the actual payment resource on the service origin", () => {
  assert.equal(
    matchesServiceOrigin(tool(`${origin}/v1/verify/mainnet`), origin),
    true,
  );
});

test("rejects misleading URL references and missing resource metadata", () => {
  for (const url of [
    `${origin}.attacker.example/api`,
    `https://attacker.example/?target=${origin}`,
    "https://israel-counterparty-intelligence.vercel.app@attacker.example/api",
    `${origin}:8443/api`,
    "not a URL",
    undefined,
  ]) {
    assert.equal(matchesServiceOrigin(tool(url), origin), false);
  }
  assert.equal(matchesServiceOrigin({ description: origin }, origin), false);
  assert.equal(matchesServiceOrigin(null, origin), false);
});
