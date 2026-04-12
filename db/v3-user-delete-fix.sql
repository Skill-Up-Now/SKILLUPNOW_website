-- ============================================================
-- SKILLUPNOW V3 — USER CASCADE DELETE FIX
-- Run in Supabase SQL editor (project: kenlnisfhrkgolvxitfc)
-- Date: 2026-04-12
-- Purpose:
--   Create admin_delete_user() function that removes ALL user
--   data across every table in dependency order, then deletes
--   the auth.users record — fixing the "Database error deleting
--   user" that blocks Supabase Dashboard deletions.
-- ============================================================

-- ── Drop existing version if any ─────────────────────────────
DROP FUNCTION IF EXISTS public.admin_delete_user(UUID);

-- ── Main delete function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER                    -- runs as postgres (owner), can access auth schema
SET search_path = public, auth
AS $$
DECLARE
  caller_id UUID;
BEGIN
  -- ── Auth guard ──────────────────────────────────────────────
  caller_id := auth.uid();

  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = caller_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Forbidden: Cannot delete your own account';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found: %', target_user_id;
  END IF;

  -- ── Delete in dependency order (leaf tables first) ──────────

  -- 1. Payment schedules link to enrollments → delete first
  DELETE FROM public.payment_schedules ps
    USING public.enrollments e
    WHERE ps.enrollment_id = e.id
      AND e.student_user_id = target_user_id;

  -- 2. Payments
  DELETE FROM public.payments WHERE student_user_id = target_user_id;

  -- 3. Enrollments
  DELETE FROM public.enrollments WHERE student_user_id = target_user_id;

  -- 4. Reviews
  DELETE FROM public.reviews WHERE user_id = target_user_id;

  -- 5. Inquiries (if column exists — table may use email instead)
  BEGIN
    DELETE FROM public.inquiries WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  -- 6. Form submissions
  BEGIN
    DELETE FROM public.form_submissions WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  -- 7. Notifications
  BEGIN
    DELETE FROM public.notifications WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 8. Mentor: nullify batch FK references (batches belong to org, not the mentor)
  UPDATE public.course_batches
    SET primary_mentor_user_id = NULL
    WHERE primary_mentor_user_id = target_user_id;

  -- 9. Class sessions mentored by this user
  DELETE FROM public.class_sessions WHERE mentor_user_id = target_user_id;

  -- 10. Mentor profile
  DELETE FROM public.mentor_profiles WHERE user_id = target_user_id;

  -- 11. Admin record (if user was an admin too)
  DELETE FROM public.admin_users WHERE user_id = target_user_id;

  -- 12. Student profile (separate table in some schemas)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_profiles'
  ) THEN
    DELETE FROM public.student_profiles WHERE user_id = target_user_id;
  END IF;

  -- 13. User profile (public.user_profiles)
  DELETE FROM public.user_profiles WHERE user_id = target_user_id;

  -- 14. Auth user — must be last; all FKs pointing here must already be gone
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_user_id', target_user_id::text
  );
END;
$$;

-- Grant execute to authenticated users (admin check is inside the function)
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- ── DONE ─────────────────────────────────────────────────────
-- After running this:
--   1. Admin dashboard can now call rpc('admin_delete_user', { target_user_id })
--   2. User + ALL related data will be permanently removed
--   3. The Supabase Dashboard user list will also reflect the deletion
--      (both tables are the same auth.users record)
