const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const expectX402 = process.env.EXPECT_X402 === "true";
const verifyPath = process.env.VERIFY_PATH ?? "/v1/verify";
const expectedAmount = process.env.EXPECTED_X402_AMOUNT ?? "100000";
const expectedNetwork = process.env.EXPECTED_X402_NETWORK ?? "eip155:84532";
const expectedAsset = process.env.EXPECTED_X402_ASSET;
const expectedPayTo = process.env.EXPECTED_X402_PAY_TO;

function assertResponse(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await fetch(`${baseUrl}/health`);
assertResponse(health.ok, `Health failed with ${health.status}`);

const verify = await fetch(`${baseUrl}${verifyPath}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ company_number: "514744887", language: "en" }),
});

if (expectX402) {
  assertResponse(
    verify.status === 402,
    `Expected 402, received ${verify.status}`,
  );
  const paymentRequired = verify.headers.get("payment-required");
  assertResponse(
    paymentRequired,
    "402 response did not include PAYMENT-REQUIRED",
  );
  const challenge = JSON.parse(
    Buffer.from(paymentRequired, "base64").toString("utf8"),
  );
  assertResponse(challenge.x402Version === 2, "Challenge is not x402 v2");
  const requirement = challenge.accepts?.[0];
  assertResponse(
    requirement?.amount === expectedAmount,
    `Unexpected x402 amount ${requirement?.amount}`,
  );
  assertResponse(
    requirement?.network === expectedNetwork,
    `Unexpected x402 network ${requirement?.network}`,
  );
  if (expectedAsset)
    assertResponse(
      requirement?.asset === expectedAsset,
      `Unexpected x402 asset ${requirement?.asset}`,
    );
  if (expectedPayTo)
    assertResponse(
      requirement?.payTo === expectedPayTo,
      `Unexpected x402 payTo ${requirement?.payTo}`,
    );
  assertResponse(
    challenge.extensions?.bazaar,
    "Bazaar discovery metadata is missing",
  );
  assertResponse(
    challenge.extensions.bazaar.info?.input?.method === "POST",
    "Bazaar metadata does not declare POST",
  );
  console.log(
    JSON.stringify({
      status: "ok",
      mode: "x402-challenge",
      baseUrl,
      verifyPath,
      requirement,
    }),
  );
  process.exit(0);
}

assertResponse(verify.ok, `Verify failed with ${verify.status}`);
const verifyBody = await verify.json();
assertResponse(
  verifyBody.resolution_status === "RESOLVED",
  "Company was not resolved",
);
assertResponse(
  verifyBody.resolved_entity?.company_number === "514744887",
  "Wrong company number",
);
assertResponse(Boolean(verifyBody.evidence?.length), "Evidence is missing");

const footprint = await fetch(`${baseUrl}/v1/government-footprint`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ company_number: "514744887", language: "en" }),
});
assertResponse(
  footprint.ok,
  `Government footprint failed with ${footprint.status}`,
);
const footprintBody = await footprint.json();
assertResponse(
  footprintBody.government_footprint?.available,
  "Government footprint unavailable",
);

console.log(
  JSON.stringify({
    status: "ok",
    mode: "live-sources",
    baseUrl,
    contract_count:
      footprintBody.government_footprint?.contracts?.count ?? null,
  }),
);
