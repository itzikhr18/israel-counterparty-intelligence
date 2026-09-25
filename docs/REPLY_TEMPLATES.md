# Reply templates — hot leads (no-spam kit)

**Updated:** 2026-09-23 (Asia/Jerusalem)  
**Rule:** bare hostnames only (no Google redirect wrappers). Never self-pay from receiving wallet.  
**Live proof TX:** `0x5b68756c1b1713e46c5d137c91c92df3d1e2e4e71e83c7025a8b833a077bbbbd` · https://israel-counterparty-intelligence.vercel.app/proof

Use when a **human** replies. Do **not** answer pure auto-acks (Cardcom/Aerchain ticket robots, Grow “בקשתך התקבלה”).

---

## 0) Auto-ack only → do nothing

If the message is only “we received your request / ticket N”: **wait**. No reply.

---

## 1) Yes / interested → next step (EN)

Subject: `Re: …` (same thread)

```
Thanks — glad this is useful.

Fastest path (buyer-controlled Base wallet, not our receiving wallet):

1) $0.01 canary (already proven externally):
   POST https://israel-counterparty-intelligence.vercel.app/v1/company-changes/mainnet
   body: {}
   Guide: https://israel-counterparty-intelligence.vercel.app/buy

2) Optional second canary $0.05:
   POST https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet

Proof of first external settle: https://israel-counterparty-intelligence.vercel.app/proof
Partner one-pager: https://israel-counterparty-intelligence.vercel.app/partner

Happy to hop on a 10-min call or answer eng questions in-thread.
— Itzik · itzikhr18@gmail.com
```

### HE short note (if they wrote in Hebrew)

```
תודה! הנתיב הכי קצר:
• $0.01 — https://israel-counterparty-intelligence.vercel.app/buy
• הוכחה — https://israel-counterparty-intelligence.vercel.app/partner ו-/proof
ארנק קונה נפרד בלבד (לא ארנק הקבלה שלנו). מוכן לשיחה קצרה.
```

---

## 2) “What is this?” → 5-line pitch

```
Israel Counterparty Intelligence is a pay-per-call API (x402 on Base) so AI agents / AP tools can check an Israeli supplier before paying an invoice — company-registry changes + PAY/HOLD/BLOCK signals. No API key, no subscription.

Cheapest call: $0.01 company-changes (first external settle already live).
Proof: https://israel-counterparty-intelligence.vercel.app/proof
Buyer guide: https://israel-counterparty-intelligence.vercel.app/buy
One-pager: https://israel-counterparty-intelligence.vercel.app/partner
```

---

## 3) Forward to X / another team

```
Perfect — please forward to {NAME_OR_TEAM}.

One-pager they can skim in 2 minutes:
https://israel-counterparty-intelligence.vercel.app/partner

Concrete ask: one buyer-wallet settle ($0.01 or $0.05) so we can continue a design-partner spike.
I’m at itzikhr18@gmail.com for any routing questions.
```

---

## 4) Not now / no fit

```
Understood — thanks for the clear no.

I’ll leave the proof page up if useful later:
https://israel-counterparty-intelligence.vercel.app/proof

No further follow-ups from me on this thread unless you ping.
```

---

## 5) Grow / Limor department handoff (HE)

Only if they ask for a clearer brief for the other team:

```
היי, לתמצת למחלקה:
אנחנו API ב-Base (x402) שבודק ספק ישראלי לפני תשלום חשבונית.
יש כבר תשלום חיצוני ראשון של $0.01 — https://israel-counterparty-intelligence.vercel.app/proof
דף שותף: https://israel-counterparty-intelligence.vercel.app/partner
לא מבקשים חשבון סליקה אצלכם — מחפשים שותף/ניסוי עם ארנק קונה.
```

---

## 6) EasyCount / HYP (if they reply)

Reuse template **1** or **2**. Product fit = Israeli e-invoicing adjacent to PAY/HOLD/BLOCK.

---

## 7) Partner says yes → send pilot access (no crypto)

Send from the Gmail **web UI** (it carries links). Issue the key first per [PILOT.md](./PILOT.md); paste the raw key **only** here, never in a doc.

```
Great — here is your partner access. No wallet or USDC needed.

Key (keep it secret, do not paste it into tickets): {RAW_KEY}
Valid until: {EXPIRES_AT} · Allowance: {CALL_LIMIT} calls · Metered per call, invoiced monthly in ₪ or $.

REST (send the key as "Authorization: Bearer {RAW_KEY}"):
• POST https://israel-counterparty-intelligence.vercel.app/v1/pilot/invoice-gate   → PAY / HOLD / BLOCK for an Israeli invoice
• POST https://israel-counterparty-intelligence.vercel.app/v1/pilot/verify         → company verification with registry evidence
• POST https://israel-counterparty-intelligence.vercel.app/v1/pilot/payment-risk   → PROCEED / REVIEW / BLOCK vendor triage
• POST https://israel-counterparty-intelligence.vercel.app/v1/pilot/company-changes → recent registry changes
Request/response schemas: https://israel-counterparty-intelligence.vercel.app/openapi.json (operations under /v1/pilot/*)

MCP (Claude, Cursor, any Streamable HTTP client): POST https://israel-counterparty-intelligence.vercel.app/mcp/pilot with the same Authorization header. tools/list shows the four tools.

Free previews stay free: https://israel-counterparty-intelligence.vercel.app/#invoice-preview

Boundaries, so nobody is surprised: public Companies Registry evidence; buyer-attested allocation results are labeled, not independently authenticated; no bank-account ownership, sanctions/PEP/UBO, or legal advice.

I can walk your engineer through it in 20 minutes whenever suits.
```

### HE short note

```
מצוין. הנה גישת השותפים, בלי ארנק ובלי USDC:
מפתח (סודי): {RAW_KEY} · בתוקף עד {EXPIRES_AT} · מכסה: {CALL_LIMIT} קריאות · חיוב לפי שימוש, חשבונית חודשית בש"ח.
REST: שולחים "Authorization: Bearer <מפתח>" ל־/v1/pilot/invoice-gate (שער חשבונית PAY/HOLD/BLOCK), /v1/pilot/verify, /v1/pilot/payment-risk, /v1/pilot/company-changes. סכמות ב־/openapi.json.
MCP: אותו header על /mcp/pilot.
גבולות: ראיות מרשם החברות בלבד, לא אימות מול רשות המסים, לא בעלות על חשבון בנק. אשמח ל־20 דקות עם המפתח/ת שלכם.
```
