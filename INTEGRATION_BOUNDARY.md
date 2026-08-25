# Shul Hub Pash-base integration boundary

The root application is a runtime-only copy of commit
`ae073088580b794a69bdfbf5f01b197253178fcc` from `ticnutai/pash`.

- The source checkout at `C:\Users\jj121\Documents\פרשת שבוע` remains read-only.
- No source `.env`, credentials, migration runner, Play Console configuration,
  Android signing material, build cache, screenshots, or generated reports are copied.
- Runtime Supabase access is rejected unless the URL host is exactly
  `bfiayuuhjtyccqobsjvl.supabase.co` (Shul Hub).
- Database additions are maintained as new reviewed Shul Hub migrations. The
  source project's migrations are never executed directly against Shul Hub.
- All synagogue modules now live under `src/community` and share the canonical
  authenticated Shul Hub Supabase client.
