-- Supabase Storage: reports-exports bucket (private) + RLS
-- Region: ap-south-1 (Mumbai) — matches DB, DPDP-safe

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports-exports',
  'reports-exports',
  false,
  52428800,
  ARRAY[
    'text/csv',
    'application/pdf',
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {userId}/{reportId}/{YYYY-MM-DD}/{uuid}.{ext}
-- First folder segment = auth.uid()

CREATE POLICY "reports_exports_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'reports-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "reports_exports_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reports-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "reports_exports_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reports-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Retention: prune objects older than 30 days (run via pg_cron / Supabase cron)
-- SELECT storage.delete_object('reports-exports', name)
-- FROM storage.objects
-- WHERE bucket_id = 'reports-exports'
--   AND created_at < now() - interval '30 days';
