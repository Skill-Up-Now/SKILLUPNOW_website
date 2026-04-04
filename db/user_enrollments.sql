-- ============================================================
-- SKILLUPNOW — USER ENROLLMENTS TABLE
-- Run this in Supabase SQL Editor to enable the enrollment
-- management system (Learning Path & Payments section).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_enrollments (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id             TEXT          NOT NULL,
  course_name           TEXT          NOT NULL,
  course_category       TEXT,

  -- Enrollment state
  enrollment_status     TEXT          NOT NULL DEFAULT 'pending'
                                      CHECK (enrollment_status IN ('pending','active','completed','disabled')),
  approved_by           UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Payment details
  payment_status        TEXT          NOT NULL DEFAULT 'pending'
                                      CHECK (payment_status IN ('pending','partial','paid')),
  payment_type          TEXT          NOT NULL DEFAULT 'full'
                                      CHECK (payment_type IN ('full','emi','cash')),
  total_fee             NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid           NUMERIC(10,2) NOT NULL DEFAULT 0,
  remaining_balance     NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- EMI details (nullable for full-payment enrollments)
  emi_months            INTEGER,
  emi_amount_per_month  NUMERIC(10,2),

  -- Access control
  course_access_enabled BOOLEAN       NOT NULL DEFAULT false,

  -- Timestamps
  enrollment_date       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every write
CREATE OR REPLACE TRIGGER trg_user_enrollments_updated_at
  BEFORE UPDATE ON public.user_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_enrollments_user_id   ON public.user_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_enrollments_course_id ON public.user_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_user_enrollments_status    ON public.user_enrollments(enrollment_status);

-- Row-Level Security
ALTER TABLE public.user_enrollments ENABLE ROW LEVEL SECURITY;

-- Users can read their own enrollments
CREATE POLICY "Users read own enrollments"
  ON public.user_enrollments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own enrollments
CREATE POLICY "Users insert own enrollments"
  ON public.user_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins have full access (requires admin_users table from schema.sql)
CREATE POLICY "Admins full access enrollments"
  ON public.user_enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============================================================
-- MIGRATION: If the table already exists, run these patches
-- to add 'cash' as a valid payment_type and ensure admin
-- INSERT policy exists for manually added enrollments.
-- ============================================================

-- Drop old constraint and recreate with 'cash' support
ALTER TABLE public.user_enrollments
  DROP CONSTRAINT IF EXISTS user_enrollments_payment_type_check;

ALTER TABLE public.user_enrollments
  ADD CONSTRAINT user_enrollments_payment_type_check
  CHECK (payment_type IN ('full', 'emi', 'cash'));

-- Allow admins to insert enrollments on behalf of users
DROP POLICY IF EXISTS "Admins insert enrollments" ON public.user_enrollments;
CREATE POLICY "Admins insert enrollments"
  ON public.user_enrollments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
