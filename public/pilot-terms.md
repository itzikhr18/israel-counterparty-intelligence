# תנאי פיילוט לשותפים — Israel Counterparty Intelligence

**גרסה 0.1 · 25 בספטמבר 2026 · טיוטה לאישור בעל השירות.** המסמך מתאר מה שותף מקבל בפיילוט, מה נשמר ומה לא, ואיך מסיימים. הוא אינו ייעוץ משפטי ואינו מחליף הסכם. English version below.

## 1. מה כלול

- מפתח API אחד (Bearer) לשותף, שפותח את ארבעת הכלים: שער חשבונית (לשלם / לעכב / לחסום), אימות חברה, סיכון ספק, שינויים ברשם החברות. ב־REST תחת `/v1/pilot/*` וב־MCP ב־`/mcp/pilot`.
- חוזי קלט ופלט זהים לממשק הציבורי; הסכמות ב־`/openapi.json`. מדריך למפתחים: `/partner-integration.md`.
- `GET /v1/pilot/usage` מחזיר בכל רגע את המכסה והשימוש של השותף.

## 2. משך, מכסה, עלות

- ברירת מחדל: 60 יום, עד 500 קריאות מוצלחות. קריאה שנכשלה (שגיאת קלט או שגיאת שרת) אינה נספרת.
- הפיילוט ללא תשלום. אין חיוב אוטומטי בסופו: המפתח פשוט פג. המשך בתשלום רק לפי הצעת מחיר בכתב ואישור בכתב של השותף.
- הארכה או הגדלת מכסה בהודעה במייל; השינוי נרשם על המפתח.

## 3. מה נשלח, מה נשמר

- השותף שולח בכל קריאה: מספר חברה או עוסק, נתוני חשבונית (מספר, תאריך, סכומים, מספר הקצאה אם קיים) ותשובות הקונה. הנתונים משמשים לחישוב התשובה באותה קריאה.
- אנחנו שומרים: תקציר (SHA-256) של המפתח, ולכל קריאה מוצלחת מזהה שותף, שם הכלי, זמן וסטטוס, וכן מונים חודשיים לפי כלי לצורך חיוב. לוגי האפליקציה שלנו אינם כוללים את שדות החשבונית או את מספרי החברות שנבדקו. פלטפורמת האירוח (Vercel) שומרת לוגי בקשה טכניים לפי המדיניות שלה.
- מקור הנתונים: מאגר רשם החברות הפתוח ב־data.gov.il. השאילתה כוללת את מספר החברה שנבדק.
- נתוני השותף אינם נמכרים ואינם משותפים עם צד שלישי.

## 4. גבולות: מה השירות לא עושה

- ראיות מרשם החברות בלבד. אין פנייה לרשות המסים; מספר הקצאה שהקונה מדווח מסומן כהצהרה ואינו מאומת עצמאית.
- לא בעלות על חשבון בנק, לא סנקציות, לא PEP או בעלי שליטה, לא ייעוץ משפטי או חשבונאי.
- התשובה תומכת בהחלטה. ההחלטה לשלם היא של השותף.

## 5. זמינות, תמיכה, אבטחה

- שירות בפיילוט: מאמץ סביר, ללא התחייבות SLA. הגבלת קצב לכל שותף חלה בנוסף למכסה.
- תמיכה במייל בשעות העבודה בישראל. שינוי שובר תאימות בממשק יימסר במייל לפני הפעלתו, ככל האפשר.
- המפתח סודי ונשמר בצד השרת בלבד. בחשד לדליפה מודיעים לנו, ואנחנו מנפיקים מפתח חדש וחוסמים את הישן מיד.

## 6. הפסקה

- כל צד רשאי להפסיק בכל רגע בהודעה במייל. אנחנו רשאים לבטל מפתח מיידית במקרה של שימוש לרעה, למשל שיתוף המפתח או עקיפת הגבלות.
- בסיום המפתח נחסם. מוני השימוש נשמרים לתיעוד; הם אינם כוללים נתוני חשבוניות.

## 7. איך מאשרים

תשובה במייל מכתובת של החברה: "מאשר/ת את תנאי הפיילוט גרסה 0.1", עם שם איש הקשר הטכני. אחרי האישור נשלח את המפתח. יצירת קשר: itzikhr18@gmail.com.

---

# Partner pilot terms — Israel Counterparty Intelligence

**Version 0.1 · 25 September 2026 · draft pending the owner's approval.** This page says what a partner gets in the pilot, what is kept and what is not, and how it ends. It is not legal advice and does not replace an agreement.

## 1. What is included

- One Bearer API key per partner that unlocks all four tools: invoice gate (PAY / HOLD / BLOCK), company verification, vendor payment risk, company changes. REST under `/v1/pilot/*` and MCP at `/mcp/pilot`.
- Request and response contracts identical to the public routes; schemas at `/openapi.json`. Engineer's guide: `/partner-integration.md`.
- `GET /v1/pilot/usage` shows the partner's allowance and usage at any time.

## 2. Duration, allowance, cost

- Default: 60 days, up to 500 successful calls. A failed call (input error or server error) is not counted.
- The pilot is free. Nothing is charged automatically at the end: the key simply expires. Paid continuation only on a written quote and the partner's written acceptance.
- Extensions or a larger allowance by email; the change is recorded on the key.

## 3. What is sent, what is kept

- Each call sends a company or VAT number, invoice figures (number, date, amounts, allocation number if present) and the buyer's answers. They are used to compute that call's answer.
- We keep a SHA-256 digest of the key and, per successful call, the partner id, tool name, time and status, plus monthly per-tool counters for invoicing. Our application logs do not contain invoice fields or the company numbers checked. The hosting platform (Vercel) keeps technical request logs under its own policy.
- Data source: the open Companies Registrar dataset on data.gov.il. The query carries the company number being checked.
- Partner data is not sold or shared with third parties.

## 4. Boundaries: what the service does not do

- Public Companies Registry evidence only. No contact with the Tax Authority; a buyer-reported allocation number is labeled as a declaration and is not independently authenticated.
- No bank-account ownership, sanctions, PEP or beneficial-owner screening, and no legal or accounting advice.
- The answer supports a decision. The decision to pay is the partner's.

## 5. Availability, support, security

- Pilot service: reasonable effort, no SLA. A per-partner rate limit applies on top of the allowance.
- Support by email during Israeli business hours. A breaking interface change is announced by email before it goes live, wherever possible.
- Keep the key secret and server-side. On suspected exposure, tell us; a new key is issued and the old one blocked at once.

## 6. Termination

- Either side may stop at any time by email. We may revoke a key immediately on misuse, such as sharing the key or circumventing limits.
- At the end the key is blocked. Usage counters are kept for the record; they contain no invoice data.

## 7. How to accept

Reply by email from a company address: "We accept the pilot terms, version 0.1", naming the technical contact. The key is sent after acceptance. Contact: itzikhr18@gmail.com.
