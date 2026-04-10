-- ============================================================
--  SkillUpNow — Super Admin Setup
--  Run this ONCE in Supabase → SQL Editor after creating the
--  admin auth user via Authentication → Add User in Supabase.
-- ============================================================

-- ── STEP 1 ──────────────────────────────────────────────────
--  Go to: Supabase Dashboard → Authentication → Users → Add User
--  Email   : skillupnow@gmail.com
--  Password: Skillupnow@0904   (matches .env → ADMIN_PASSWORD)
--  ✓ Auto-confirm email
--
--  Copy the UUID shown after creating the user.
--  Paste it below in place of '<PASTE_USER_UUID_HERE>'.
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id   UUID := '4574921a-1718-447c-92a3-a291a27cddf5';   -- ← Replace with real UUID
  v_name      TEXT := 'SkillUpNow Admin';
  v_email     TEXT := 'skillupnow@gmail.com';
BEGIN

  -- 1. Upsert user_profiles row
  INSERT INTO public.user_profiles (
    id, full_name, email, role,
    is_email_verified, created_at, updated_at
  )
  VALUES (
    v_user_id, v_name, v_email, 'super_admin',
    true, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email     = EXCLUDED.email,
        role      = 'super_admin',
        updated_at = NOW();

  -- 2. Upsert admin_users row (grants access to admin-dashboard.html)
  INSERT INTO public.admin_users (
    user_id, role,
    is_active, permissions, created_at, updated_at
  )
  VALUES (
    v_user_id,
    'super_admin',
    true,
    '{
      "users":    {"view":true,"edit":true,"delete":true},
      "courses":  {"view":true,"edit":true,"delete":true},
      "payments": {"view":true,"edit":true,"delete":true},
      "reports":  {"view":true,"export":true},
      "mentors":  {"view":true,"edit":true,"approve":true},
      "settings": {"view":true,"edit":true},
      "enrollments": {"view":true,"edit":true,"delete":true},
      "emi":      {"view":true,"edit":true},
      "notifications": {"view":true,"edit":true},
      "reviews":  {"view":true,"edit":true,"delete":true},
      "inquiries":{"view":true,"edit":true,"delete":true},
      "schedules":{"view":true,"edit":true,"delete":true},
      "admins":   {"view":true,"edit":true,"delete":true}
    }'::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET role        = 'super_admin',
        is_active   = true,
        permissions = EXCLUDED.permissions,
        updated_at  = NOW();

  RAISE NOTICE 'Super admin created/updated successfully for user: %', v_user_id;

END $$;


-- ── STEP 1b — Fix RLS (CRITICAL — run this if admin login fails) ──
-- admin_users has RLS enabled but no SELECT policy, which blocks
-- the login page from reading the admin row via the client.
DO $fix$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_users' AND policyname = 'admin_self_select'
  ) THEN
    EXECUTE 'CREATE POLICY admin_self_select ON public.admin_users FOR SELECT TO authenticated USING (user_id = auth.uid())';
  END IF;
END $fix$;

-- ── STEP 2 — Verify ─────────────────────────────────────────
SELECT
  up.id,
  up.full_name,
  up.email,
  up.role,
  au.role  AS admin_role,
  au.is_active
FROM public.user_profiles up
JOIN public.admin_users    au ON au.user_id = up.id
WHERE up.email = 'skillupnow@gmail.com';


-- ── STEP 3 — Admin Login URL ─────────────────────────────────
--  The admin login page is intentionally NOT linked in the public nav.
--  To log in as admin, navigate directly to:
--
--    http://localhost:5500/pages/admin-login.html
--    or
--    https://your-domain.com/pages/admin-login.html
--
--  Use the credentials stored in .env:
--    Email   : skillupnow@gmail.com
--    Password: ADMIN_PASSWORD value from .env
--
-- ────────────────────────────────────────────────────────────
