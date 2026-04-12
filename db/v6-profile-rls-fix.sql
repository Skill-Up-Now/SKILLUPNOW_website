-- ============================================================
-- SKILLUPNOW V6 — PROFILE UPDATE RLS + AVATAR STORAGE FIX
-- Run in Supabase SQL editor (project: kenlnisfhrkgolvxitfc)
-- Date: 2026-04-12
-- Purpose:
--   Fix "permission denied for table user_profiles" when a
--   student tries to update their profile or upload a photo.
-- ============================================================

-- ── 1. Ensure RLS is enabled on user_profiles ────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ── 2. Recreate all user_profiles policies cleanly ───────────
DROP POLICY IF EXISTS user_profiles_self_or_admin_select ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_self_insert          ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_self_update          ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_select               ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert               ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update               ON public.user_profiles;

-- Anyone can select their own profile; admins see all
CREATE POLICY user_profiles_select ON public.user_profiles
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- Users create their own profile on signup
CREATE POLICY user_profiles_insert ON public.user_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Users update their own profile; admins update any
CREATE POLICY user_profiles_update ON public.user_profiles
  FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ── 3. Storage bucket: avatars ───────────────────────────────
-- Create the bucket if it doesn't exist (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('avatars', 'avatars', true, 2097152,
          ARRAY['image/jpeg','image/png','image/webp','image/gif'])
  ON CONFLICT (id) DO UPDATE
    SET public = true,
        file_size_limit = 2097152,
        allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

-- Storage RLS for avatars bucket
DROP POLICY IF EXISTS avatars_upload_own   ON storage.objects;
DROP POLICY IF EXISTS avatars_read_public  ON storage.objects;
DROP POLICY IF EXISTS avatars_delete_own   ON storage.objects;

-- Public read (avatars are public images)
CREATE POLICY avatars_read_public ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Authenticated users upload/update into their own folder
CREATE POLICY avatars_upload_own ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── DONE ─────────────────────────────────────────────────────
-- After running this:
--   1. Profile updates (name, phone, etc.) will work for students.
--   2. Avatar photo uploads will work — images land in
--      the public "avatars" bucket under {user_id}/avatar.ext
--   3. Profile photos are publicly readable (needed for display).
