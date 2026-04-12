-- ============================================================
-- SKILLUPNOW V5 — COMPREHENSIVE USER DELETE FIX
-- Run in Supabase SQL editor (project: kenlnisfhrkgolvxitfc)
-- Date: 2026-04-12
-- Purpose:
--   1. Upgrade admin_delete_user() with all missing tables
--      (course_mentor_assignments, mentor_salary_payments, etc.)
--   2. Add a BEFORE DELETE trigger on auth.users so that the
--      Supabase Auth dashboard "Delete user" button also works
--      without "Database error deleting user".
-- ============================================================

-- ── PART 1: Upgraded admin_delete_user() ─────────────────────

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

  -- ── Delete in dependency order ──────────────────────────────
  -- Leaf / child tables must go first to satisfy RESTRICT FKs.

  -- 0. Courses owned by this admin → reassign to the calling admin
  --    (courses.owner_admin_id is NOT NULL RESTRICT, cannot be nullified)
  UPDATE public.courses
    SET owner_admin_id = caller_id
    WHERE owner_admin_id = target_user_id
      AND caller_id != target_user_id;

  -- 1. Payment schedules → CASCADE from enrollments, but delete
  --    explicitly in case of orphaned rows
  DELETE FROM public.payment_schedules ps
    USING public.enrollments e
    WHERE ps.enrollment_id = e.id
      AND e.student_user_id = target_user_id;

  -- 2. Payments (student_user_id → student_profiles RESTRICT)
  DELETE FROM public.payments WHERE student_user_id = target_user_id;

  -- 3. Enrollments (student_user_id → student_profiles RESTRICT)
  DELETE FROM public.enrollments WHERE student_user_id = target_user_id;

  -- 4. Reviews
  DELETE FROM public.reviews WHERE user_id = target_user_id;

  -- 5. Inquiries (user_id column may not exist on all schemas)
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

  -- 8. Class attendance (student side)
  BEGIN
    DELETE FROM public.class_attendance WHERE student_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- 9. Video access sessions
  BEGIN
    DELETE FROM public.video_access_sessions WHERE student_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- 10. Course access logs
  BEGIN
    DELETE FROM public.course_access_logs WHERE student_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- 11. Mentor: nullify batch FK (batches belong to org, not the mentor)
  UPDATE public.course_batches
    SET primary_mentor_user_id = NULL
    WHERE primary_mentor_user_id = target_user_id;

  -- 12. Class sessions mentored by this user
  --     (mentor_user_id → mentor_profiles RESTRICT)
  DELETE FROM public.class_sessions WHERE mentor_user_id = target_user_id;

  -- 13. Course mentor assignments
  --     Both the mentor_user_id FK and assigned_by_admin_id FK are RESTRICT.
  --     Delete assignments where user is the mentor.
  DELETE FROM public.course_mentor_assignments
    WHERE mentor_user_id = target_user_id;
  --     Delete assignments where user (as admin) was the assigner.
  --     (assigned_by_admin_id is NOT NULL so we must delete, not nullify)
  DELETE FROM public.course_mentor_assignments
    WHERE assigned_by_admin_id = target_user_id;

  -- 14. Mentor salary payments
  BEGIN
    DELETE FROM public.mentor_salary_payments WHERE mentor_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- 15. Mentor performance reports
  BEGIN
    DELETE FROM public.mentor_performance_reports WHERE mentor_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- 16. Mentor documents
  BEGIN
    DELETE FROM public.mentor_documents WHERE mentor_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- 17. Mentor profile
  DELETE FROM public.mentor_profiles WHERE user_id = target_user_id;

  -- 18. Admin record
  DELETE FROM public.admin_users WHERE user_id = target_user_id;

  -- 19. Admin profile (cascades admin_users, but explicit is safer)
  DELETE FROM public.admin_profiles WHERE user_id = target_user_id;

  -- 20. Student profile
  DELETE FROM public.student_profiles WHERE user_id = target_user_id;

  -- 21. User profile (public.user_profiles)
  DELETE FROM public.user_profiles WHERE user_id = target_user_id;

  -- 22. Auth user — must be last
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_user_id', target_user_id::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;


-- ── PART 2: BEFORE DELETE trigger on auth.users ───────────────
-- This makes the Supabase Auth dashboard "Delete user" button
-- work by cleaning up all FK-blocked tables before the row is
-- actually removed from auth.users.

CREATE OR REPLACE FUNCTION public.handle_auth_user_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  fallback_admin UUID;
BEGIN
  -- Payment schedules (via enrollments)
  DELETE FROM public.payment_schedules ps
    USING public.enrollments e
    WHERE ps.enrollment_id = e.id
      AND e.student_user_id = OLD.id;

  -- Payments (RESTRICT on student_profiles)
  DELETE FROM public.payments WHERE student_user_id = OLD.id;

  -- Enrollments (RESTRICT on student_profiles)
  DELETE FROM public.enrollments WHERE student_user_id = OLD.id;

  -- Reviews
  DELETE FROM public.reviews WHERE user_id = OLD.id;

  -- Inquiries
  BEGIN
    DELETE FROM public.inquiries WHERE user_id = OLD.id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  -- Form submissions
  BEGIN
    DELETE FROM public.form_submissions WHERE user_id = OLD.id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  -- Notifications
  BEGIN
    DELETE FROM public.notifications WHERE user_id = OLD.id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Class attendance
  BEGIN
    DELETE FROM public.class_attendance WHERE student_user_id = OLD.id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Video access sessions
  BEGIN
    DELETE FROM public.video_access_sessions WHERE student_user_id = OLD.id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Course access logs
  BEGIN
    DELETE FROM public.course_access_logs WHERE student_user_id = OLD.id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Courses owned by this admin (owner_admin_id is NOT NULL RESTRICT)
  -- Reassign to any other active admin; raise error if none exists
  IF EXISTS (SELECT 1 FROM public.courses WHERE owner_admin_id = OLD.id) THEN
    SELECT user_id INTO fallback_admin
      FROM public.admin_users
      WHERE user_id != OLD.id AND is_active = true
      LIMIT 1;
    IF fallback_admin IS NOT NULL THEN
      UPDATE public.courses
        SET owner_admin_id = fallback_admin
        WHERE owner_admin_id = OLD.id;
    ELSE
      RAISE EXCEPTION
        'Cannot delete user: they own courses and no other active admin exists to take ownership. Reassign the courses first.';
    END IF;
  END IF;

  -- Nullify batch primary mentor
  UPDATE public.course_batches
    SET primary_mentor_user_id = NULL
    WHERE primary_mentor_user_id = OLD.id;

  -- Class sessions (RESTRICT on mentor_profiles)
  DELETE FROM public.class_sessions WHERE mentor_user_id = OLD.id;

  -- Course mentor assignments (RESTRICT — both FK columns)
  DELETE FROM public.course_mentor_assignments WHERE mentor_user_id = OLD.id;
  DELETE FROM public.course_mentor_assignments WHERE assigned_by_admin_id = OLD.id;

  -- Mentor-specific tables
  BEGIN
    DELETE FROM public.mentor_salary_payments WHERE mentor_user_id = OLD.id;
    DELETE FROM public.mentor_performance_reports WHERE mentor_user_id = OLD.id;
    DELETE FROM public.mentor_documents WHERE mentor_user_id = OLD.id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Mentor profile
  DELETE FROM public.mentor_profiles WHERE user_id = OLD.id;

  -- Admin records
  DELETE FROM public.admin_users WHERE user_id = OLD.id;
  DELETE FROM public.admin_profiles WHERE user_id = OLD.id;

  -- Student profile
  DELETE FROM public.student_profiles WHERE user_id = OLD.id;

  -- User profile
  DELETE FROM public.user_profiles WHERE user_id = OLD.id;

  RETURN OLD;
END;
$$;

-- Drop if exists, then create
DROP TRIGGER IF EXISTS trg_before_auth_user_delete ON auth.users;

CREATE TRIGGER trg_before_auth_user_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_before_delete();

-- ── DONE ─────────────────────────────────────────────────────
-- After running this:
--   1. Admin dashboard "Delete" button → calls admin_delete_user()
--      which now handles course_mentor_assignments and all mentor tables.
--   2. Supabase Auth dashboard "Delete user" → fires the BEFORE DELETE
--      trigger which clears all FK-blocked rows first, then removes
--      the auth.users record cleanly.
--   3. Both paths are safe to use simultaneously — the trigger's DELETEs
--      are no-ops if admin_delete_user already removed the rows.
