UPDATE public.settings
SET address = 'מצדה 9, בסר 3, קומה 34, בני ברק',
    city = 'בני ברק',
    updated_at = now()
WHERE id IS NOT NULL;
