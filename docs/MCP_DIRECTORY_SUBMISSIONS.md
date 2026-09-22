# MCP directory submissions (founder phone checklist)

**Contact:** itzikhr18@gmail.com  
**Live MCP:** `https://israel-counterparty-intelligence.vercel.app/mcp`  
**Repo:** `https://github.com/itzikhr18/israel-counterparty-intelligence`  
**Metadata:** `https://israel-counterparty-intelligence.vercel.app/mcp.json`  
**Status page:** `https://israel-counterparty-intelligence.vercel.app/STATUS.md`  

Automation cannot finish these listings without human captcha / OAuth. Drafts below are ready to paste. Prefer **Free** plans; do not buy Premium unless you choose to.

Honest claim to use everywhere: **Mainnet live · awaiting first external paid call · no customer logos.**

---

## 1) mcpservers.org (form — human submit)

1. Open https://mcpservers.org/submit on your phone or laptop.
2. Fill:
   - **Server Name:** `Israel Business Intelligence MCP`
   - **Category:** `Finance` (fallback: `Other`)
   - **Short Description:**  
     `Israeli invoice payment gate for AI agents: VAT + allocation-number checks, PAY/HOLD/BLOCK, company verification/changes, and vendor-risk with public-registry evidence. Free previews; paid tools via x402 USDC on Base Mainnet. No API key. Mainnet live — awaiting first external paid call.`
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
Israeli invoice payment gate for AI agents. Checks VAT arithmetic and allocation-number applicability, resolves the supplier against public company-registry evidence, and returns PAY, HOLD, or BLOCK. Also company verification, company changes ($0.01), and vendor payment-risk. Free previews + x402 USDC on Base Mainnet. No API key. Status: Mainnet live, awaiting first external paid call.
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
Israel-specific counterparty intelligence over MCP + x402. Invoice PAY/HOLD/BLOCK gate, $0.01 company-changes, verification, vendor-risk. Free previews. Base Mainnet USDC. Awaiting first external paid call.
```

---

## 3) Glama (GitHub login — human)

FAQ: https://glama.ai/mcp/faq · claim via root `glama.json` (added in this PR).

### A) Open-source server indexing

1. Open Glama MCP servers → **Add MCP Server**.
2. GitHub repository URL: `https://github.com/itzikhr18/israel-counterparty-intelligence`
3. Display name: `Israel Business Intelligence MCP`
4. Short description: same paste-ready text as mcpservers.org.
5. After index, **Claim ownership** (repo is under `itzikhr18`; `glama.json` lists `itzikhr18` as maintainer).

### B) Remote connector (recommended for hosted endpoint)

1. Add MCP Server → **Connector**.
2. Name: `Israel Business Intelligence MCP`
3. Server URL: `https://israel-counterparty-intelligence.vercel.app/mcp`
4. Transport: streamable-http / HTTPS
5. Optional private test credentials: leave empty (no API key; use free tools for smoke).

Note: Glama historically prefers stdio for some hosted runners; the **Connector** path is the correct fit for this remote x402 service.

---

## 4) Already published / do not duplicate

| Surface | ID / URL | Notes |
| --- | --- | --- |
| Official MCP registry name | `io.github.itzikhr18/israel-business-intelligence` | See repo `server.json` |
| Agent Tools | `israel-counterparty-intelligence-vercel-app-sub393` | Linked from llms.txt |
| x402scan | `e9b83616-3c3e-483a-81a2-a93c2b85dd7e` | |
| 402 Index | `fa0902ac-90a7-431a-8979-97da22a12911` | Index DOWN / payment-requirements fix owned by another agent — do not fight |
| agentskills.co.il | See `docs/AGENTSKILLS_MCP_SUBMISSION.md` | Separate form |

---

## Founder confirmation after submit

Update this table when done (date in Asia/Jerusalem):

| Directory | Submitted? | Listing URL | Notes |
| --- | --- | --- | --- |
| mcpservers.org | | | |
| Smithery | | | |
| Glama server | | | |
| Glama connector | | | |
