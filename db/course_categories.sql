-- ============================================================
-- SKILLUPNOW — COURSE CATEGORIES TABLE (Central Category Source)
-- Run this in Supabase SQL Editor.
-- All category dropdowns site-wide read from this table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.course_categories (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT    NOT NULL UNIQUE,
  slug        TEXT    NOT NULL UNIQUE,
  icon        TEXT    DEFAULT '📘',
  color       TEXT    DEFAULT '#7c5cfc',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.course_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_categories_active ON public.course_categories(is_active, sort_order);

ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;

-- Anyone can read active categories
CREATE POLICY "Public read categories"
  ON public.course_categories FOR SELECT
  USING (is_active = true);

-- Admins manage categories
CREATE POLICY "Admin manage categories"
  ON public.course_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Seed default categories (admin can delete/replace these)
INSERT INTO public.course_categories (name, slug, icon, color, sort_order) VALUES
  ('All Courses',        'all',          '🌐', '#7c5cfc', 0),
  ('Cloud Computing',    'cloud',        '☁️', '#3d6bff', 1),
  ('AI & Machine Learning', 'ai',        '🤖', '#f59e0b', 2),
  ('DevOps',             'devops',       '⚙️', '#4ade80', 3),
  ('Cybersecurity',      'cybersecurity','🔒', '#f87171', 4),
  ('Data Engineering',   'data',         '📊', '#a78bfa', 5),
  ('Web Development',    'web',          '🌍', '#34d399', 6),
  ('Leadership',         'leadership',   '🏆', '#fbbf24', 7),
  ('Communication Skills','communication','💬', '#60a5fa', 8),
  ('Testing & QA',       'testing',      '🧪', '#fb923c', 9),
  ('Science',            'science',      '🔬', '#e879f9', 10),
  ('1-on-1 Instruction', '1on1',         '👨‍🏫','#2dd4bf', 11)
ON CONFLICT (slug) DO NOTHING;

-- Also update the user_enrollments table to add payment_method if not exists
ALTER TABLE public.user_enrollments
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pending'
    CHECK (payment_method IN ('gpay','cash','upi','net_banking','credit_card','debit_card','emi','bank_transfer','pending'));
