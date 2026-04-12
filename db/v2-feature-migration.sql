-- ============================================================
-- SKILLUPNOW V2 FEATURE MIGRATION
-- Run this in Supabase SQL editor (project: kenlnisfhrkgolvxitfc)
-- Date: 2026-04-12
-- Changes:
--   1. live_recordings: add base_amount, gst_percentage, total_amount
--   2. courses: add is_trending flag
--   3. course_categories: ensure icon column exists
--   4. enrollments: access_expires_at for time-bound access
--   5. payments: invoice_number auto-generation
--   6. form_submissions: session_id tracking
-- ============================================================

-- ── 1. live_recordings: amount fields ────────────────────────
ALTER TABLE public.live_recordings
  ADD COLUMN IF NOT EXISTS base_amount    NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2)  DEFAULT 18,
  ADD COLUMN IF NOT EXISTS total_amount   NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE WHEN base_amount IS NOT NULL
      THEN ROUND(base_amount * (1 + COALESCE(gst_percentage, 18) / 100), 2)
      ELSE NULL
    END
  ) STORED;

-- ── 2. courses: trending flag ────────────────────────────────
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_trending BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 3. course_categories: ensure icon column exists ──────────
ALTER TABLE public.course_categories
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '📚';

-- ── 4. enrollments: time-bound access expiry ─────────────────
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ DEFAULT NULL;

-- ── 5. payments: invoice number ──────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE DEFAULT NULL;

-- Auto-generate invoice numbers for existing payments
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1001;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_number IS NULL AND NEW.payment_status = 'completed' THEN
    NEW.invoice_number := 'SUN-INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('public.invoice_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_invoice ON public.payments;
CREATE TRIGGER trg_generate_invoice
BEFORE INSERT OR UPDATE OF payment_status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();

-- Backfill invoice numbers for completed payments without one
UPDATE public.payments
SET invoice_number = 'SUN-INV-' || TO_CHAR(paid_at, 'YYYY') || '-' || LPAD(NEXTVAL('public.invoice_seq')::TEXT, 5, '0')
WHERE payment_status = 'completed' AND invoice_number IS NULL;

-- ── 6. form_submissions: session tracking ────────────────────
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS session_id   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_source   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS page_url     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_agent   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_address   INET DEFAULT NULL;

-- ── 7. discounts: create table if missing, then add new columns ──
CREATE TABLE IF NOT EXISTS public.discount_campaigns (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name       TEXT          NOT NULL,
  code                TEXT          UNIQUE,
  discount_type       TEXT          NOT NULL DEFAULT 'percentage'
                                    CHECK (discount_type IN ('percentage', 'flat')),
  discount_value      NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_discount_amount NUMERIC(12,2) DEFAULT NULL,
  course_id           UUID          REFERENCES public.courses(id) ON DELETE SET NULL,
  valid_from          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  valid_until         TIMESTAMPTZ   DEFAULT NULL,
  max_uses            INT           DEFAULT NULL,
  current_uses        INT           NOT NULL DEFAULT 0,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  min_order_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  auto_apply          BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Add new columns if the table already existed without them
ALTER TABLE public.discount_campaigns
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_apply       BOOLEAN       NOT NULL DEFAULT FALSE;

-- ── 8. course_batches: skill tags for filtering ───────────────
ALTER TABLE public.course_batches
  ADD COLUMN IF NOT EXISTS skill_tags TEXT[] DEFAULT '{}';

-- ── 9. Indexes for new columns ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_courses_trending
  ON public.courses (is_trending) WHERE is_trending = TRUE;

CREATE INDEX IF NOT EXISTS idx_live_recordings_amount
  ON public.live_recordings (base_amount) WHERE base_amount IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_invoice
  ON public.payments (invoice_number) WHERE invoice_number IS NOT NULL;

-- ── DONE ─────────────────────────────────────────────────────
-- After running this migration, refresh the admin dashboard.
-- All existing data is preserved; new columns default to NULL/FALSE.
