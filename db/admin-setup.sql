-- ============================================================
-- SKILLUPNOW — ADMIN USER SETUP
-- Run this in Supabase SQL Editor AFTER schema.sql
--
-- Admin credentials:
--   Username : skillupnowadmin
--   Email    : skillupnowadmin@skillupnow.org
--   Password : Skillupnow@0904
-- ============================================================


-- ============================================================
-- STEP 1 — Create the admin auth user
-- This inserts directly into Supabase's managed auth.users table.
-- The password is bcrypt-hashed automatically via pgcrypto.
-- ============================================================
DO $$
DECLARE
  v_admin_id UUID := gen_random_uuid();
BEGIN

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
    is_super_admin,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',  -- instance_id (default for single-tenant)
    v_admin_id,
    'authenticated',
    'authenticated',
    'skillupnowadmin@skillupnow.org',
    crypt('Skillupnow@0904', gen_salt('bf')),  -- bcrypt-hashed password
    NOW(),                                      -- email pre-confirmed
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"SkillUpNow Admin","username":"skillupnowadmin"}',
    FALSE,
    NOW(),
    NOW(),
    '', '', '', ''
  );

  -- ============================================================
  -- STEP 2 — Create the user profile row
  -- ============================================================
  INSERT INTO public.user_profiles (
    id,
    full_name,
    email,
    is_email_verified,
    is_active,
    registration_date
  )
  VALUES (
    v_admin_id,
    'SkillUpNow Admin',
    'skillupnowadmin@skillupnow.org',
    TRUE,
    TRUE,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- STEP 3 — Grant super_admin role
  -- ============================================================
  INSERT INTO public.admin_users (
    user_id,
    role,
    permissions,
    is_active
  )
  VALUES (
    v_admin_id,
    'super_admin',
    '{
      "users":    {"view":true,"edit":true,"delete":true},
      "courses":  {"view":true,"edit":true,"delete":true},
      "payments": {"view":true,"edit":true,"delete":true},
      "reports":  {"view":true,"export":true},
      "settings": {"view":true,"edit":true},
      "admins":   {"view":true,"edit":true,"delete":true}
    }',
    TRUE
  )
  ON CONFLICT (user_id) DO UPDATE
    SET role        = 'super_admin',
        is_active   = TRUE,
        updated_at  = NOW();

  RAISE NOTICE '✅ Admin user created: skillupnowadmin@skillupnow.org (id: %)', v_admin_id;

END;
$$;


-- ============================================================
-- VERIFY — Run this to confirm the admin was created
-- ============================================================
SELECT
  u.email,
  up.full_name,
  au.role          AS admin_role,
  au.is_active     AS admin_active,
  u.email_confirmed_at IS NOT NULL AS email_confirmed
FROM auth.users          u
JOIN public.user_profiles up ON up.id     = u.id
JOIN public.admin_users   au ON au.user_id = u.id
WHERE u.email = 'skillupnowadmin@skillupnow.org';


-- ============================================================
-- TROUBLESHOOTING
--
-- If you get "duplicate key" on auth.users:
--   The email already exists. To reset the password instead:
--
--   UPDATE auth.users
--   SET encrypted_password = crypt('Skillupnow@0904', gen_salt('bf')),
--       email_confirmed_at = NOW(),
--       updated_at         = NOW()
--   WHERE email = 'skillupnowadmin@skillupnow.org';
--
-- Then re-run STEP 3 to ensure admin_users row exists.
--
-- ============================================================
-- HOW ADMIN LOGIN WORKS ON THE WEBSITE
--
-- 1. User goes to the Sign In modal on any page (index.html)
--    OR directly visits pages/admin-login.html
--
-- 2. Enters:
--      Email    : skillupnowadmin@skillupnow.org
--      Password : Skillupnow@0904
--
-- 3. On successful login, the code calls checkAdminAccess(userId).
--    This queries admin_users WHERE user_id = <id> AND is_active = true.
--
-- 4. If the row exists → user is automatically redirected to
--    pages/admin-dashboard.html
--
-- 5. Regular users (not in admin_users) stay on the homepage.
-- ============================================================
