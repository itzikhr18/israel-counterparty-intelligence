# Routines — scheduled Claude runs for this project

Scheduled runs that keep the P0 rule "answer human replies within hours" true without the owner watching the inbox. A Routine created from inside a Claude Code session in this workspace cannot carry connectors (the organization does not allow it), so the inbox routine has to be created once from the claude.ai Routines UI, where the Gmail connector can be attached.

## 1. Morning inbox check (drafts only) — create from the Routines UI

- **Where:** claude.ai → Routines → New routine. Environment: the one that holds this repository. Connectors: **Gmail** (required). Notifications: push + email.
- **Schedule:** Sunday to Thursday, 08:41 Asia/Jerusalem (cron `41 8 * * 0-4`).
- **What it does:** reads the CRM and the reply kit from the repo, finds human replies from tracked counterparties in the last 48 hours, creates a link-free **draft** reply on each thread from the matching template, and reports in Hebrew. It never sends email, never edits the repo, and stops with a one-line report if Gmail is not attached.
- **Cost:** one short session per weekday; disable it from the same UI when outreach goes quiet.

Paste this as the routine's prompt:

```text
You are running the scheduled morning inbox check for Israel Counterparty Intelligence (repository itzikhr18/israel-counterparty-intelligence, already cloned in the working directory). The goal is that no human reply from a partner or prospect waits more than one working day. The owner (Itzik Harush, itzikhr18@gmail.com) reads your report in Hebrew.

First, check whether Gmail tools (mcp__Gmail__search_threads, mcp__Gmail__get_thread, mcp__Gmail__create_draft) are available to you, loading them with ToolSearch if they are deferred. If Gmail is not connected to this session, stop immediately and report in one Hebrew line that the Gmail connector was not attached to the scheduled run, so the owner can attach it or disable this routine. Do nothing else in that case.

Otherwise do exactly this:

1. Read docs/OUTREACH_CRM.md and docs/REPLY_TEMPLATES.md from the repository. The CRM lists every counterparty, its status, and the honesty rules. The templates are the reply kit.

2. Search the inbox for messages from the last 48 hours that are human replies related to the project: replies on threads the owner started about Israel Counterparty Intelligence, and any message from the counterparties tracked in the CRM (Grow / grow.business, Morning / morning.co.il / greeninvoice.co.il, iCount / icount.co.il, SUMIT / sumit.co.il, mcpservers.org, Glama / glama.ai, x402radar.com, Mesh / meshpayments.com, Dokka / dokka.com, Cardcom / cardcom.co.il, Aerchain / aerchain.io, EasyCount / ezcount.co.il, HYP / hyp.co.il, Atzmai / atzmai.co.il). Read each relevant thread in full with get_thread before judging it. Ignore newsletters, marketing, automated notifications (GitHub, Vercel, Google, delivery-status bounces) and anything unrelated to the project.

3. For each genuine human reply that has not been answered yet:
   - Summarize it in two lines: who wrote, what they asked or offered, what they need from the owner.
   - Create a Gmail DRAFT reply on the same thread using the closest template from REPLY_TEMPLATES.md, adapted to what they actually wrote, in the language they wrote in. Never send anything. Never create a draft if the thread already has a draft or a newer reply from the owner.
   - Drafts created through the connector must contain no URLs at all, because the connector rewrites every link. Write "(link follows)" where a link belongs and tell the owner in your report which link to paste before sending.
   - The honesty rules from the CRM are binding: no invented customers, volumes, prices, dates or commitments; never say the service verifies with the Tax Authority; do not promise prices (the price card is a proposal pending the owner's decision); do not re-pitch contacts marked cooling or closed.

4. Do not modify the repository, do not open pull requests, do not send email, do not create calendar events. Drafts and the report are your only outputs.

5. Finish with a short report in Hebrew: replies found (or "לא נמצאו תשובות חדשות"), one bullet per reply with the draft's Gmail link and the link the owner must paste, and anything urgent (a proposed meeting time, a question you could not answer from the docs). If nothing relevant was found, say so in one line and stop.
```

## 2. Month-end invoice reminder — already in the owner's Google Calendar

Recurring event on the 1st of every month, 09:10 Asia/Jerusalem, created 2026-09-25: run `npm run pilot:invoice -- --month <last month> --plan …`, check for `NOT DURABLE`, paste the lines into the Atzmai invoice (allocation number above ₪5,000), update OUTREACH_CRM. Details in [PILOT.md](./PILOT.md) §5.

## Rules for any routine on this project

- Drafts, reports and reminders only. Sending email, changing Vercel env, paying from any wallet, or publishing prices are never routine actions.
- The honesty rules in [OUTREACH_CRM.md](./OUTREACH_CRM.md) apply to every automated draft.
- Link-bearing mail goes out from the Gmail web UI, never through the connector.
