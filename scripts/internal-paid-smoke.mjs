import fs from "node:fs";

import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const walletFile = process.env.X402_TEST_WALLET_FILE;
if (!walletFile) throw new Error("X402_TEST_WALLET_FILE is required");

const endpoint =
  "https://israel-counterparty-intelligence.vercel.app/v1/verify";
const requestBody = JSON.stringify({
  company_number: "514744887",
  language: "en",
});
const privateKey = JSON.parse(fs.readFileSync(walletFile, "utf8")).privateKey;
const account = privateKeyToAccount(privateKey);

const client = new x402Client();
registerExactEvmScheme(client, {
  signer: account,
  networks: ["eip155:84532"],
});
const httpClient = new x402HTTPClient(client);

const requestHeaders = {
  "content-type": "application/json",
  "user-agent": "internal-x402-test",
};
const initial = await fetch(endpoint, {
  method: "POST",
  headers: requestHeaders,
  body: requestBody,
});
const initialBody = await initial.json();
if (initial.status !== 402)
  throw new Error(`Expected HTTP 402, received ${initial.status}`);

const paymentRequired = httpClient.getPaymentRequiredResponse(
  (name) => initial.headers.get(name),
  initialBody,
);
const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

const paid = await fetch(endpoint, {
  method: "POST",
  headers: { ...requestHeaders, ...paymentHeaders },
  body: requestBody,
});
const paidBody = await paid.json();
const settlement = httpClient.getPaymentSettleResponse((name) =>
  paid.headers.get(name),
);

console.log(
  JSON.stringify(
    {
      payer: account.address,
      initialStatus: initial.status,
      finalStatus: paid.status,
      paymentRequired: {
        x402Version: paymentRequired.x402Version,
        network: paymentRequired.accepts?.[0]?.network,
        amount: paymentRequired.accepts?.[0]?.amount,
        asset: paymentRequired.accepts?.[0]?.asset,
        payTo: paymentRequired.accepts?.[0]?.payTo,
      },
      settlement,
      apiResponse: paidBody,
    },
    null,
    2,
  ),
);
