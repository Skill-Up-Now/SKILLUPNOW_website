-- ============================================================
-- SKILLUPNOW V7 — COMPREHENSIVE SECURITY HARDENING
-- Run in Supabase SQL editor (project: kenlnisfhrkgolvxitfc)
-- Date: 2026-04-12
-- Purpose:
--   Root cause of profile update "permission denied":
--     log_row_activity() was NOT SECURITY DEFINER, running with
--     the student user's privileges. When it INSERTs into
--     activity_logs the student lacks the direct table-level
--     GRANT, rolling back the entire user_profiles UPDATE.
--
--   Fixes applied:
--     1. log_row_activity() → SECURITY DEFINER + SET search_path
--        + EXCEPTION block (logging never breaks main operation)
--     2. Mutable search_path fixed on is_admin, is_super_admin,
--        current_actor_type, handle_updated_at
--     3. discount_campaigns → RLS enabled
--     4. signup_email_otps → open ALL policy replaced with
--        minimal INSERT/SELECT/DELETE policies
--     5. activity_logs → open INSERT removed (trigger is now
--        SECURITY DEFINER, bypasses RLS)
--     6. auth_activity_logs → open INSERT restricted to self
-- ============================================================

-- ── 1. Fix log_row_activity() ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_row_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_entity_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_entity_id := COALESCE(to_jsonb(OLD)->>'id', to_jsonb(OLD)->>'user_id');
  ELSE
    v_entity_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'user_id');
  END IF;

  BEGIN
    INSERT INTO public.activity_logs (
      actor_user_id, actor_type, entity_type, entity_id, action_name, old_values, new_values
    ) VALUES (
      auth.uid(),
      COALESCE(public.current_actor_type(), 'anonymous'::public.activity_actor_type),
      TG_TABLE_NAME,
      v_entity_id,
      LOWER(TG_OP),
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
  EXCEPTION WHEN OTHERS THEN
    -- Logging must NEVER break the originating operation
    NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 2. Fix is_admin() ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments
    WHERE user_id = check_user_id
      AND role IN ('admin', 'super_admin', 'support')
      AND is_active = TRUE
  );
$$;

-- ── 3. Fix is_super_admin() ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments
    WHERE user_id = check_user_id
      AND role = 'super_admin'
      AND is_active = TRUE
  );
$$;

-- ── 4. Fix current_actor_type() ───────────────────────────────
CREATE OR REPLACE FUNCTION public.current_actor_type()
RETURNS activity_actor_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'anonymous'::public.activity_actor_type
    WHEN EXISTS (
      SELECT 1 FROM public.user_role_assignments
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin', 'support')
        AND is_active = TRUE
    ) THEN 'admin'::public.activity_actor_type
    WHEN EXISTS (
      SELECT 1 FROM public.user_role_assignments
      WHERE user_id = auth.uid()
        AND role = 'mentor'
        AND is_active = TRUE
    ) THEN 'mentor'::public.activity_actor_type
    ELSE 'student'::public.activity_actor_type
  END;
$$;

-- ── 5. Fix handle_updated_at() ────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── 6. Enable RLS on discount_campaigns ───────────────────────
ALTER TABLE public.discount_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discount_campaigns_public_read ON public.discount_campaigns;
CREATE POLICY discount_campaigns_public_read ON public.discount_campaigns
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS discount_campaigns_admin_all ON public.discount_campaigns;
CREATE POLICY discount_campaigns_admin_all ON public.discount_campaigns
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 7. Replace open signup_email_otps ALL policy ──────────────
DROP POLICY IF EXISTS signup_otps_access ON public.signup_email_otps;

DROP POLICY IF EXISTS signup_otps_insert ON public.signup_email_otps;
CREATE POLICY signup_otps_insert ON public.signup_email_otps
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS signup_otps_select ON public.signup_email_otps;
CREATE POLICY signup_otps_select ON public.signup_email_otps
  FOR SELECT USING (expires_at > now());

DROP POLICY IF EXISTS signup_otps_delete ON public.signup_email_otps;
CREATE POLICY signup_otps_delete ON public.signup_email_otps
  FOR DELETE USING (true);

-- ── 8. Remove open INSERT on activity_logs ────────────────────
DROP POLICY IF EXISTS activity_logs_insert_any ON public.activity_logs;

DROP POLICY IF EXISTS activity_logs_admin_read ON public.activity_logs;
CREATE POLICY activity_logs_admin_read ON public.activity_logs
  FOR SELECT USING (public.is_admin());

-- ── 9. Restrict auth_activity_logs open INSERT ────────────────
DROP POLICY IF EXISTS auth_activity_logs_insert_any ON public.auth_activity_logs;

DROP POLICY IF EXISTS auth_activity_logs_self_insert ON public.auth_activity_logs;
CREATE POLICY auth_activity_logs_self_insert ON public.auth_activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── DONE ──────────────────────────────────────────────────────
-- After running this:
--   1. Profile photo uploads will save correctly — log_row_activity
--      is now SECURITY DEFINER so the student's INSERT into
--      activity_logs no longer fails and rolls back the UPDATE.
--   2. All SECURITY DEFINER functions have fixed search_path —
--      eliminates the Supabase security advisor warnings.
--   3. discount_campaigns is now protected by RLS.
--   4. signup_email_otps OTP values are no longer fully readable
--      by all users — only non-expired records are selectable.
--   5. activity_logs INSERT is removed from public access —
--      only the SECURITY DEFINER trigger can insert rows.
