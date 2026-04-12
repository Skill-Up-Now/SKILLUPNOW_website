-- ============================================================
-- SKILLUPNOW V4 — RECORDING PUBLIC LISTING FIX
-- Run in Supabase SQL editor (project: kenlnisfhrkgolvxitfc)
-- Date: 2026-04-12
-- Purpose:
--   Allow ALL is_published=TRUE recordings to be listed by
--   every visitor (logged-in or anonymous) so the public
--   /recording-videos page shows all videos.
--
--   Video playback access control is enforced at the
--   application layer (recording-videos.html):
--     • Must be logged in
--     • Must have admin-granted enrollment access_status='active'
--       for the course, OR a completed payment for the course
--     • Otherwise → Razorpay payment gate
-- ============================================================

-- ── Update SELECT policy ─────────────────────────────────────
-- Old policy hid paid/enrolled recordings from non-members.
-- New policy: any published recording is listable by anyone.
-- The video URL (external_url) is only fetched by the JS
-- AFTER access is verified — it is not sent during listing.

DROP POLICY IF EXISTS live_recordings_read_policy ON public.live_recordings;

CREATE POLICY live_recordings_read_policy
  ON public.live_recordings
  FOR SELECT
  USING (
    public.is_admin()       -- admins see everything (incl. drafts)
    OR is_published = TRUE  -- all published recordings visible to all
  );

-- ── Admin write policy stays unchanged ───────────────────────
-- (live_recordings_admin_manage already covers INSERT/UPDATE/DELETE)

-- ── DONE ─────────────────────────────────────────────────────
-- After running this:
--   1. All recordings where is_published=TRUE will appear in
--      the public /recording-videos listing for every visitor.
--   2. The video URL is NOT sent during listing — only after
--      the JS verifies login + enrollment/payment access.
--   3. Admins continue to see draft (is_published=FALSE) records.
