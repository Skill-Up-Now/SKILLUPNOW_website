-- SkillUpNow — v8 Referral System Migration
-- Run this in the Supabase SQL Editor (once, idempotent)

-- ── referral_codes: admin-managed codes ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT NOT NULL UNIQUE,
  description          TEXT,
  referrer_user_id     UUID REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
  points_for_referrer  INT  NOT NULL DEFAULT 50,
  points_for_referee   INT  NOT NULL DEFAULT 10,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  max_uses             INT  DEFAULT NULL,           -- NULL = unlimited
  use_count            INT  NOT NULL DEFAULT 0,
  expires_at           TIMESTAMPTZ DEFAULT NULL,    -- NULL = never expires
  created_by           TEXT,                        -- admin email who created it
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── referral_logs: one row per successful referral event ─────────────────────
CREATE TABLE IF NOT EXISTS public.referral_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id     UUID REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
  referred_user_id     UUID REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  referral_code_used   TEXT,
  points_to_referrer   INT  NOT NULL DEFAULT 0,
  points_to_referee    INT  NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'completed'
                         CHECK (status IN ('pending','completed','reversed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── reward_points column on user_profiles (if not already present) ───────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS reward_points INT NOT NULL DEFAULT 0;

-- ── RPC: safely increment reward points ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_reward_points(p_user_id UUID, p_points INT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.user_profiles
  SET reward_points = COALESCE(reward_points, 0) + p_points
  WHERE user_id = p_user_id;
$$;

-- ── RLS: referral_codes ───────────────────────────────────────────────────────
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_codes"  ON public.referral_codes;
DROP POLICY IF EXISTS "admin_manage_codes"         ON public.referral_codes;

-- Public read access (signup page needs to validate codes)
CREATE POLICY "public_read_active_codes"
  ON public.referral_codes FOR SELECT
  USING (is_active = TRUE);

-- Admin full access
CREATE POLICY "admin_manage_codes"
  ON public.referral_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── RLS: referral_logs ────────────────────────────────────────────────────────
ALTER TABLE public.referral_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_referral_logs"    ON public.referral_logs;
DROP POLICY IF EXISTS "user_insert_referral_log"  ON public.referral_logs;
DROP POLICY IF EXISTS "admin_manage_referral_logs" ON public.referral_logs;

-- Users can see their own referral logs
CREATE POLICY "user_own_referral_logs"
  ON public.referral_logs FOR SELECT
  USING (referred_user_id = auth.uid() OR referrer_user_id = auth.uid());

-- Allow insert from any authenticated user (used during signup flow)
CREATE POLICY "user_insert_referral_log"
  ON public.referral_logs FOR INSERT
  WITH CHECK (TRUE);

-- Admin full access
CREATE POLICY "admin_manage_referral_logs"
  ON public.referral_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── Grant function to anon/authenticated ─────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.increment_reward_points(UUID, INT)
  TO authenticated, anon;
