# MCP directory submissions (founder phone checklist)

**Contact:** itzikhr18@gmail.com  
**Live MCP:** `https://israel-counterparty-intelligence.vercel.app/mcp`  
**Repo:** `https://github.com/itzikhr18/israel-counterparty-intelligence`  
**Metadata:** `https://israel-counterparty-intelligence.vercel.app/mcp.json`  
**Status page:** `https://israel-counterparty-intelligence.vercel.app/STATUS.md`

Automation cannot finish these listings without human captcha / OAuth. Drafts below are ready to paste. Prefer **Free** plans; do not buy Premium unless you choose to.

Honest claim to use everywhere: **Mainnet live · first external paid call confirmed · no customer logos.**

---

## 1) mcpservers.org (form — human submit)

**Done — approved 2026-09-25 01:02 (Asia/Jerusalem).** Approval email from `contact@mcpservers.org`; listing live at https://mcpservers.org/servers/itzikhr18/israel-counterparty-intelligence under the name “Israel Counterparty Intelligence”. Badge added to the repo README. The email also offered paid sponsorship (mcpservers.org + awesome-mcp-servers); not taken. Steps below are kept for reference. Duplicate: the directory also carries an older auto-crawled entry (“Israel Business Intelligence MCP Server”, slug `israel-counterparty-intelligence-vercel-app-readme-md`) whose copy still says paid services are suspended (confirmed via web search 2026-09-25; the page itself is not reachable from the agent environment). A removal/merge request is drafted in Gmail as a reply on the approval thread; **owner sends it from the Gmail web UI**.

1. Open https://mcpservers.org/submit on your phone or laptop.
2. Fill:
   - **Server Name:** `Israel Business Intelligence MCP`
   - **Category:** `Finance` (fallback: `Other`)
   - **Short Description:**  
     `Israeli invoice payment gate for AI agents: VAT + allocation-number checks, PAY/HOLD/BLOCK, company verification/changes, and vendor-risk with public-registry evidence. Free previews; paid tools via x402 USDC on Base Mainnet. No API key. Mainnet live — first external paid call confirmed (see /proof).`
   - **Repository, Website or Documentation:** `https://github.com/itzikhr18/israel-counterparty-intelligence`  
     (also acceptable: `https://israel-counterparty-intelligence.vercel.app/mcp.json`)
   - **Official MCP Registry Name (optional):** `io.github.itzikhr18/israel-business-intelligence`
   - **This server supports remote connections:** checked / yes
   - **Contact Email:** `itzikhr18@gmail.com`
   - **Submission plan:** Free ($0)
3. Submit. Expect email when approved (Free lane can take up to ~2 weeks).
4. Do **not** invent screenshots with logos.

**Paste-ready short description (≤500 chars):**

```
Israeli invoice payment gate for AI agents. Checks VAT arithmetic and allocation-number applicability, resolves the supplier against public company-registry evidence, and returns PAY, HOLD, or BLOCK. Also company verification, company changes ($0.01), and vendor payment-risk. Free previews + x402 USDC on Base Mainnet. No API key. Status: Mainnet live, first external paid call confirmed (see /proof).
```

---

## 2) Smithery (OAuth / browser — human)

Docs: https://www.smithery.ai/docs/build/publish

1. Open https://smithery.ai/new while logged into the Smithery account you want to own the listing.
2. Enter public HTTPS MCP URL:  
   `https://israel-counterparty-intelligence.vercel.app/mcp`
3. Complete the publish / scan flow. Transport is **streamable-http**. Free tools need no OAuth; paid tools challenge with x402 (scan should still list tools).
4. Optional CLI (only if already authenticated on that machine):

```bash
npx --yes @smithery/cli mcp publish \
  "https://israel-counterparty-intelligence.vercel.app/mcp" \
  -n @itzikhr18/israel-business-intelligence
```

5. If scan fails with 403, follow Smithery’s SmitheryBot allowlist notes — or publish a static card later at `/.well-known/mcp/server-card.json` (not required for this GTM pack).
6. Suggested display blurb (if asked):

```
Israel-specific counterparty intelligence over MCP + x402. Invoice PAY/HOLD/BLOCK gate, $0.01 company-changes, verification, vendor-risk. Free previews. Base Mainnet USDC. First external paid call confirmed (see /proof).
```

---

## 3) Glama — **DONE (ownership verified 2026-09-23)**

- Listing: https://glama.ai/mcp/connectors/io.github.itzikhr18/israel-business-intelligence
- Claim file (keep published): `public/.well-known/glama.json`
- Root maintainer metadata: repo `glama.json` (`maintainers: ["itzikhr18"]`)
- Frank (`frank@glama.ai`) notified after claim — waiting for listing refresh of payments-live / $0.01 path
- FAQ (if claim ever drops): https://glama.ai/mcp/faq — Claim with GitHub or republish `/.well-known/glama.json`

---

## 4) Already published / do not duplicate

| Surface                    | ID / URL                                             | Notes                                                                       |
| -------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Official MCP registry name | `io.github.itzikhr18/israel-business-intelligence`   | See repo `server.json`                                                      |
| Agent Tools                | `israel-counterparty-intelligence-vercel-app-sub393` | Linked from llms.txt                                                        |
| x402scan                   | `e9b83616-3c3e-483a-81a2-a93c2b85dd7e`               |                                                                             |
| 402 Index                  | `fa0902ac-90a7-431a-8979-97da22a12911`               | Index DOWN / payment-requirements fix owned by another agent — do not fight |
| agentskills.co.il          | See `docs/AGENTSKILLS_MCP_SUBMISSION.md`             | Separate form                                                               |

---

## Founder confirmation after submit

Update this table when done (date in Asia/Jerusalem):

| Directory       | Submitted?                    | Listing URL                                                                      | Notes                                                                                                                      |
| --------------- | ----------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| mcpservers.org  | **YES** — approved 2026-09-25 | https://mcpservers.org/servers/itzikhr18/israel-counterparty-intelligence        | Approval email 25.09 01:02 IDT; listed as “Israel Counterparty Intelligence”; badge in README; sponsorship offer not taken |
| Smithery        |                               |                                                                                  | browser/OAuth                                                                                                              |
| Glama server    | n/a                           |                                                                                  | using connector path                                                                                                       |
| Glama connector | **YES** 2026-09-23            | https://glama.ai/mcp/connectors/io.github.itzikhr18/israel-business-intelligence | Ownership verified; Frank pinged for refresh                                                                               |
