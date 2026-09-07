# Security containment release — 7 September 2026

Scope: deploy the reviewed security fixes and temporarily suspend paid service on the existing Vercel project. No infrastructure upgrade, migration, payment, credential change or commercial-launch approval is included.

## Controls

- `service-availability.ts` defaults to a versioned suspension, independent of x402 flags. Seven paid REST routes return 503 before payment initialization or report operations. Five paid MCP tool names on both networks return an explicit error without payment metadata. Wallet handoff preparation is paused. Direct blockchain transfers cannot be prevented by application code.
- Free previews, sample reports and schemas remain available. Authenticated, payment-waived pilot access remains separately authorized.
- Discovery stops advertising purchasable x402 endpoints. Health, landing and direct-entry buyer documentation disclose the suspension.
- Public manifest/JWKS HTTPS reads reject non-public destinations, pin checked DNS addresses at the socket, preserve hostname/TLS validation, reject redirects and compressed responses, and bound time, bytes and response headers.
- The facilitator adapter rejects unsuccessful settlements instead of releasing a paid response.
- JSON/forms are bounded to 64 KiB by default; MCP JSON to 1 MiB. Local rate limiting no longer treats caller-controlled User-Agent changes as a new identity, bounds active identities and fails closed when full.

## Verification and limits

Run `npm run check` and `node scripts/security-release-smoke.mjs http://127.0.0.1:3017` against a locally started build. Run the same bounded smoke script against the production origin after the deployment is READY. The smoke uses synthetic inputs and deliberately invalid payment headers; it never loads a wallet or creates a payment.

Automated tests distinguish the deployed suspension default from explicitly mocked historical active-payment contracts. Passing mocks does not prove a real settlement, global abuse prevention or commercial readiness.

Remaining launch gates include commercial hosting permission, required legal/accounting and privacy approvals, durable payment/order/delivery/accounting reconciliation, replay/duplicate-delivery assurance, operational monitoring and distributed abuse controls. The in-memory limiter is per instance and depends on the hosting proxy replacing forwarding headers; it is not authentication or a global quota. Conservative IPv6 filtering may reject some legitimate hosts. Live TLS/timeout behavior needs further integration assurance before commercial resumption.

## Resumption and rollback

Do not resume by changing x402 flags. Keep `PAID_SERVICE_SUSPENDED = true` until separate written launch approval and closure evidence exist. Before resumption, explicitly test accounting, payment failure/uncertain settlement, replay, delivery and refunds using an authorized independent real buyer—not a self-payment.

If this release needs correction, deploy a forward fix retaining suspension. Do not blindly roll back to a pre-suspension deployment: it could reopen charging and restore the previous security exposure. Preserve unrelated feature work and never include local secrets in the release.
