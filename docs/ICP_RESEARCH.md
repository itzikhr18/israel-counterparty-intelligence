# Who would actually use this service — ICP research

**Updated:** 2026-09-24 (Asia/Jerusalem)  
**Owner:** Itzik Harush (`itzikhr18@gmail.com`)  
**Canonical status:** [PROJECT_STATUS.md](./PROJECT_STATUS.md) · **CRM:** [OUTREACH_CRM.md](./OUTREACH_CRM.md)

Purpose: a sober, sourced answer to "who has the problem we solve, and would they pay for it in the form we sell it". Written for the owner (non-technical) and for any agent continuing outreach. Re-check the sources before quoting numbers to a partner.

---

## תקציר בעברית

- **הכאב אמיתי.** עסקים ישראליים נופלים בהונאת "הספק שינה פרטי חשבון בנק", וחוק שירותי תשלום לא מחזיר העברה שהעסק ביצע בעצמו אחרי מייל מזויף. במקביל, סף מספר ההקצאה ירד ל־5,000 ₪ מיוני 2026, כך שיותר חשבוניות דורשות בדיקה.
- **אבל המוצר שלנו לא עוצר את ההונאה הזו.** מה שעוצר אותה הוא אימות חשבון בנק של הספק, ואנחנו לא עושים את זה. אנחנו בודקים את החברה מול רשם החברות ואת חשבון החשבונית. זו בדיקה שכבר קיימת בחינם ב־gov.il ובזול אצל CheckID ו־DataHelp.
- **הרכבת התשלום היא הבעיה הגדולה.** כל מי שיש לו כסף ורוצה את הבדיקה משלם בשקלים או בדולרים עם חשבונית, לא ב־USDC. x402 מתאים לסוכני AI, אבל אין עדות שסוכנים קונים היום בדיקות ציות לפי מדינה. הקנייה הראשונה שלנו הגיעה מסוכן אנונימי, כנראה סורק.
- **שני קהלים שכן הגיוניים:** (1) תוכנות הנהלת חשבונות וחשבוניות ישראליות כערוץ OEM לעסקים קטנים, (2) צוותי כספים וציות בחו"ל שמשלמים לספקים ופרילנסרים ישראליים ולא יודעים לקרוא את רשם החברות בעברית. שניהם צריכים API key וחיוב רגיל, לא ארנק.
- **Grow** לא לקוח ולא שותף למוצר, אבל כן ספק סליקה אפשרי אם נמכור לישראלים בשקלים. זו שיחה שיקי יודע לנהל.

---

## 1. What we actually sell (honest boundaries)

| We do                                                                                    | We do **not** do                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Resolve an Israeli company against public Companies Registry open data (status, events)  | Verify bank-account ownership (the control that stops BEC vendor fraud)   |
| Government-contract / support footprint                                                  | Authenticate allocation numbers with the Tax Authority                    |
| Invoice arithmetic: VAT, allocation-number applicability by threshold, buyer attestation | Credit scoring, sanctions/PEP/UBO, adverse media                          |
| `PAY / HOLD / BLOCK` with reason codes, machine-readable, English                        | Dashboards, accounts, shekel invoicing, API keys (pay-per-call USDC only) |

Sources: repo `README.md`, `docs/OEM_PARTNER_ONEPAGER.md`.

---

## 2. Evidence the underlying pain exists

| Signal                                                                                                                                                                              | Source                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Supplier changed bank details by email" fraud targets small Israeli businesses; the Payment Services Law (2019) does **not** refund a transfer the business executed itself        | [Bizportal](https://www.bizportal.co.il/financialconsumerism/news/article/20042762)                                                                                                 |
| Allocation-number threshold: ₪20,000 (2025) → ₪10,000 (Jan 2026) → **₪5,000 (June 2026)**, measured before VAT; without a valid number VAT cannot be offset                         | [Green Invoice](https://www.greeninvoice.co.il/magazine/israel-invoice/), [HYP](https://hyp.co.il/blog/israel-invoices/)                                                            |
| Foreign buyers: gov.il status search is free and open, but no portal stores historical status, so a dated internal log is the only audit trail; verify at onboarding and before pay | [businessdataguide](https://www.businessdataguide.com/blog/jurisdictions/israel-company-search-guide)                                                                               |
| Enterprise money behind vendor-payment fraud: Trustmi (Tel Aviv) $17M Series A 2025; Basware agreed to buy Trustpair (Aug 2026); nsKnox validates accounts via micro-payments       | [Insight Partners](https://www.insightpartners.com/ideas/trustmi-leadership-story/), [Host Merchant Services](https://hostmerchantservices.com/2026/09/vendor-impersonation-fraud/) |

Reading: the pain is real and funded, **but the funded solutions center on bank-account validation**, not registry status.

---

## 3. Segments, ranked by realistic fit

| #   | Segment                                                                                                                       | Pain fit | Pays in       | Blocker today                                                                                           | Verdict                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | **Israeli invoicing / bookkeeping SaaS as OEM** (Morning, iCount, Sumit, EZcount/HYP, Invoice4U)                              | High     | ₪ / OEM       | We have no API-key or monthly plan; no Hebrew demo                                                      | **Best Israeli channel.** Needs packaging, not tech    |
| 2   | **Foreign AP / compliance teams paying Israeli vendors & freelancers** (US/EU cos with Israeli R&D; EOR/contractor platforms) | High     | $ invoice     | Wrong rail (USDC); they pay via Tipalti/Rippling/EOR                                                    | **Best export segment.** English evidence is the value |
| 3   | Israeli SMB owners / bookkeepers directly                                                                                     | Medium   | ₪             | Registry check is free on gov.il; we lack bank-detail check; no ₪ billing                               | Reach only through #1                                  |
| 4   | Global KYB aggregators (Kyckr 300+ registries; Sumsub via Kyckr; Middesk going intl 2026)                                     | Medium   | $ data deal   | Israel coverage not confirmed publicly; they build connectors in-house                                  | Long shot, coherent pitch                              |
| 5   | Enterprise B2B payment-fraud platforms (Trustmi, nsKnox, Trustpair/Basware)                                                   | Low      | n/a           | They are competitors or would want bank validation we do not have                                       | Not customers                                          |
| 6   | Autonomous AI agents via x402 / Bazaar / Agent402                                                                             | Low      | USDC (works!) | No evidence agents buy per-country compliance checks; buyers pay for crypto data, IP lookups, inference | Keep listings, stop investing                          |
| 7   | Crypto-native orgs paying Israeli contractors in USDC                                                                         | Low      | USDC          | No evidence of scale in Israel; shekel stablecoin only just approved                                    | Ignore for now                                         |

Sources for #6: [x402scan telemetry](https://x402scan.achivx.com/), [Allium](https://www.allium.so/blog/x402-explained-the-internet-native-payments-standard-for-apis-data-and-agent-commerce/), [coachhype on dev.to](https://dev.to/coachhype/how-i-got-my-first-outside-x402-payer-0058-in-usdc-on-base-3hjf). Sources for #4: [Kyckr](https://kyckr.com/), [Middesk international](https://www.middesk.com/product-releases/business-identity-without-borders). Existing Israeli alternatives for #3: [CheckID API](https://en.checkid.co.il/landingPages/apiDocument), [DataHelp](https://datahelp.co.il/), [ucan2 free lookup](https://www.ucan2.co.il/%D7%90%D7%99%D7%AA%D7%95%D7%A8-%D7%A2%D7%95%D7%A1%D7%A7-%D7%9E%D7%95%D7%A8%D7%A9%D7%94/).

---

## 4. The structural problem

The content (Israeli supplier gate) fits Israeli AP workflows and foreign buyers of Israeli goods. The rail (x402, USDC on Base, no API key) fits autonomous agents. **Those two audiences barely overlap in 2026.** Every buyer with budget in segments 1–4 needs an API key and a shekel or dollar invoice. Every buyer that can use x402 has shown no demand for this content.

Consequence: the "second external settle" milestone measures the wrong thing. It proves the rail again, not demand.

---

## 5. What Grow (Yaki) is, and is not

- Grow (formerly Meshulam) helps Israeli businesses **receive** money: card acquiring, bit, payment links, business account; 100k+ businesses ([Calcalist](https://www.calcalist.co.il/article/bkoix41owe), [grow.business/about](https://grow.business/about/)).
- Our product acts on the **paying** side. Grow is not a product partner and not a buyer.
- Grow **is** a plausible acquiring/payment-link provider if we ever sell to Israeli customers in shekels. That is a conversation a Grow salesperson knows how to have. Ask on the call: do they have any supplier-payment product, and who handles partnerships/integrations.

---

## 6. Recommended next moves (proposal, owner decides)

1. **Packaging before more outreach:** an API-key + monthly plan (even manual invoicing) so segments 1–2 can say yes. Keep x402 as a side door.
2. **Israeli OEM channel:** contact partnerships at Morning, iCount, Sumit with a 3-minute Hebrew demo of "supplier check inside your expense flow". EZcount/HYP already emailed (see CRM).
3. **Export segment:** one-page English explainer for AP/compliance teams paying Israeli vendors; target EOR/contractor platforms (CWS Israel, Omnivoo, Playroll) as OEM.
4. **Product gap to consider:** remember last-known bank details per supplier and flag changes. Not bank-ownership validation, but it addresses the fraud pattern buyers actually fear. Never claim more than it does.
5. **Demote** "second external settle" from P0 to a passive metric; let listings (Bazaar, Agent402, x402scan) produce it if they will.

---

## 7. Do not

- Claim Tax Authority verification, bank-account ownership, or customer logos.
- Pitch segment 5 as customers.
- Spend more on x402-only discovery until a paying segment exists.
