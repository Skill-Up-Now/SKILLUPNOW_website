-- ============================================================
-- SKILLUPNOW V3 — USER CASCADE DELETE FIX (rev 2)
-- Run in Supabase SQL editor (project: kenlnisfhrkgolvxitfc)
-- Date: 2026-04-13
-- Purpose:
--   Create admin_delete_user() function that removes ALL user
--   data across every table in dependency order, then deletes
--   the auth.users record.
-- Fix (rev 2):
--   Auth guard now uses public.is_admin() / user_role_assignments
--   instead of the non-existent public.admin_users table.
--   Admin record deletion now targets admin_profiles (correct table).
-- ============================================================

-- ── Drop existing version ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_delete_user(UUID);

-- ── Main delete function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Uses user_role_assignments (the actual admin check table)
  IF NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Forbidden: Cannot delete your own account';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found: %', target_user_id;
  END IF;

  -- ── Delete in dependency order (leaf tables first) ──────────

  -- 1. Payment schedules (RESTRICT on enrollments → must go first)
  DELETE FROM public.payment_schedules ps
    USING public.enrollments e
    WHERE ps.enrollment_id = e.id
      AND e.student_user_id = target_user_id;

  -- 2. Payments (RESTRICT on student_profiles → must go before step 12)
  DELETE FROM public.payments WHERE student_user_id = target_user_id;

  -- 3. Enrollments (RESTRICT on student_profiles → must go before step 12)
  DELETE FROM public.enrollments WHERE student_user_id = target_user_id;

  -- 4. Reviews
  DELETE FROM public.reviews WHERE user_id = target_user_id;

  -- 5. Inquiries
  BEGIN
    DELETE FROM public.inquiries WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
  END;

  -- 6. Form submissions
  BEGIN
    DELETE FROM public.form_submissions WHERE user_id = target_user_id;
    DELETE FROM public.form_submissions WHERE submitted_by_user_id = target_user_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
  END;

  -- 7. Notifications
  BEGIN
    DELETE FROM public.notifications WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 8. SMS verification requests
  BEGIN
    DELETE FROM public.sms_verification_requests WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 9. Mentor: nullify batch FK (batches belong to org, not the mentor)
  UPDATE public.course_batches
    SET primary_mentor_user_id = NULL
    WHERE primary_mentor_user_id = target_user_id;

  -- 10. Class sessions mentored by this user
  DELETE FROM public.class_sessions WHERE mentor_user_id = target_user_id;

  -- 11. Admin portal access (must go before admin_profiles)
  BEGIN
    DELETE FROM public.admin_portal_access WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 12. Admin profile (correct table name)
  DELETE FROM public.admin_profiles WHERE user_id = target_user_id;

  -- 13. Mentor profile
  DELETE FROM public.mentor_profiles WHERE user_id = target_user_id;

  -- 14. Student profile (RESTRICT references resolved above)
  BEGIN
    DELETE FROM public.student_profiles WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 15. User role assignments
  DELETE FROM public.user_role_assignments WHERE user_id = target_user_id;

  -- 16. User profile
  DELETE FROM public.user_profiles WHERE user_id = target_user_id;

  -- 17. Auth user — must be last; all FKs must already be gone
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
--   1. Admin dashboard Delete button will work correctly.
--   2. User + ALL related data permanently removed in safe order.
--   3. Auth guard uses is_admin() → user_role_assignments (correct).
