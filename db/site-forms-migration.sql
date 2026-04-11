-- ============================================================
-- site_forms table: public form links shown on the Forms page
-- Run this once in Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_forms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  form_url     TEXT NOT NULL,
  icon         TEXT DEFAULT '📝',
  sort_order   INTEGER DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS trg_site_forms_updated_at ON public.site_forms;
CREATE TRIGGER trg_site_forms_updated_at
  BEFORE UPDATE ON public.site_forms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.site_forms ENABLE ROW LEVEL SECURITY;

-- Anyone can read active forms (public Forms page — no login needed)
DROP POLICY IF EXISTS site_forms_public_read ON public.site_forms;
CREATE POLICY site_forms_public_read ON public.site_forms
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

-- Only admins can insert / update / delete
DROP POLICY IF EXISTS site_forms_admin_write ON public.site_forms;
CREATE POLICY site_forms_admin_write ON public.site_forms
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_site_forms_active_order
  ON public.site_forms (is_active, sort_order, created_at);

-- ============================================================
-- Seed: actual form links (Feedback & Course Interest first)
-- ============================================================
INSERT INTO public.site_forms (title, description, form_url, icon, sort_order) VALUES
  (
    'Feedback and Course Interest Form',
    'Share your feedback and let us know which courses interest you most.',
    'https://forms.gle/5wL2ibVnnuuuD7ay8',
    '⭐', 1
  ),
  (
    'Generative AI Class – Feedback Form',
    'Specifically for Generative AI class participants — tell us how we''re doing.',
    'https://forms.gle/NkpXrUzeUULEhpX76',
    '🤖', 2
  ),
  (
    'Course EMI Payment Form',
    'Apply for easy monthly instalments on your course fee.',
    'https://forms.gle/Hb3d3GNHvv9NvhXU9',
    '📅', 3
  ),
  (
    'Payment Confirmation Form',
    'Confirm your payment details after completing a transaction.',
    'https://forms.gle/JjdTTLAp8KrYEUoQ9',
    '✅', 4
  )
ON CONFLICT DO NOTHING;
