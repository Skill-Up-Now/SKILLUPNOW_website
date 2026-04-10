-- ============================================================
-- SKILLUPNOW ADMIN ACCESS RESET
-- Clears OTP state, unlocks the portal, and resets counters for
-- the dedicated super admin.
-- ============================================================

DO $$
DECLARE
  v_admin_email TEXT := 'skillupnowoff@gmail.com';
  v_user_id UUID;
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE email = v_admin_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for %', v_admin_email;
  END IF;

  UPDATE public.admin_portal_access
  SET portal_status = 'active',
      otp_verified_until = NULL,
      failed_attempt_count = 0,
      last_failed_login_at = NULL,
      updated_at = NOW()
  WHERE user_id = v_user_id;

  UPDATE public.admin_login_otp_challenges
  SET consumed_at = NOW()
  WHERE user_id = v_user_id
    AND consumed_at IS NULL;

  INSERT INTO public.auth_activity_logs (user_id, event_name, metadata)
  VALUES (
    v_user_id,
    'admin_access_reset',
    jsonb_build_object('email', v_admin_email)
  );
END $$;

SELECT
  up.email,
  apa.portal_status,
  apa.failed_attempt_count,
  apa.otp_verified_until,
  apa.last_login_at
FROM public.user_profiles up
JOIN public.admin_portal_access apa ON apa.user_id = up.user_id
WHERE up.email = 'skillupnowoff@gmail.com';
