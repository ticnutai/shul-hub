# ייבוא הספרייה התורנית — גבולות בטיחות

הספרייה התורנית מיובאת מ־`https://github.com/ticnutai/pash.git` אל Shul Hub כקובצי JSON לקריאה בלבד.
הפרויקט המקורי אינו נערך ואינו משמש בזמן הריצה של Shul Hub.

## הפרדת חשבונות Supabase

| מערכת                              | כתובת Supabase                             | טביעת מפתח ציבורי SHA-256 | משתני מנהל מקומיים                                  |
| ---------------------------------- | ------------------------------------------ | ------------------------- | --------------------------------------------------- |
| Shul Hub — המערכת היחידה המותרת    | `https://bfiayuuhjtyccqobsjvl.supabase.co` | `69B63A914EF0`            | `ADMIN_EMAIL`, `ADMIN_PASSWORD`                     |
| pash — מקור תוכן בלבד, אסור לחיבור | `https://mocukhvfqqzkekphifsr.supabase.co` | `0CCA58311100`            | `MIGRATION_ADMIN_EMAIL`, `MIGRATION_ADMIN_PASSWORD` |

שמות משתמש וסיסמאות אינם נשמרים במסמך, בקוד, ב־manifest או ב־Git. הם נשארים רק בקובצי
`.env.migrations.local` הנפרדים בכל פרויקט. אסור לסקריפט הייבוא לקרוא או להעתיק אותם.

## מה מותר לייבא

- רק `src/data/**/*.json` מפרויקט pash.
- קובצי חומש, נביאים, תהילים, מפרשים וסידורים.
- provenance, גודל וטביעת SHA-256 של כל קובץ ב־`content-manifest.json`.

## מה אסור לייבא

- `.env*`, מפתחות, סיסמאות, sessions או cookies.
- `src/integrations/supabase`, migrations או migration runner.
- משתמשים, טבלאות או נתונים פרטיים מחשבון pash.
- רכיבי React התלויים ב־React Router או ב־Supabase של pash.

הרצה בטוחה:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-torah-library-data.ps1
node scripts/verify-torah-library-boundary.mjs
```
