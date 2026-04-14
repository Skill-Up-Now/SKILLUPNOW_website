-- ============================================================
-- SKILLUPNOW V12 — SYNC MISSING USER PROFILES
-- Run in Supabase SQL editor (project: kenlnisfhrkgolvxitfc)
-- Date: 2026-04-14
-- Fixes applied:
--   • COALESCE(u.created_at, NOW())  — auth.users.created_at can be NULL
--   • Phone set to NULL when it already exists in another profile
--     (user_profiles.phone is UNIQUE — duplicate phone → NULL, not error)
--   • One-time sync uses CTE + ROW_NUMBER() to deduplicate phones
--     within the batch itself (prevents 23505 unique-constraint error
--     when multiple auth.users rows share the same phone number)
-- ============================================================

-- ── 1. sync_missing_user_profiles() RPC ──────────────────────
CREATE OR REPLACE FUNCTION public.sync_missing_user_profiles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  au           RECORD;
  synced_count INT := 0;
  v_full_name  TEXT;
  v_phone      TEXT;
  v_role       TEXT;
  v_now        TIMESTAMPTZ := NOW();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  FOR au IN
    SELECT u.id, u.email, u.raw_user_meta_data, u.created_at
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id
    )
  LOOP
    v_full_name := COALESCE(
                     au.raw_user_meta_data->>'full_name',
                     au.raw_user_meta_data->>'name',
                     split_part(au.email, '@', 1)
                   );
    -- Use phone only if it is not already taken by another profile
    v_phone := au.raw_user_meta_data->>'phone';
    IF v_phone IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_profiles WHERE phone = v_phone
    ) THEN
      v_phone := NULL;
    END IF;

    v_role := COALESCE(au.raw_user_meta_data->>'role', 'user');
    IF v_role NOT IN ('user','mentor','admin','super_admin','support') THEN
      v_role := 'user';
    END IF;

    INSERT INTO public.user_profiles (
      user_id, full_name, email, phone, role,
      is_email_verified, is_active,
      account_created_at, created_at, updated_at
    ) VALUES (
      au.id,
      v_full_name,
      au.email,
      v_phone,
      v_role,
      TRUE,
      TRUE,
      COALESCE(au.created_at, v_now),
      COALESCE(au.created_at, v_now),
      v_now
    )
    ON CONFLICT (user_id) DO NOTHING;

    IF v_role IN ('user', 'student') THEN
      INSERT INTO public.student_profiles (user_id)
      VALUES (au.id)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;

    synced_count := synced_count + 1;
  END LOOP;

  RETURN jsonb_build_object('synced', synced_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_missing_user_profiles() TO authenticated;


-- ── 2. One-time sync (runs immediately) ───────────────────────
DO $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Use a CTE that deduplicates phones BEFORE inserting.
  -- ROW_NUMBER() partitioned by phone ensures only the first auth
  -- user per phone number keeps the phone; all others get NULL.
  -- This prevents duplicate-key errors when multiple auth.users
  -- rows share the same phone in raw_user_meta_data.
  WITH candidates AS (
    SELECT
      u.id,
      COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
      )                                       AS full_name,
      u.email,
      u.raw_user_meta_data->>'phone'          AS raw_phone,
      CASE
        WHEN COALESCE(u.raw_user_meta_data->>'role', '')
             IN ('user','mentor','admin','super_admin','support')
        THEN u.raw_user_meta_data->>'role'
        ELSE 'user'
      END                                     AS role,
      COALESCE(u.created_at, v_now)           AS account_ts,
      -- rank within this batch: first occurrence of each phone wins
      ROW_NUMBER() OVER (
        PARTITION BY u.raw_user_meta_data->>'phone'
        ORDER BY u.created_at NULLS LAST
      )                                       AS phone_rank
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id
    )
  )
  INSERT INTO public.user_profiles (
    user_id, full_name, email, phone, role,
    is_email_verified, is_active,
    account_created_at, created_at, updated_at
  )
  SELECT
    c.id,
    c.full_name,
    c.email,
    -- Keep phone only for the first row of each phone number in
    -- this batch AND only if it is not already in an existing profile.
    CASE
      WHEN c.raw_phone IS NOT NULL
        AND c.phone_rank = 1
        AND NOT EXISTS (
          SELECT 1 FROM public.user_profiles WHERE phone = c.raw_phone
        )
      THEN c.raw_phone
      ELSE NULL
    END,
    c.role,
    TRUE,
    TRUE,
    c.account_ts,
    c.account_ts,
    v_now
  FROM candidates c
  ON CONFLICT (user_id) DO NOTHING;

  -- student_profiles for any user/student-role profiles that are missing one
  INSERT INTO public.student_profiles (user_id)
  SELECT up.user_id
  FROM public.user_profiles up
  WHERE up.role IN ('user', 'student')
    AND NOT EXISTS (
      SELECT 1 FROM public.student_profiles sp WHERE sp.user_id = up.user_id
    )
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Sync complete.';
END;
$$;


-- ── 3. Verify — should return 0 rows ─────────────────────────
-- SELECT u.id, u.email FROM auth.users u
-- WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id);
