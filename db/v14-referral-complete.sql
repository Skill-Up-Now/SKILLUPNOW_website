-- ============================================================
-- SKILLUPNOW V14 — COMPLETE REFERRAL SYSTEM
-- Run in Supabase SQL editor (project: kenlnisfhrkgolvxitfc)
-- Date: 2026-04-14
-- What this fixes:
--   1. Adds referral_code + referred_by_user_id to user_profiles
--      (was only on student_profiles — invisible to profile page)
--   2. Generates UPPERCASE codes so frontend .toUpperCase() matches
--   3. Backfills referral codes for all existing users
--   4. Upgrades handle_new_auth_user() trigger to:
--        a. Set referral_code on new user
--        b. Apply referred_by_code from auth metadata → award 10 pts
--           to both referrer and new user + log in referral_logs
--   5. Creates get_referral_stats(p_user_id) RPC for the profile page
-- ============================================================


-- ── 1. Add columns to user_profiles ──────────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_user_id UUID
    REFERENCES public.user_profiles(user_id) ON DELETE SET NULL;


-- ── 2. Backfill codes for existing users (uppercase, unique) ─

DO $$
DECLARE
  r RECORD;
  v_code TEXT;
BEGIN
  FOR r IN
    SELECT user_id FROM public.user_profiles WHERE referral_code IS NULL
    ORDER BY created_at
  LOOP
    -- Generate a unique 8-char uppercase code
    LOOP
      v_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.user_profiles WHERE referral_code = v_code
      );
    END LOOP;
    UPDATE public.user_profiles SET referral_code = v_code WHERE user_id = r.user_id;
  END LOOP;
END;
$$;


-- ── 3. Set DEFAULT for future rows ───────────────────────────
-- (will be overridden by the upgraded trigger below, but
--  acts as a safety net if trigger is bypassed)

ALTER TABLE public.user_profiles
  ALTER COLUMN referral_code SET DEFAULT
    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8));


-- ── 4. Also backfill reward_points column (v8 may not be run) ─

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS reward_points INT NOT NULL DEFAULT 0;


-- ── 5. Upgrade handle_new_auth_user() trigger ─────────────────
--  Changes vs original:
--    • Generates unique UPPERCASE referral_code per new user
--    • Reads phone/role from raw_user_meta_data
--    • Handles phone uniqueness (sets NULL if already taken)
--    • Applies referred_by_code if present: awards +10 pts to
--      both parties and inserts a referral_logs row

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_full_name       TEXT;
  v_phone           TEXT;
  v_role            TEXT;
  v_referred_by     TEXT;
  v_referrer_id     UUID;
  v_new_code        TEXT;
BEGIN
  v_full_name   := COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User');
  v_phone       := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  v_role        := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  v_referred_by := UPPER(trim(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')));

  IF v_role NOT IN ('user','student','mentor','admin','super_admin','support') THEN
    v_role := 'user';
  END IF;

  -- Clear phone if already taken by another profile
  IF v_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_profiles WHERE phone = v_phone
  ) THEN
    v_phone := NULL;
  END IF;

  -- Generate a guaranteed-unique UPPERCASE referral code
  LOOP
    v_new_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.user_profiles WHERE referral_code = v_new_code
    );
  END LOOP;

  -- Create user_profiles row
  INSERT INTO public.user_profiles (
    user_id, full_name, email, phone, role,
    referral_code, is_email_verified, is_active,
    account_created_at, created_at, updated_at
  ) VALUES (
    NEW.id, v_full_name, NEW.email, v_phone, v_role,
    v_new_code, TRUE, TRUE,
    COALESCE(NEW.created_at, NOW()), COALESCE(NEW.created_at, NOW()), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET referral_code = EXCLUDED.referral_code
    WHERE public.user_profiles.referral_code IS NULL;

  -- Role assignment
  INSERT INTO public.user_role_assignments
    (user_id, role, is_primary, is_active, assigned_reason)
  VALUES
    (NEW.id, 'student', TRUE, TRUE, 'Default role on signup')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Student profile (also carries the same code for compat)
  INSERT INTO public.student_profiles (user_id, referral_code)
  VALUES (NEW.id, v_new_code)
  ON CONFLICT (user_id) DO NOTHING;

  -- Activity log
  BEGIN
    INSERT INTO public.auth_activity_logs (user_id, event_name, metadata)
    VALUES (NEW.id, 'signup',
      jsonb_build_object('source', 'auth.users trigger'));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ── Apply referral code ──────────────────────────────────────
  IF v_referred_by IS NOT NULL AND v_referred_by != '' THEN
    SELECT user_id INTO v_referrer_id
    FROM public.user_profiles
    WHERE UPPER(referral_code) = v_referred_by
    LIMIT 1;

    IF v_referrer_id IS NOT NULL AND v_referrer_id != NEW.id THEN

      -- Award +10 pts to referrer
      UPDATE public.user_profiles
        SET reward_points = COALESCE(reward_points, 0) + 10
        WHERE user_id = v_referrer_id;

      -- Award +10 pts to new user + record who referred them
      UPDATE public.user_profiles
        SET reward_points     = COALESCE(reward_points, 0) + 10,
            referred_by_user_id = v_referrer_id
        WHERE user_id = NEW.id;

      -- Sync to student_profiles
      UPDATE public.student_profiles
        SET referred_by_user_id = v_referrer_id
        WHERE user_id = NEW.id;

      -- Log the referral event
      INSERT INTO public.referral_logs (
        referrer_user_id, referred_user_id,
        referral_code_used, points_to_referrer, points_to_referee, status
      ) VALUES (
        v_referrer_id, NEW.id,
        v_referred_by, 10, 10, 'completed'
      );

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-attach the trigger (replaces the old one)
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ── 6. get_referral_stats(p_user_id) RPC ─────────────────────
DROP FUNCTION IF EXISTS public.get_referral_stats(UUID);
--  Returns: referral_code, points, total_referrals,
--           current_tier (null if <100 pts), next_tier,
--           points_to_next

CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code        TEXT;
  v_points      INT := 0;
  v_total       INT := 0;
  v_tier        JSONB := NULL;
  v_next        JSONB := NULL;
  v_pts_to_next INT := 0;
BEGIN
  SELECT
    COALESCE(referral_code, '—'),
    COALESCE(reward_points, 0)
  INTO v_code, v_points
  FROM public.user_profiles
  WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_total
  FROM public.referral_logs
  WHERE referrer_user_id = p_user_id;

  -- Tier ladder
  IF v_points >= 600 THEN
    v_tier        := '{"label":"🏆 Platinum — ₹2,000 voucher","min_points":600}'::jsonb;
    v_next        := NULL;
    v_pts_to_next := 0;
  ELSIF v_points >= 300 THEN
    v_tier        := '{"label":"🥇 Gold — ₹1,000 voucher","min_points":300}'::jsonb;
    v_next        := '{"label":"Platinum","min_points":600}'::jsonb;
    v_pts_to_next := 600 - v_points;
  ELSIF v_points >= 100 THEN
    v_tier        := '{"label":"🥈 Silver — ₹500 voucher","min_points":100}'::jsonb;
    v_next        := '{"label":"Gold","min_points":300}'::jsonb;
    v_pts_to_next := 300 - v_points;
  ELSE
    v_tier        := NULL;
    v_next        := '{"label":"Silver — ₹500 voucher","min_points":100}'::jsonb;
    v_pts_to_next := 100 - v_points;
  END IF;

  RETURN jsonb_build_object(
    'referral_code',   v_code,
    'points',          v_points,
    'total_referrals', v_total,
    'current_tier',    v_tier,
    'next_tier',       v_next,
    'points_to_next',  v_pts_to_next
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO authenticated;


-- ── 7. RLS: allow authenticated users to read own referral_logs ─
-- (v8 already sets these policies; this is a no-op if v8 was run)

ALTER TABLE public.referral_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_referral_logs"     ON public.referral_logs;
DROP POLICY IF EXISTS "user_insert_referral_log"   ON public.referral_logs;
DROP POLICY IF EXISTS "admin_manage_referral_logs"  ON public.referral_logs;

CREATE POLICY "user_own_referral_logs"
  ON public.referral_logs FOR SELECT
  USING (referred_user_id = auth.uid() OR referrer_user_id = auth.uid()
         OR public.is_admin());

CREATE POLICY "user_insert_referral_log"
  ON public.referral_logs FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "admin_manage_referral_logs"
  ON public.referral_logs FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── DONE ──────────────────────────────────────────────────────
-- After running this:
--   1. Every user_profiles row now has a unique UPPERCASE referral_code
--   2. New signups auto-generate a code; referral is processed in the
--      same transaction that creates their auth row
--   3. get_referral_stats() powers the profile page stats panel
--   4. Admins/mentors still get a referral code, but profile.html
--      hides the section for admin roles (JS change in profile.html)
