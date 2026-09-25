# LinkedIn posts (HE) — ready to publish

**Purpose:** the one distribution channel that needs no cold email and no partner: the owner's own LinkedIn network (finance, AP, product and fintech people in Israel). Three posts, written to be pasted as they are. Owner publishes from the LinkedIn app; nothing here is automated.

**Timing (Asia/Jerusalem):** the Tishrei holidays run until Simchat Torah, Saturday 3 October 2026, and engagement on Israeli LinkedIn is lowest then. Publish after the holidays, in the "אחרי החגים" window:

| Post | When                      | Why                                                |
| ---- | ------------------------- | -------------------------------------------------- |
| 1    | Sunday 4 Oct 2026, 07:30  | Week opener, first working Sunday after the chagim |
| 2    | Tuesday 6 Oct 2026, 08:15 | B2B decision window (Mon–Tue 08:00–09:00)          |
| 3    | Sunday 11 Oct 2026, 07:30 | Second week opener; carries the partner ask        |

If the Grow call on 27.09 produces a referral or a lesson worth telling, move it into post 2.

**Published:**

| Post | Published (Asia/Jerusalem)                            | Where                                                                     | Notes                                                                                                                                                           |
| ---- | ----------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 2026-09-25 13:19, Chol HaMoed, at the owner's request | https://www.linkedin.com/feed/update/urn:li:activity:7509197931024003072/ | Posted through the LinkedIn API (Composio connection, `w_member_social`); first comment with the link added at 13:19. Posts 2 and 3 stay on the schedule above. |

**Rules (same honesty rules as everywhere else):**

- Links go in the **first comment**, not in the post body (LinkedIn deprioritizes link posts). The post says "הקישור בתגובה הראשונה".
- No prices, no volumes, no customer names. "פיילוט חינם" is fine; the price card stays in the proposal.
- Never "מאמתים מול רשות המסים". The free check does arithmetic and the allocation rule; the registry lookup is the partner path.
- Reply to every comment within hours, in the same register. A "כמה זה עולה?" gets "בפיילוט חינם, המחירון נסגר בשיחה" and an offer to talk.
- 3–5 hashtags, Hebrew without underscores, one English.
- Sources for the numbers: [PRICING_PROPOSAL.md](./PRICING_PROPOSAL.md) §Sources (Tax Authority service page, Green Invoice, iCount, Horizon).

---

## Post 1 — the ₪1,080 that sits on the invoice (Sunday 4.10, 07:30)

```
שילמתם לספק חשבונית של ₪6,000 בלי מספר הקצאה? המע"מ של החשבונית הזאת, ₪1,080, על הכף.

מ־1 ביוני 2026 הסף של "חשבוניות ישראל" ירד ל־₪5,000 לפני מע"מ (בינואר הוא היה ₪10,000).
מעל הסף, בלי מספר הקצאה מרשות המסים על החשבונית, קיזוז המע"מ לא מתקבל. לא הספק מפסיד, הקונה.

ברוב העסקים שראיתי זה עובד ככה: החשבונית מגיעה, מישהו מציץ שהסכום נכון, ומשלמים. את השאלה "יש פה מספר הקצאה בכלל?" אף אחד לא שואל, כי אף אחד לא יודע שצריך.

אז בניתי בדיקה קטנה וחינמית, בעברית:
מכניסים את מספרי החשבונית ושתי תשובות של הקונה, ומקבלים לשלם / לעכב / לחסום עם הסבר.
אין הרשמה. יש גם שני כפתורי דוגמה למי שרוצה לראות תוצאה בלי להקליד.

דוגרי: הבדיקה לא פונה לרשות המסים ולא מאשרת תשלום. היא שואלת את השאלות שהיו צריכים לשאול לפני ההעברה, ועושה את החשבון.

הקישור בתגובה הראשונה.

שאלה אליכם, אנשי כספים והנהלת חשבונות: מי אצלכם בודק את זה היום, ובאיזה שלב?

#חשבוניותישראל #מעמ #הנהלתחשבונות #פינטק #IsraeliTech
```

First comment:

```
הבדיקה החינמית בעברית: https://israel-counterparty-intelligence.vercel.app/invoice-check/he
```

---

## Post 2 — how a person who is not a developer shipped this (Tuesday 6.10, 08:15)

```
אני לא מפתח במקצועי. בניתי שירות שבודק ספק ישראלי לפני שמשלמים לו, והוא חי ועובד.

מה הוא עושה: לוקח חשבונית ומספר חברה, בודק את הספק מול רשם החברות (סטטוס, שם, שינויים אחרונים), בודק את חישוב המע"מ ואת חובת מספר ההקצאה, ומחזיר לשלם / לעכב / לחסום עם נימוקים.

מה מיוחד בו: גם תוכנה יכולה להפעיל אותו לבד. סוכן AI שמכין תשלומים לספקים יכול לשאול "לשלם או לא?" ולקבל תשובה עם ראיות, בלי בן אדם באמצע. לפני כמה ימים מישהו שאני לא מכיר שילם סנט אחד כדי לבדוק חברה דרך הממשק הזה. קריאה אחת, לא הכנסות. אבל זה היה רגע.

איך בניתי: עם כלי AI, לאט, עם הרבה בדיקות אוטומטיות, ועם כלל אחד שלא זזתי ממנו: לא לטעון שום דבר שהמערכת לא באמת עושה. אין "אימות מול רשות המסים". יש רשם החברות, חשבון, וחוקים שמתועדים.

מה למדתי בדרך: הבעיה האמיתית של הלקוחות היא לא קריפטו ולא סוכנים. היא "מישהו העביר כסף לספק, ואף אחד לא בדק את הנמען". את זה פותרים עם מפתח API רגיל וחשבונית בשקלים. אז זה מה שיש עכשיו.

אם אתם בכספים, ב־AP, או בונים מוצר שמשלם לספקים בישראל: אשמח לשמוע איך זה נראה אצלכם היום. בתגובות או בהודעה.

#יזמות #פינטק #הנהלתחשבונות #AI #IsraeliTech
```

First comment:

```
לראות בעצמכם, בלי להקליד: https://israel-counterparty-intelligence.vercel.app/invoice-check/he
דף השותפים בעברית: https://israel-counterparty-intelligence.vercel.app/partner/he
```

---

## Post 3 — three checks before money leaves (Sunday 11.10, 07:30)

```
שלוש בדיקות של דקה לפני שמעבירים כסף לספק חדש. רוב העסקים עושים אפס מהן.

1. הספק קיים ופעיל?
מספר החברה או העוסק שעל החשבונית מול רשם החברות. חברה מחוקה, בפירוק או עם סטטוס שהשתנה בחודשים האחרונים היא דגל אדום לפני שהכסף יוצא.

2. השם על החשבונית הוא השם ברשם?
"א.ב. שירותים" על החשבונית ו"א.ב. שירותים והשקעות בע"מ" ברשם זה לא אותו דבר. ההפרש הזה הוא בדיוק המקום שבו הונאות ספקים חיות.

3. מעל ₪5,000 לפני מע"מ: יש מספר הקצאה?
מיוני 2026 זה הסף. בלי מספר הקצאה, המע"מ של החשבונית לא מתקזז. הקונה מפסיד.

את שלוש הבדיקות האלה אפשר לעשות ידנית, ולרוב לא עושים, כי הן נופלות בין הנהלת חשבונות, רכש ומי שלוחץ על "אשר העברה".

בניתי כלי שעושה את שלושתן בקריאה אחת ומחזיר לשלם / לעכב / לחסום עם הראיות. אפשר לחבר אותו למערכת קיימת דרך מפתח API, בלי ארנקים ובלי קריפטו, ואני מחפש שותפים ראשונים לפיילוט חינם: מערכות הנהלת חשבונות, פלטפורמות תשלומים לספקים, וצוותי כספים שמשלמים להרבה ספקים.

הקישור לדף השותפים בתגובה הראשונה. ואם יש לכם בדיקה רביעית שאתם עושים, אשמח ללמוד.

#הנהלתחשבונות #כספים #פינטק #חשבוניותישראל #IsraeliTech
```

First comment:

```
דף השותפים בעברית (פיילוט חינם, מפתח API, בלי קריפטו): https://israel-counterparty-intelligence.vercel.app/partner/he
בדיקה חינמית של חשבונית: https://israel-counterparty-intelligence.vercel.app/invoice-check/he
```

---

## After publishing

- Log each post's date and anything it produced (comments from finance or AP people, DMs, a referral) in [OUTREACH_CRM.md](./OUTREACH_CRM.md).
- A commenter who asks about integrating is a partner lead: answer with template 7 in [REPLY_TEMPLATES.md](./REPLY_TEMPLATES.md) once they say yes, and onboard with [PILOT.md](./PILOT.md).
