-- ============================================================
-- SKILLUPNOW ADMIN SELF-REGISTRATION RPC
-- Allows a newly signed-up user to claim admin role using
-- a valid invite code. Run this after db/schema.sql.
--
-- INVITE CODE: SUN-ADMIN-INVITE-2026
-- Share this only with authorized admin candidates.
--
-- After running this, admins can self-register at:
--   pages/admin-signup.html
-- ============================================================

CREATE OR REPLACE FUNCTION public.setup_new_admin(
  p_user_id   UUID,
  p_invite_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid_code    TEXT := 'SUN-ADMIN-INVITE-2026';
  v_portal_secret TEXT := 'SUN_ADMIN_PORTAL_2026_04_B9qL2vX7!rK4';
  v_user_exists   BOOLEAN;
BEGIN
  -- Validate invite code (constant-time compare via HMAC not needed here since
  -- the invite code itself is secret and not exposed publicly)
  IF p_invite_code IS DISTINCT FROM v_valid_code THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid invite code. Contact the system administrator.');
  END IF;

  -- Verify the user profile exists (created by auth trigger on signup)
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles WHERE user_id = p_user_id
  ) INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User profile not found. Please wait a moment and try again.'
    );
  END IF;

  -- Assign admin role in user_role_assignments.
  -- The trg_ensure_role_profile trigger will auto-create admin_profiles.
  INSERT INTO public.user_role_assignments (
    user_id, role, is_primary, is_active, assigned_reason
  )
  VALUES (
    p_user_id, 'admin', TRUE, TRUE, 'Admin self-registration via invite code'
  )
  ON CONFLICT (user_id, role) DO UPDATE
    SET is_primary  = TRUE,
        is_active   = TRUE,
        revoked_at  = NULL,
        updated_at  = NOW();

  -- admin_profiles row now exists (created by trigger above).
  -- Set up admin_portal_access so OTP login works.
  INSERT INTO public.admin_portal_access (
    user_id,
    authorized_email,
    secret_key_hash,
    portal_status,
    otp_enabled,
    notes
  )
  SELECT
    p_user_id,
    up.email,
    encode(digest(v_portal_secret, 'sha256'), 'hex'),
    'active',
    TRUE,
    'Admin registered via invite code on ' || NOW()::DATE::TEXT
  FROM public.user_profiles up
  WHERE up.user_id = p_user_id
  ON CONFLICT (user_id) DO UPDATE
    SET portal_status = 'active',
        otp_enabled   = TRUE,
        updated_at    = NOW();

  -- Audit log
  INSERT INTO public.auth_activity_logs (user_id, event_name, metadata)
  VALUES (
    p_user_id,
    'admin_self_registration',
    jsonb_build_object('invite_code_used', true)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Admin account configured successfully.');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Allow both anon (unconfirmed users) and authenticated users to call this.
-- Security is enforced by the invite code inside the function.
GRANT EXECUTE ON FUNCTION public.setup_new_admin(UUID, TEXT) TO anon, authenticated;

-- ── Verification query ──────────────────────────────────────
-- After running, verify with:
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name = 'setup_new_admin';
