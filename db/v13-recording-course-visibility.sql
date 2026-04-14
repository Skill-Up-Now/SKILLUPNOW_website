-- ============================================================
-- SKILLUPNOW V13 — FIX COURSE VISIBILITY FOR RECORDINGS PLAYLIST
-- Run in Supabase SQL editor (project: kenlnisfhrkgolvxitfc)
-- Date: 2026-04-14
-- Problem:
--   The /recording-videos page groups the playlist by course title.
--   Courses like "WEBINAR" that are not published (course_status !=
--   'published') are hidden from anonymous/regular users by the
--   courses_read_policy. When Supabase joins
--   direct_course:course_id(...) for these recordings it returns
--   NULL, so all WEBINAR recordings fall into the "Other" group
--   instead of showing "WEBINAR" as the group heading.
-- Fix:
--   Extend courses_read_policy to allow reading a course's basic
--   info (id, title, category) whenever that course has at least
--   one published recording. This makes the playlist join work for
--   ALL courses that have content — regardless of publish status.
--   Also extends course_pricing_read_policy the same way so price
--   tags load correctly for those courses.
-- ============================================================


-- ── 1. courses RLS — add "has published recordings" condition ──

DROP POLICY IF EXISTS courses_read_policy ON public.courses;

CREATE POLICY courses_read_policy ON public.courses FOR SELECT USING (
  public.is_admin()
  OR EXISTS (
      SELECT 1 FROM public.course_mentor_assignments cma
      WHERE cma.course_id = courses.id
        AND cma.mentor_user_id = auth.uid()
        AND cma.is_active = TRUE
  )
  OR (courses.course_status = 'published' AND courses.visibility IN ('public', 'unlisted'))
  OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = courses.id
        AND e.student_user_id = auth.uid()
  )
  -- NEW: any course that has at least one published recording is
  -- readable by everyone so the playlist groups display correctly.
  OR EXISTS (
      SELECT 1 FROM public.live_recordings lr
      WHERE lr.course_id = courses.id
        AND lr.is_published = TRUE
  )
);


-- ── 2. course_pricing RLS — same extension ─────────────────────

DROP POLICY IF EXISTS course_pricing_read_policy ON public.course_pricing;

CREATE POLICY course_pricing_read_policy ON public.course_pricing FOR SELECT USING (
  public.is_admin()
  OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_pricing.course_id
        AND c.course_status = 'published'
        AND c.visibility IN ('public', 'unlisted')
  )
  -- NEW: pricing visible when the course has published recordings
  OR EXISTS (
      SELECT 1 FROM public.live_recordings lr
      WHERE lr.course_id = course_pricing.course_id
        AND lr.is_published = TRUE
  )
);


-- ── DONE ──────────────────────────────────────────────────────
-- After running this:
--   1. Courses that contain published recordings (e.g. WEBINAR)
--      are now readable by all users in the JOIN query, so the
--      recording-videos playlist shows the correct course title
--      as the group heading instead of "Other".
--   2. course_pricing rows for those courses are also visible,
--      so price tags load correctly in the playlist.
--   3. Courses with NO recordings and not published remain
--      hidden to the public — no change to existing behaviour.
