# Pash base integration boundary

This directory is a runtime-only copy of commit
`ae073088580b794a69bdfbf5f01b197253178fcc` from `ticnutai/pash`.

- The source checkout at `C:\Users\jj121\Documents\פרשת שבוע` remains read-only.
- No source `.env`, credentials, migration runner, Play Console configuration,
  Android signing material, build cache, screenshots, or generated reports are copied.
- Runtime Supabase access is rejected unless the URL host is exactly
  `bfiayuuhjtyccqobsjvl.supabase.co` (Shul Hub).
- Database additions are maintained as new reviewed Shul Hub migrations. The
  source project's migrations are never executed directly against Shul Hub.
- The current Shul Hub application remains the published root until this base
  and every synagogue module pass build, migration, RTL, mobile, and regression
  verification.
