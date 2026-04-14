-- ============================================================
-- SKILLUPNOW V11 — CLEAN DELETED USER DATA
-- Run in Supabase SQL editor (project: kenlnisfhrkgolvxitfc)
-- Date: 2026-04-13
-- Purpose:
--   1. Clean up ALL orphaned user data for users that were
--      deleted from Supabase Auth Dashboard but whose public
--      schema rows were left behind (due to FK RESTRICT from
--      enrollments blocking the cascade).
--   2. Upgrade admin_delete_user() with proper order so hard
--      delete from admin dashboard always works cleanly.
--   3. After cleanup, deleted email addresses are FREE to use
--      for new account registrations.
-- ============================================================


-- ── PART 1: Clean up orphaned data ───────────────────────────
-- Finds all user_profiles whose auth.users row no longer exists
-- and deletes ALL their data in safe dependency order.
-- Safe to run multiple times.

DO $$
DECLARE
  orphan_ids UUID[];
  n INT;
BEGIN
  -- Find profiles with no matching auth user
  SELECT ARRAY_AGG(up.user_id) INTO orphan_ids
  FROM public.user_profiles up
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = up.user_id
  );

  n := COALESCE(array_length(orphan_ids, 1), 0);
  IF n = 0 THEN
    RAISE NOTICE 'No orphaned user profiles found. Nothing to clean up.';
    RETURN;
  END IF;

  RAISE NOTICE 'Found % orphaned user profile(s). Cleaning up...', n;

  -- 1. Payment schedules (via enrollments)
  DELETE FROM public.payment_schedules ps
    USING public.enrollments e
    WHERE ps.enrollment_id = e.id
      AND e.student_user_id = ANY(orphan_ids);

  -- 2. Payments
  DELETE FROM public.payments WHERE student_user_id = ANY(orphan_ids);

  -- 3. Enrollments (removes RESTRICT blocker on student_profiles)
  DELETE FROM public.enrollments WHERE student_user_id = ANY(orphan_ids);

  -- 4. Reviews
  DELETE FROM public.reviews WHERE user_id = ANY(orphan_ids);

  -- 5. Inquiries
  BEGIN
    DELETE FROM public.inquiries WHERE user_id = ANY(orphan_ids);
  EXCEPTION WHEN undefined_column THEN NULL; END;

  -- 6. Form submissions
  BEGIN
    DELETE FROM public.form_submissions WHERE user_id = ANY(orphan_ids);
  EXCEPTION WHEN undefined_column THEN NULL; END;

  -- 7. Notifications
  BEGIN
    DELETE FROM public.notifications WHERE user_id = ANY(orphan_ids);
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- 8. Class attendance
  BEGIN
    DELETE FROM public.class_attendance WHERE student_user_id = ANY(orphan_ids);
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  -- 9. Video access sessions
  BEGIN
    DELETE FROM public.video_access_sessions WHERE student_user_id = ANY(orphan_ids);
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  -- 10. Course access logs
  BEGIN
    DELETE FROM public.course_access_logs WHERE student_user_id = ANY(orphan_ids);
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  -- 11. Mentor: nullify batch FK
  UPDATE public.course_batches
    SET primary_mentor_user_id = NULL
    WHERE primary_mentor_user_id = ANY(orphan_ids);

  -- 12. Class sessions
  DELETE FROM public.class_sessions WHERE mentor_user_id = ANY(orphan_ids);

  -- 13. Course mentor assignments
  DELETE FROM public.course_mentor_assignments WHERE mentor_user_id = ANY(orphan_ids);
  DELETE FROM public.course_mentor_assignments WHERE assigned_by_admin_id = ANY(orphan_ids);

  -- 14. Mentor salary / performance / documents
  BEGIN
    DELETE FROM public.mentor_salary_payments WHERE mentor_user_id = ANY(orphan_ids);
    DELETE FROM public.mentor_performance_reports WHERE mentor_user_id = ANY(orphan_ids);
    DELETE FROM public.mentor_documents WHERE mentor_user_id = ANY(orphan_ids);
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  -- 15. Mentor profile
  DELETE FROM public.mentor_profiles WHERE user_id = ANY(orphan_ids);

  -- 16. Admin records
  DELETE FROM public.admin_users WHERE user_id = ANY(orphan_ids);
  DELETE FROM public.admin_profiles WHERE user_id = ANY(orphan_ids);

  -- 17. Student profile (RESTRICT FK removed in step 3)
  DELETE FROM public.student_profiles WHERE user_id = ANY(orphan_ids);

  -- 18. Auth activity logs
  BEGIN
    DELETE FROM public.auth_activity_logs WHERE user_id = ANY(orphan_ids);
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  -- 19. User profile (last public table)
  DELETE FROM public.user_profiles WHERE user_id = ANY(orphan_ids);

  RAISE NOTICE 'Cleaned up % orphaned user(s). Their email addresses are now free to re-register.', n;
END;
$$;


-- ── PART 2: Upgrade admin_delete_user() ──────────────────────
-- Fixes the deletion order so the admin dashboard "Delete"
-- button always succeeds. Also removes auth_activity_logs.

DROP FUNCTION IF EXISTS public.admin_delete_user(UUID);

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id UUID;
BEGIN
  -- ── Auth guard ───────────────────────────────────────────────
  caller_id := auth.uid();
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: must be logged in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = caller_id AND is_active = true) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  IF caller_id = target_user_id THEN RAISE EXCEPTION 'Forbidden: cannot delete your own account'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found: %', target_user_id;
  END IF;

  -- ── Reassign courses owned by this admin ─────────────────────
  UPDATE public.courses SET owner_admin_id = caller_id
    WHERE owner_admin_id = target_user_id AND caller_id != target_user_id;

  -- ── Delete in dependency order ────────────────────────────────
  DELETE FROM public.payment_schedules ps
    USING public.enrollments e
    WHERE ps.enrollment_id = e.id AND e.student_user_id = target_user_id;

  DELETE FROM public.payments WHERE student_user_id = target_user_id;
  DELETE FROM public.enrollments WHERE student_user_id = target_user_id;
  DELETE FROM public.reviews WHERE user_id = target_user_id;

  BEGIN DELETE FROM public.inquiries WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_column THEN NULL; END;

  BEGIN DELETE FROM public.form_submissions WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_column THEN NULL; END;

  BEGIN DELETE FROM public.notifications WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DELETE FROM public.class_attendance WHERE student_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  BEGIN DELETE FROM public.video_access_sessions WHERE student_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  BEGIN DELETE FROM public.course_access_logs WHERE student_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  UPDATE public.course_batches SET primary_mentor_user_id = NULL
    WHERE primary_mentor_user_id = target_user_id;
  DELETE FROM public.class_sessions WHERE mentor_user_id = target_user_id;
  DELETE FROM public.course_mentor_assignments WHERE mentor_user_id = target_user_id;
  DELETE FROM public.course_mentor_assignments WHERE assigned_by_admin_id = target_user_id;

  BEGIN
    DELETE FROM public.mentor_salary_payments WHERE mentor_user_id = target_user_id;
    DELETE FROM public.mentor_performance_reports WHERE mentor_user_id = target_user_id;
    DELETE FROM public.mentor_documents WHERE mentor_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  DELETE FROM public.mentor_profiles WHERE user_id = target_user_id;
  DELETE FROM public.admin_users WHERE user_id = target_user_id;
  DELETE FROM public.admin_profiles WHERE user_id = target_user_id;
  DELETE FROM public.student_profiles WHERE user_id = target_user_id;

  BEGIN DELETE FROM public.auth_activity_logs WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  DELETE FROM public.user_profiles WHERE user_id = target_user_id;

  -- ── Remove auth user (must be last) ──────────────────────────
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_user_id', target_user_id::text,
    'message', 'User and all data permanently deleted. Email is free to re-register.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;


-- ── PART 3: Verify cleanup ────────────────────────────────────
-- Run this SELECT after Part 1 to confirm no orphaned data remains:
--
-- SELECT up.user_id, up.email, up.full_name
-- FROM public.user_profiles up
-- WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = up.user_id);
--
-- Expected result: 0 rows (empty table = all clean)
--
-- ── DONE ─────────────────────────────────────────────────────
-- After running this:
--   1. All orphaned user data is deleted → emails free to re-register
--   2. admin_delete_user() works reliably for all future deletes
--   3. Supabase Auth Dashboard "Delete" still uses the BEFORE DELETE
--      trigger from v5 — ensure v5 was also run
