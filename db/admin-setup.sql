-- ============================================================
-- SKILLUPNOW SUPER ADMIN BOOTSTRAP
-- Creates or updates the dedicated super admin account and
-- grants admin portal access for the normalized schema.
--
-- Default bootstrap values:
--   Name:  SkillUpNow Admin
--   Email: skillupnowoff@gmail.com
--   Portal email: skillupnowoff@gmail.com
--
-- IMPORTANT:
-- 1. Keep the password in sync with `.env` / `.env.local`.
-- 2. Keep the portal secret key in sync with `ADMIN_PORTAL_SECRET_KEY`.
-- 3. Run this after `db/schema.sql`.
-- ============================================================

DO $$
DECLARE
  v_admin_name   TEXT := 'SkillUpNow Admin';
  v_admin_email  TEXT := 'skillupnowoff@gmail.com';
  v_admin_password TEXT := 'Skillupnow@0904';
  v_portal_secret  TEXT := 'SUN_ADMIN_PORTAL_2026_04_B9qL2vX7!rK4';
  v_user_id UUID;
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE email = v_admin_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
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
      v_admin_email,
      crypt(v_admin_password, gen_salt('bf')),
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', v_admin_name, 'role', 'super_admin'),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    IF NOT EXISTS (
      SELECT 1
      FROM auth.identities
      WHERE user_id = v_user_id
        AND provider = 'email'
    ) THEN
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
        jsonb_build_object('sub', v_user_id::TEXT, 'email', v_admin_email),
        'email',
        v_user_id::TEXT,
        NOW(),
        NOW(),
        NOW()
      );
    END IF;
  ELSE
    UPDATE auth.users
    SET email = v_admin_email,
        encrypted_password = crypt(v_admin_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', v_admin_name, 'role', 'super_admin'),
        updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.user_profiles (
    user_id,
    full_name,
    email,
    role,
    is_email_verified,
    account_created_at
  ) VALUES (
    v_user_id,
    v_admin_name,
    v_admin_email,
    'super_admin',
    TRUE,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      role = 'super_admin',
      is_email_verified = TRUE,
      updated_at = NOW();

  INSERT INTO public.user_role_assignments (
    user_id,
    role,
    is_primary,
    is_active,
    assigned_reason
  ) VALUES (
    v_user_id,
    'super_admin',
    TRUE,
    TRUE,
    'Bootstrap super admin'
  )
  ON CONFLICT (user_id, role) DO UPDATE
  SET is_primary = TRUE,
      is_active = TRUE,
      revoked_at = NULL;

  INSERT INTO public.admin_profiles (
    user_id,
    admin_code,
    admin_title,
    department,
    status,
    permissions
  ) VALUES (
    v_user_id,
    'SUN-SUPER-ADMIN',
    'Founder Admin',
    'Platform Operations',
    'active',
    jsonb_build_object(
      'users', jsonb_build_object('view', true, 'edit', true, 'delete', true),
      'courses', jsonb_build_object('view', true, 'edit', true, 'publish', true),
      'payments', jsonb_build_object('view', true, 'edit', true, 'refund', true),
      'mentors', jsonb_build_object('view', true, 'approve', true, 'edit', true),
      'reports', jsonb_build_object('view', true, 'export', true)
    )
  )
  ON CONFLICT (user_id) DO UPDATE
  SET admin_code = EXCLUDED.admin_code,
      admin_title = EXCLUDED.admin_title,
      department = EXCLUDED.department,
      status = 'active',
      permissions = EXCLUDED.permissions,
      updated_at = NOW();

  INSERT INTO public.admin_portal_access (
    user_id,
    authorized_email,
    secret_key_hash,
    portal_status,
    otp_enabled,
    notes
  ) VALUES (
    v_user_id,
    v_admin_email,
    encode(digest(v_portal_secret, 'sha256'), 'hex'),
    'active',
    TRUE,
    'Dedicated super admin portal access'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET authorized_email = EXCLUDED.authorized_email,
      secret_key_hash = EXCLUDED.secret_key_hash,
      portal_status = 'active',
      otp_enabled = TRUE,
      updated_at = NOW();

  INSERT INTO public.auth_activity_logs (user_id, event_name, metadata)
  VALUES (
    v_user_id,
    'super_admin_bootstrap',
    jsonb_build_object('email', v_admin_email)
  );
END $$;

SELECT
  up.user_id,
  up.full_name,
  up.email,
  up.role,
  ap.status AS admin_status,
  apa.portal_status,
  apa.authorized_email
FROM public.user_profiles up
JOIN public.admin_profiles ap ON ap.user_id = up.user_id
JOIN public.admin_portal_access apa ON apa.user_id = up.user_id
WHERE up.email = 'skillupnowoff@gmail.com';
