-- v16: Course Interests — track students who express interest in upcoming courses
-- Run this in your Supabase SQL Editor

-- ── Table ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_interests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name     TEXT,
  email            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Allow one interest record per (course, user).
  -- Anonymous (not logged in) rows have student_user_id IS NULL — no unique constraint there.
  CONSTRAINT uq_course_interest_user UNIQUE (course_id, student_user_id)
    DEFERRABLE INITIALLY DEFERRED
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_course_interests_course   ON course_interests (course_id);
CREATE INDEX IF NOT EXISTS idx_course_interests_user     ON course_interests (student_user_id);
CREATE INDEX IF NOT EXISTS idx_course_interests_created  ON course_interests (created_at DESC);

-- ── Row-Level Security ─────────────────────────────────────────────────────────
ALTER TABLE course_interests ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can upsert their own interest
CREATE POLICY "users can upsert own interest"
  ON course_interests FOR INSERT
  WITH CHECK (student_user_id = auth.uid() OR student_user_id IS NULL);

-- Admins can read all interests
CREATE POLICY "admins can read interests"
  ON course_interests FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
    OR student_user_id = auth.uid()
  );

-- Admins can delete interests
CREATE POLICY "admins can delete interests"
  ON course_interests FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- Allow upsert (ON CONFLICT UPDATE) — update is needed for upsert to work
CREATE POLICY "users can update own interest"
  ON course_interests FOR UPDATE
  USING (student_user_id = auth.uid());

-- ── Convenience view for admin dashboard ──────────────────────────────────────
CREATE OR REPLACE VIEW admin_course_interests AS
SELECT
  ci.id,
  ci.created_at,
  ci.student_name,
  ci.email,
  ci.student_user_id,
  ci.course_id,
  c.title  AS course_title,
  c.level  AS course_level
FROM course_interests ci
JOIN courses c ON c.id = ci.course_id
ORDER BY ci.created_at DESC;

-- Grant admin role (service_role or your custom admin role) access to the view
-- Adjust if you use a different admin role name.
GRANT SELECT ON admin_course_interests TO service_role;
