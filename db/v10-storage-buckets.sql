-- v10: Create Supabase Storage buckets for mentor documents and profile pictures
-- Safe to re-run — uses ON CONFLICT and DROP IF EXISTS before each policy.

-- ─── Create mentor-docs bucket ────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mentor-docs',
  'mentor-docs',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ─── Create profile-pictures bucket ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS policies for mentor-docs ─────────────────────────────────────────────
DROP POLICY IF EXISTS "mentor_docs_upload"     ON storage.objects;
DROP POLICY IF EXISTS "mentor_docs_own_select" ON storage.objects;
DROP POLICY IF EXISTS "mentor_docs_own_update" ON storage.objects;
DROP POLICY IF EXISTS "mentor_docs_own_delete" ON storage.objects;

CREATE POLICY "mentor_docs_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mentor-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "mentor_docs_own_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'mentor-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "mentor_docs_own_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mentor-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "mentor_docs_own_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mentor-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── RLS policies for profile-pictures ────────────────────────────────────────
DROP POLICY IF EXISTS "profile_pics_upload"      ON storage.objects;
DROP POLICY IF EXISTS "profile_pics_public_read" ON storage.objects;
DROP POLICY IF EXISTS "profile_pics_own_update"  ON storage.objects;
DROP POLICY IF EXISTS "profile_pics_own_delete"  ON storage.objects;

CREATE POLICY "profile_pics_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "profile_pics_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'profile-pictures');

CREATE POLICY "profile_pics_own_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "profile_pics_own_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
