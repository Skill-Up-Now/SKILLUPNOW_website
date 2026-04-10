-- ============================================================
-- SKILLUPNOW VERIFIED SIGNUP RPC
-- Creates a confirmed auth user only after the custom signup
-- OTP has been verified in public.signup_email_otps.
-- Run this after db/schema.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_verified_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'user',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_role TEXT := lower(trim(COALESCE(p_role, 'user')));
  v_user_id UUID;
  v_otp_row public.signup_email_otps%ROWTYPE;
BEGIN
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'A valid email address is required.');
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Full name is required.');
  END IF;

  IF p_password IS NULL
     OR length(p_password) < 8
     OR p_password !~ '[A-Z]'
     OR p_password !~ '[a-z]'
     OR p_password !~ '[0-9]' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Password must be at least 8 characters and include uppercase, lowercase, and a number.'
    );
  END IF;

  IF v_role NOT IN ('user', 'student', 'mentor', 'admin', 'super_admin', 'support') THEN
    v_role := 'user';
  END IF;

  SELECT *
  INTO v_otp_row
  FROM public.signup_email_otps
  WHERE email = v_email
    AND verified_at IS NOT NULL
  ORDER BY verified_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF NOT FOUND OR v_otp_row.verified_at < NOW() - INTERVAL '30 minutes' THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'OTP verification is required before account creation.');
  END IF;

  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'An account with this email already exists.');
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_strip_nulls(
      jsonb_build_object(
        'full_name', trim(p_full_name),
        'phone', NULLIF(trim(COALESCE(p_phone, '')), ''),
        'username', NULLIF(trim(COALESCE(p_username, '')), ''),
        'role', v_role
      ) || COALESCE(p_metadata, '{}'::jsonb)
    ),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::TEXT, 'email', v_email),
    'email',
    v_user_id::TEXT,
    NOW(),
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', v_user_id,
    'email', v_email,
    'message', 'Account created successfully.'
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'An account with this email already exists.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_verified_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
