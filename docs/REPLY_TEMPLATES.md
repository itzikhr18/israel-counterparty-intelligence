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
