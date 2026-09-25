# Pricing proposal — partner API key, billed in ₪ (2026-09-25)

**Status:** proposal for the owner's decision, not a published rate card and not a claim of revenue.  
**Why now:** [PILOT.md](./PILOT.md) meters every partner call and defers the price card to the owner; the Grow call (Sun 27.09) and the Morning / iCount / SUMIT drafts will each reach "what does it cost?". This page gives sourced numbers to answer with.

**TL;DR (עברית):** מחיר מוצע לשותפים עם מפתח API, לפני מע"מ: שער חשבונית ₪1.50 לקריאה, אימות חברה ₪0.60, סיכון ספק ₪0.90, שינויים בחברה ₪0.20. חלופה: מסלול חודשי ₪490 (500 קריאות) או ₪1,900 (2,500 קריאות), ו־OEM מ־₪6,000 לחודש. פיילוט חינם 60 יום עד 500 קריאות. העיגון: נסח חברה רשמי עולה ₪12 והמע"מ שעומד על הכף בחשבונית של ₪5,000 הוא ₪900, כך שקריאה ב־₪1.50 היא זניחה מול הסיכון.

## 1. Anchors (sourced)

| Anchor                                                             | Value                                                                                                                                                     | Why it matters                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Israel Invoices allocation threshold from 1 June 2026              | **₪5,000** (₪10,000 from 1 Jan 2026)                                                                                                                      | Every B2B invoice above it needs an allocation number; the gate's core check is now mass-market |
| VAT rate                                                           | **18 %** (since 1 Jan 2025, unchanged)                                                                                                                    | VAT is added to our invoice; it is also the buyer's exposure on a bad invoice                   |
| VAT at stake on a ₪5,000 invoice without a valid allocation number | **₪900**                                                                                                                                                  | An invoice above the threshold without an allocation number is not deductible for VAT           |
| Official Companies Registry extract (נסח חברה)                     | **₪12** per extract; basic extract free                                                                                                                   | The manual alternative to one automated verification                                            |
| Israeli commercial information reports (BDI / D&B)                 | tens to hundreds of ₪ per report                                                                                                                          | Business-report prices are quote-only; the consumer credit report is ₪67.6 for scale            |
| International KYB APIs                                             | Didit from **$2.00** per verification; OpenCorporates API from **£2,250 / year**; CompanyData credits from $29.99 / month; Middesk and Trulioo quote-only | The per-check price band buyers already accept                                                  |
| iCount base plan                                                   | **₪79 / month**                                                                                                                                           | What an Israeli SMB pays for its whole invoicing tool; an embedded check must stay far below it |
| USD / ILS                                                          | **≈ ₪3.01** (24–25 Sep 2026)                                                                                                                              | Conversion for the public x402 prices                                                           |
| Public x402 spot prices (agents, no key)                           | $0.01 / $0.05 / $0.10 / $0.25                                                                                                                             | ≈ ₪0.03 / ₪0.15 / ₪0.30 / ₪0.75 per call at today's rate                                        |

## 2. Recommended price card (₪, before 18 % VAT)

### Pay-as-you-go with a partner key, invoiced monthly

| Product                            | Per call  | vs x402 spot | vs manual alternative            |
| ---------------------------------- | --------- | ------------ | -------------------------------- |
| Invoice gate (PAY / HOLD / BLOCK)  | **₪1.50** | 2×           | ₪12 extract + a human reading it |
| Vendor payment risk                | **₪0.90** | 3×           | no self-serve equivalent         |
| Company verification (full report) | **₪0.60** | 4×           | ₪12 extract                      |
| Company changes                    | **₪0.20** | 7×           | re-pulling the extract           |

Why above spot: the x402 prices were set to win a first external settle from an agent wallet with zero collection cost. A partner key adds invoicing, credit terms, support, and the metering work in PILOT.md §5. Why still this low: a ₪1.50 gate call on a ₪5,000 invoice is 0.03 % of the invoice and 0.17 % of the VAT at stake, so it never becomes a line item the partner has to defend, and it stays two orders of magnitude below the ₪12 manual extract.

### Monthly plans (calls included, overage at the per-call price)

| Plan                 | Monthly            | Included calls (any tool) | Effective price per call | For whom                                                                                                        |
| -------------------- | ------------------ | ------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Design-partner pilot | **₪0**             | 500 for 60 days           | 0                        | The first partner in each segment; ends in a plan                                                               |
| Starter              | **₪490**           | 500                       | ₪0.98                    | One AP team or one small platform                                                                               |
| Growth               | **₪1,900**         | 2,500                     | ₪0.76                    | A platform rolling the gate out to its customers                                                                |
| OEM / Platform       | **₪6,000–₪15,000** | 10,000–50,000             | ₪0.30–₪0.60              | Embedded under the partner's SKU, named support, roadmap input; matches the $2,000–$5,000 band in the one-pager |

Terms to propose: net-30; ₪ or $ at the Bank of Israel representative rate on the invoice date; 15 % off for annual prepayment; no exclusivity; either side can stop at month end.

## 3. What the numbers need to be true

- The monthly count comes from the durable per-partner counters once the free Upstash database is set (PILOT.md §5): `GET /v1/pilot/usage` with the operator token lists every partner's month total by tool. Without Upstash, only the `pilot_call` log events count, and Vercel keeps them briefly.
- Collection rail in ₪: Morning (invoice + payment page), a Grow payment link (Grow does not process foreign currency, which is irrelevant for ₪ collection; a concrete thing to ask Yaki on Sunday), or Stripe with ILS. Pick one before the first invoice.
- Public pages keep the x402 spot prices as published; partner prices stay in the proposal and in the signed order until the owner decides to publish them.

## 4. Decision requested

1. Approve or adjust the per-call and plan numbers above.
2. Choose the ₪ collection rail.
3. Once approved, copy the price card into PILOT.md §5 and the OEM one-pager, and answer partner pricing questions from it.

## Sources

- Allocation threshold 2026 (₪10,000 from January, ₪5,000 from June): [Green Invoice / Morning guide](https://www.greeninvoice.co.il/magazine/israel-invoice/), [iCount guide](https://www.icount.co.il/blog/invoice-israel/), [Horizon Group](https://horizon.org.il/cfo-outsource/allocation-number-invoice-2026/), [Israel Tax Authority service page](https://www.gov.il/he/service/request-assignment-number-for-tax-invoice)
- VAT 18 % since 2025, unchanged in 2026: [Knesset Finance Committee](https://main.knesset.gov.il/Activity/committees/Finance/News/pages/ks20224.aspx), [Keep](https://keep.co.il/blog/nihul-maam-2026.html)
- Company extract fee ₪12 and free basic extract: [Corporations Authority extract service](https://www.gov.il/he/service/company_extract), [Corporations Online fees](https://ica.justice.gov.il/IcaSite/request-type-menu/8/3)
- BDI consumer credit report ₪67.6 (business reports quote-only): [CofaceBDI personal credit report](https://www.bdicoface.co.il/consumer-credit/personal-credit-report/), [CofaceBDI business information](https://www.bdicoface.co.il/en/service/business-information-databases/)
- D&B Israel reports are sold per report or by subscription, price on request: [D&B Israel registrar report](https://dbisrael.co.il/en/products/report-registrar/)
- KYB API price band: [Cobalt Intelligence buyer's guide 2026](https://blog.cobaltintelligence.com/post/best-business-verification-apis-2026), [Didit KYB alternatives 2026](https://didit.me/blog/top-kyb-business-verification-alternatives-2026/), [CompanyData KYB API](https://companydata.com/kyb-api/), [Zephira on OpenCorporates](https://zephira.ai/8-opencorporates-alternatives-for-kyb-company-registry-lookup/)
- iCount pricing: [iCount plans](https://www.icount.co.il/plans/)
- USD/ILS ≈ 3.01: [Investing.com USD/ILS](https://il.investing.com/currencies/usd-ils-historical-data), [Bank of Israel representative rates](https://www.boi.org.il/roles/markets/exchangerates/)
