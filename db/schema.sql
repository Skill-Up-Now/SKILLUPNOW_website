-- ============================================================
-- SKILLUPNOW — COMPLETE DATABASE SCHEMA
-- PostgreSQL 15 via Supabase
-- Version: 3.0 — Full Platform Schema (Users, Mentors, Courses,
--   Enrollments, Payments, Reviews, Forms, Logs, Reports)
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SECTION 1: USER PROFILES
-- Extends Supabase auth.users with platform-specific data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                   UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            TEXT         NOT NULL,
  username             TEXT         UNIQUE,
  email                TEXT         UNIQUE NOT NULL,
  phone                TEXT,
  date_of_birth        DATE,
  gender               TEXT         CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  address              TEXT,
  city                 TEXT,
  state                TEXT,
  pincode              TEXT         CHECK (pincode ~ '^\d{6}$'),
  profile_picture_url  TEXT,
  -- role: user | mentor | admin (synced from admin_users / mentors table)
  role                 TEXT         NOT NULL DEFAULT 'user'
                                   CHECK (role IN ('user','mentor','admin','super_admin')),
  is_email_verified    BOOLEAN      NOT NULL DEFAULT FALSE,
  is_phone_verified    BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
  referral_code        TEXT         UNIQUE DEFAULT SUBSTRING(MD5(gen_random_uuid()::TEXT), 1, 8),
  referred_by          UUID         REFERENCES public.user_profiles(id),
  reward_points        INT          NOT NULL DEFAULT 0,
  registration_date    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- NOTE: v_users_with_enrollment_count is defined in SECTION 19
--       (after enrollments table exists)

-- Auto-create user_profile on Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SECTION 2: OTP VERIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT         NOT NULL,
  phone        TEXT,
  otp_code     TEXT         NOT NULL,           -- store bcrypt hash only
  otp_type     TEXT         NOT NULL
               CHECK (otp_type IN ('email_verification','phone_verification','password_reset','login')),
  status       TEXT         NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','verified','expired')),
  attempts     INT          NOT NULL DEFAULT 0,
  max_attempts INT          NOT NULL DEFAULT 3,
  expires_at   TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.expire_otps() RETURNS VOID LANGUAGE sql AS $$
  UPDATE public.otp_verifications
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
$$;

-- ============================================================
-- SECTION 3: COURSE CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.course_categories (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT         NOT NULL UNIQUE,
  slug         TEXT         NOT NULL UNIQUE,
  description  TEXT,
  icon         TEXT,
  color        TEXT,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.course_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SECTION 4: MENTORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mentors (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Professional info
  designation         TEXT,
  qualifications      TEXT         NOT NULL,
  expertise_areas     TEXT[]       DEFAULT '{}',
  years_experience    INT          DEFAULT 0,
  bio                 TEXT,
  linkedin_url        TEXT,
  -- KYC Documents (URLs to Supabase Storage)
  pan_number          TEXT,
  pan_doc_url         TEXT,          -- PAN card image < 1MB
  aadhaar_number      TEXT,
  aadhaar_doc_url     TEXT,          -- Aadhaar image < 1MB
  address_proof_url   TEXT,          -- Address proof < 1MB
  certificates_urls   TEXT[]       DEFAULT '{}',  -- array of cert image URLs < 1MB each
  photo_url           TEXT,
  -- Approval workflow
  approval_status     TEXT         NOT NULL DEFAULT 'pending'
                      CHECK (approval_status IN ('pending','approved','rejected','suspended')),
  approved_by         UUID         REFERENCES auth.users(id),
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  -- Salary & payment
  salary_type         TEXT         DEFAULT 'per_session'
                      CHECK (salary_type IN ('fixed_monthly','per_session','revenue_share')),
  salary_amount       NUMERIC(10,2) DEFAULT 0,
  bank_account_no     TEXT,
  bank_ifsc           TEXT,
  bank_name           TEXT,
  -- Stats (auto-maintained)
  total_students      INT          NOT NULL DEFAULT 0,
  total_sessions      INT          NOT NULL DEFAULT 0,
  avg_rating          NUMERIC(3,2) DEFAULT 0,
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_mentors_updated_at
  BEFORE UPDATE ON public.mentors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- When mentor is approved, update role in user_profiles
CREATE OR REPLACE FUNCTION public.sync_mentor_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.approval_status = 'approved' AND OLD.approval_status != 'approved' THEN
    UPDATE public.user_profiles SET role = 'mentor' WHERE id = NEW.user_id;
  ELSIF NEW.approval_status IN ('rejected','suspended') THEN
    UPDATE public.user_profiles SET role = 'user' WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mentor_role_sync
  AFTER UPDATE OF approval_status ON public.mentors
  FOR EACH ROW EXECUTE FUNCTION public.sync_mentor_role();

-- ============================================================
-- SECTION 5: COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id         UUID         REFERENCES public.course_categories(id),
  category            TEXT         NOT NULL,   -- denormalized for quick reads
  name                TEXT         NOT NULL,
  slug                TEXT         NOT NULL UNIQUE,
  level               TEXT         NOT NULL DEFAULT 'beginner'
                      CHECK (level IN ('beginner','intermediate','advanced')),
  description         TEXT,
  short_description   TEXT,
  -- Pricing
  price               NUMERIC(10,2) NOT NULL DEFAULT 0,
  discounted_price    NUMERIC(10,2),
  discount_percentage INT          GENERATED ALWAYS AS (
    CASE WHEN price > 0 AND discounted_price IS NOT NULL
         THEN ROUND(((price - discounted_price) / price * 100)::NUMERIC, 0)::INT
    ELSE 0 END
  ) STORED,
  -- Duration
  duration_hours      INT,
  duration_months     INT,
  total_sessions      INT          DEFAULT 0,
  -- Mentor assignment (primary mentor)
  mentor_id           UUID         REFERENCES public.mentors(id) ON DELETE SET NULL,
  -- Media
  thumbnail_url       TEXT,
  promo_video_url     TEXT,
  syllabus            JSONB        DEFAULT '[]',  -- [{week, topic, subtopics[]}]
  prerequisites       TEXT[]       DEFAULT '{}',
  tools               TEXT[]       DEFAULT '{}',
  -- EMI
  is_emi_available    BOOLEAN      NOT NULL DEFAULT FALSE,
  min_emi_months      INT          DEFAULT 2,
  max_emi_months      INT          DEFAULT 12,
  -- Visibility
  is_active           BOOLEAN      NOT NULL DEFAULT FALSE,
  is_featured         BOOLEAN      NOT NULL DEFAULT FALSE,
  is_published        BOOLEAN      NOT NULL DEFAULT FALSE,
  published_at        TIMESTAMPTZ,
  -- Stats (auto-maintained by triggers)
  total_enrolled      INT          NOT NULL DEFAULT 0,
  rating              NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews       INT          NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SECTION 6: MENTOR BATCH ALLOCATIONS
-- Links mentors to student batches for a specific course
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mentor_batches (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      UUID         NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  mentor_id      UUID         NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  batch_name     TEXT         NOT NULL,
  batch_code     TEXT         UNIQUE,
  start_date     DATE,
  end_date       DATE,
  schedule       JSONB        DEFAULT '{}',   -- {days:[], time:"10:00", timezone:"Asia/Kolkata"}
  max_students   INT          DEFAULT 30,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  google_meet_link TEXT,
  google_calendar_event_id TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, mentor_id, batch_name)
);

CREATE TRIGGER trg_batches_updated_at
  BEFORE UPDATE ON public.mentor_batches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SECTION 7: COURSE CONTENT (Videos, Docs, Live Sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.course_content (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID         NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title            TEXT         NOT NULL,
  description      TEXT,
  content_type     TEXT         NOT NULL
                   CHECK (content_type IN ('video','document','quiz','assignment','live_session','recording')),
  url              TEXT,
  drive_url        TEXT,        -- Google Drive / YouTube URL
  duration_minutes INT,
  order_index      INT          NOT NULL DEFAULT 0,
  is_free_preview  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  session_date     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_content_updated_at
  BEFORE UPDATE ON public.course_content
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SECTION 8: ENROLLMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.enrollments (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID         NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  course_id             UUID         NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  batch_id              UUID         REFERENCES public.mentor_batches(id),
  payment_type          TEXT         NOT NULL DEFAULT 'full'
                        CHECK (payment_type IN ('full','emi','cash','scholarship')),
  payment_status        TEXT         NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','partial','completed','failed','refunded')),
  enrollment_status     TEXT         NOT NULL DEFAULT 'pending'
                        CHECK (enrollment_status IN ('pending','active','paused','completed','cancelled')),
  total_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  remaining_balance     NUMERIC(10,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  emi_months            INT,
  emi_amount            NUMERIC(10,2),
  next_due_date         DATE,
  access_granted        BOOLEAN      NOT NULL DEFAULT FALSE,
  progress_percentage   INT          NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  completion_date       TIMESTAMPTZ,
  certificate_issued    BOOLEAN      NOT NULL DEFAULT FALSE,
  certificate_url       TEXT,
  admin_notes           TEXT,
  enrolled_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE TRIGGER trg_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update courses.total_enrolled
CREATE OR REPLACE FUNCTION public.sync_course_enrollment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.courses SET total_enrolled = (
      SELECT COUNT(*) FROM public.enrollments
      WHERE course_id = NEW.course_id AND enrollment_status != 'cancelled'
    ) WHERE id = NEW.course_id;
  END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.course_id != NEW.course_id) THEN
    UPDATE public.courses SET total_enrolled = (
      SELECT COUNT(*) FROM public.enrollments
      WHERE course_id = OLD.course_id AND enrollment_status != 'cancelled'
    ) WHERE id = OLD.course_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_enrollment_count
  AFTER INSERT OR UPDATE OR DELETE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.sync_course_enrollment_count();

-- ============================================================
-- SECTION 9: EMI SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emi_schedules (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id        UUID         NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id              UUID         NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  installment_number   INT          NOT NULL,
  due_date             DATE         NOT NULL,
  amount               NUMERIC(10,2) NOT NULL,
  paid_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_date            TIMESTAMPTZ,
  status               TEXT         NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','paid','overdue','waived','partial')),
  late_fee             NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_id           UUID,
  reminder_sent        BOOLEAN      NOT NULL DEFAULT FALSE,
  access_restricted    BOOLEAN      NOT NULL DEFAULT FALSE,
  notes                TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (enrollment_id, installment_number)
);

CREATE TRIGGER trg_emi_updated_at
  BEFORE UPDATE ON public.emi_schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Generate EMI schedule for an enrollment
CREATE OR REPLACE FUNCTION public.generate_emi_schedule(p_enrollment_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_monthly    NUMERIC(10,2);
  v_remaining  NUMERIC(10,2);
  v_amt        NUMERIC(10,2);
  i            INT;
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id;
  IF v_enrollment.emi_months IS NULL OR v_enrollment.emi_months < 1 THEN
    RAISE EXCEPTION 'enrollment % has no EMI months set', p_enrollment_id;
  END IF;

  v_monthly  := ROUND(v_enrollment.total_amount / v_enrollment.emi_months, 2);
  v_remaining := v_enrollment.total_amount;

  FOR i IN 1..v_enrollment.emi_months LOOP
    IF i = v_enrollment.emi_months THEN
      v_amt := v_remaining;  -- last installment absorbs rounding
    ELSE
      v_amt := v_monthly;
      v_remaining := v_remaining - v_monthly;
    END IF;

    INSERT INTO public.emi_schedules (enrollment_id, user_id, installment_number, due_date, amount)
    VALUES (
      p_enrollment_id,
      v_enrollment.user_id,
      i,
      (DATE_TRUNC('month', NOW()) + ((i-1) || ' months')::INTERVAL)::DATE,
      v_amt
    )
    ON CONFLICT (enrollment_id, installment_number) DO NOTHING;
  END LOOP;

  -- Set emi_amount and next_due_date on the enrollment
  UPDATE public.enrollments
  SET emi_amount    = v_monthly,
      next_due_date = (DATE_TRUNC('month', NOW()))::DATE
  WHERE id = p_enrollment_id;
END;
$$;

-- ============================================================
-- SECTION 10: PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID         NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  enrollment_id      UUID         REFERENCES public.enrollments(id) ON DELETE SET NULL,
  emi_schedule_id    UUID         REFERENCES public.emi_schedules(id) ON DELETE SET NULL,
  amount             NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency           TEXT         NOT NULL DEFAULT 'INR',
  payment_method     TEXT         NOT NULL DEFAULT 'online'
                     CHECK (payment_method IN ('upi','card','net_banking','wallet','cash','bank_transfer','emi')),
  payment_gateway    TEXT         DEFAULT 'razorpay'
                     CHECK (payment_gateway IN ('razorpay','stripe','cash','bank','manual')),
  razorpay_order_id  TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  transaction_id     TEXT         UNIQUE,
  status             TEXT         NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','completed','failed','refunded','cancelled')),
  payment_date       TIMESTAMPTZ  DEFAULT NOW(),
  refund_amount      NUMERIC(10,2),
  refund_date        TIMESTAMPTZ,
  refund_reason      TEXT,
  invoice_number     TEXT         UNIQUE DEFAULT 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 6)),
  invoice_url        TEXT,
  notes              TEXT,
  metadata           JSONB        DEFAULT '{}',
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Cascade completed payment to enrollment and EMI
CREATE OR REPLACE FUNCTION public.handle_payment_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Update enrollment paid_amount
    IF NEW.enrollment_id IS NOT NULL THEN
      UPDATE public.enrollments
      SET paid_amount     = paid_amount + NEW.amount,
          payment_status  = CASE
            WHEN (paid_amount + NEW.amount) >= total_amount THEN 'completed'
            ELSE 'partial'
          END,
          access_granted  = TRUE,
          updated_at      = NOW()
      WHERE id = NEW.enrollment_id;
    END IF;

    -- Mark EMI installment as paid
    IF NEW.emi_schedule_id IS NOT NULL THEN
      UPDATE public.emi_schedules
      SET status     = 'paid',
          paid_amount = NEW.amount,
          paid_date   = NOW(),
          payment_id  = NEW.id,
          updated_at  = NOW()
      WHERE id = NEW.emi_schedule_id;

      -- Update next_due_date on enrollment
      UPDATE public.enrollments e
      SET next_due_date = (
        SELECT MIN(due_date) FROM public.emi_schedules
        WHERE enrollment_id = e.id AND status = 'pending'
      )
      WHERE id = (SELECT enrollment_id FROM public.emi_schedules WHERE id = NEW.emi_schedule_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_completed
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_completed();

-- ============================================================
-- SECTION 11: REVIEWS (Course Reviews by Enrolled Students)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id      UUID         NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrollment_id  UUID         REFERENCES public.enrollments(id) ON DELETE SET NULL,
  rating         INT          NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title          TEXT,
  comment        TEXT         NOT NULL,
  is_approved    BOOLEAN      NOT NULL DEFAULT FALSE,
  is_featured    BOOLEAN      NOT NULL DEFAULT FALSE,
  admin_reply    TEXT,
  helpful_count  INT          NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-sync course rating and review count
CREATE OR REPLACE FUNCTION public.sync_course_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_course_id UUID;
BEGIN
  v_course_id := COALESCE(NEW.course_id, OLD.course_id);
  UPDATE public.courses
  SET rating       = COALESCE((SELECT AVG(rating) FROM public.reviews WHERE course_id = v_course_id AND is_approved = TRUE), 0),
      total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE course_id = v_course_id AND is_approved = TRUE),
      updated_at   = NOW()
  WHERE id = v_course_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_course_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_course_rating();

-- ============================================================
-- SECTION 12: FORM SUBMISSIONS
-- Stores registration, feedback, EMI, contact forms
-- ============================================================
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  form_type   TEXT         NOT NULL
              CHECK (form_type IN ('registration','quick_registration','course_registration',
                                   'emi_application','feedback','contact','inquiry',
                                   'mentor_signup','complaint','other')),
  course_id   UUID         REFERENCES public.courses(id) ON DELETE SET NULL,
  form_data   JSONB        NOT NULL DEFAULT '{}',   -- full form field values
  status      TEXT         NOT NULL DEFAULT 'submitted'
              CHECK (status IN ('submitted','reviewed','approved','rejected','processed')),
  ip_address  INET,
  user_agent  TEXT,
  reviewed_by UUID         REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_forms_updated_at
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SECTION 13: CLASS SCHEDULES (Google Calendar Integration)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_schedules (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                UUID         NOT NULL REFERENCES public.mentor_batches(id) ON DELETE CASCADE,
  course_id               UUID         NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  mentor_id               UUID         NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  title                   TEXT         NOT NULL,
  description             TEXT,
  scheduled_at            TIMESTAMPTZ  NOT NULL,
  duration_minutes        INT          NOT NULL DEFAULT 60,
  google_meet_link        TEXT,
  google_calendar_event_id TEXT,
  recording_url           TEXT,
  drive_recording_url     TEXT,
  youtube_url             TEXT,
  status                  TEXT         NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled','ongoing','completed','cancelled','rescheduled')),
  cancellation_reason     TEXT,
  rescheduled_to          TIMESTAMPTZ,
  invites_sent            BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_schedules_updated_at
  BEFORE UPDATE ON public.class_schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SECTION 14: CLASS ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_attendance (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID         NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT         NOT NULL DEFAULT 'absent'
               CHECK (status IN ('present','absent','late','excused')),
  joined_at    TIMESTAMPTZ,
  left_at      TIMESTAMPTZ,
  duration_minutes INT,
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (schedule_id, user_id)
);

-- ============================================================
-- SECTION 15: INQUIRIES / CONTACT
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inquiries (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  name             TEXT         NOT NULL,
  email            TEXT         NOT NULL,
  phone            TEXT,
  course_id        UUID         REFERENCES public.courses(id) ON DELETE SET NULL,
  subject          TEXT         NOT NULL,
  inquiry_details  TEXT         NOT NULL,
  inquiry_type     TEXT         NOT NULL DEFAULT 'general'
                   CHECK (inquiry_type IN ('general','course','payment','technical','admission','complaint','other')),
  status           TEXT         NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','in_progress','resolved','closed')),
  priority         TEXT         NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to      UUID         REFERENCES auth.users(id),
  resolution_notes TEXT,
  source           TEXT         DEFAULT 'website'
                   CHECK (source IN ('website','phone','email','walk_in','referral','social')),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SECTION 16: ADMIN USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id     UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT         NOT NULL DEFAULT 'admin'
              CHECK (role IN ('super_admin','admin','staff','support')),
  permissions JSONB        NOT NULL DEFAULT '{
    "users":    {"view":true,"edit":true,"delete":false},
    "courses":  {"view":true,"edit":true,"delete":false},
    "payments": {"view":true,"edit":false,"delete":false},
    "reports":  {"view":true,"export":false},
    "mentors":  {"view":true,"edit":true,"approve":false},
    "settings": {"view":false,"edit":false}
  }',
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by  UUID         REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_admin_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- When admin is created, update role in user_profiles
CREATE OR REPLACE FUNCTION public.sync_admin_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.user_profiles SET role = NEW.role WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_role_sync
  AFTER INSERT OR UPDATE OF role, is_active ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.sync_admin_role();

-- ============================================================
-- SECTION 17: NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT         NOT NULL DEFAULT 'info'
              CHECK (type IN ('info','success','warning','error','payment','class','enrollment','system')),
  title       TEXT         NOT NULL,
  message     TEXT         NOT NULL,
  action_url  TEXT,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (user_id, is_read) WHERE is_read = FALSE;

-- ============================================================
-- SECTION 18: AUDIT LOGS (Immutable)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT         NOT NULL,
  table_name  TEXT,
  record_id   TEXT,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Disable updates/deletes on audit_logs (append-only)
CREATE OR REPLACE FUNCTION public.protect_audit_logs()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END;
$$;

CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.protect_audit_logs();
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.protect_audit_logs();

-- ============================================================
-- SECTION 19: ANALYTICS VIEWS & REPORTS
-- ============================================================

-- User enrollment count (moved here so enrollments table already exists)
CREATE OR REPLACE VIEW public.v_users_with_enrollment_count AS
  SELECT
    up.*,
    COUNT(e.id) FILTER (WHERE e.enrollment_status != 'cancelled') AS total_courses_enrolled
  FROM public.user_profiles up
  LEFT JOIN public.enrollments e ON e.user_id = up.id
  GROUP BY up.id;

-- Admin dashboard summary
CREATE OR REPLACE VIEW public.v_admin_dashboard AS
SELECT
  (SELECT COUNT(*) FROM public.user_profiles WHERE role = 'user')             AS total_users,
  (SELECT COUNT(*) FROM public.user_profiles WHERE role = 'mentor')           AS total_mentors,
  (SELECT COUNT(*) FROM public.courses WHERE is_active = TRUE)                AS active_courses,
  (SELECT COUNT(*) FROM public.enrollments WHERE enrollment_status = 'active') AS active_enrollments,
  (SELECT COUNT(*) FROM public.enrollments WHERE payment_status = 'pending')  AS pending_payments,
  (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'completed') AS total_revenue,
  (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'completed'
     AND payment_date >= DATE_TRUNC('month', NOW()))                          AS revenue_this_month,
  (SELECT COUNT(*) FROM public.inquiries WHERE status = 'open')               AS open_inquiries,
  (SELECT COUNT(*) FROM public.mentors WHERE approval_status = 'pending')     AS pending_mentor_approvals,
  (SELECT COUNT(*) FROM public.reviews WHERE is_approved = FALSE)             AS pending_reviews,
  NOW()                                                                        AS generated_at;

-- Revenue by course
CREATE OR REPLACE VIEW public.v_revenue_by_course AS
SELECT
  c.id                                                           AS course_id,
  c.name                                                         AS course_name,
  c.category,
  c.total_enrolled,
  COUNT(p.id)                                                    AS total_payments,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS revenue_collected,
  COALESCE(SUM(e.remaining_balance) FILTER (WHERE e.payment_status != 'completed'), 0) AS outstanding_balance,
  COALESCE(AVG(r.rating) FILTER (WHERE r.is_approved), 0)        AS avg_rating,
  COUNT(r.id) FILTER (WHERE r.is_approved)                       AS review_count
FROM public.courses c
LEFT JOIN public.enrollments e  ON e.course_id = c.id
LEFT JOIN public.payments p     ON p.enrollment_id = e.id
LEFT JOIN public.reviews r      ON r.course_id = c.id
GROUP BY c.id, c.name, c.category, c.total_enrolled;

-- Per-user enrollment summary
CREATE OR REPLACE VIEW public.v_user_enrollment_summary AS
SELECT
  up.id                                             AS user_id,
  up.full_name,
  up.email,
  up.phone,
  up.role,
  up.registration_date,
  up.last_login,
  COUNT(e.id)                                       AS total_enrollments,
  COUNT(e.id) FILTER (WHERE e.enrollment_status = 'active')    AS active_enrollments,
  COUNT(e.id) FILTER (WHERE e.enrollment_status = 'completed') AS completed_enrollments,
  COALESCE(SUM(e.total_amount), 0)                  AS total_fee,
  COALESCE(SUM(e.paid_amount), 0)                   AS total_paid,
  COALESCE(SUM(e.remaining_balance), 0)             AS total_outstanding
FROM public.user_profiles up
LEFT JOIN public.enrollments e ON e.user_id = up.id
GROUP BY up.id, up.full_name, up.email, up.phone, up.role, up.registration_date, up.last_login;

-- Revenue by month (for reports page)
CREATE OR REPLACE VIEW public.v_revenue_by_month AS
SELECT
  DATE_TRUNC('month', payment_date)::DATE                          AS month,
  TO_CHAR(DATE_TRUNC('month', payment_date), 'Mon YYYY')           AS month_label,
  COUNT(id)                                                         AS payment_count,
  COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)     AS revenue,
  COUNT(id) FILTER (WHERE payment_method = 'emi')                  AS emi_payments,
  COUNT(id) FILTER (WHERE status = 'failed')                       AS failed_payments
FROM public.payments
GROUP BY DATE_TRUNC('month', payment_date)
ORDER BY month DESC;

-- Mentor performance view
CREATE OR REPLACE VIEW public.v_mentor_performance AS
SELECT
  m.id                                                             AS mentor_id,
  up.full_name                                                     AS mentor_name,
  up.email,
  m.approval_status,
  m.avg_rating,
  COUNT(DISTINCT mb.id)                                            AS total_batches,
  COUNT(DISTINCT e.user_id)                                        AS total_students,
  COUNT(DISTINCT cs.id)                                            AS total_sessions,
  COUNT(DISTINCT cs.id) FILTER (WHERE cs.status = 'completed')    AS completed_sessions
FROM public.mentors m
JOIN public.user_profiles up ON up.id = m.user_id
LEFT JOIN public.mentor_batches mb ON mb.mentor_id = m.id AND mb.is_active = TRUE
LEFT JOIN public.enrollments e ON e.batch_id = mb.id
LEFT JOIN public.class_schedules cs ON cs.mentor_id = m.id
GROUP BY m.id, up.full_name, up.email, m.approval_status, m.avg_rating;

-- ============================================================
-- SECTION 20: ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_batches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_content     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emi_schedules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;

-- Helper: is current session user an admin?
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = TRUE);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role = 'super_admin' AND is_active = TRUE);
$$;

CREATE OR REPLACE FUNCTION public.is_approved_mentor() RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.mentors WHERE user_id = auth.uid() AND approval_status = 'approved' AND is_active = TRUE);
$$;

-- ---- user_profiles ----
CREATE POLICY "users_select_own"    ON public.user_profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "users_update_own"    ON public.user_profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admin_all_users"     ON public.user_profiles FOR ALL USING (public.is_admin());

-- ---- courses: public read for active courses ----
CREATE POLICY "courses_public_read" ON public.courses FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "admin_manage_courses" ON public.courses FOR ALL USING (public.is_admin());

-- ---- course_categories: public read ----
CREATE POLICY "cats_public_read"    ON public.course_categories FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "admin_manage_cats"   ON public.course_categories FOR ALL USING (public.is_admin());

-- ---- course_content ----
CREATE POLICY "content_preview"     ON public.course_content FOR SELECT USING (
  is_free_preview = TRUE OR public.is_admin()
  OR EXISTS (SELECT 1 FROM public.enrollments e
             WHERE e.user_id = auth.uid() AND e.course_id = course_content.course_id
               AND e.enrollment_status = 'active' AND e.access_granted = TRUE)
);
CREATE POLICY "admin_manage_content" ON public.course_content FOR ALL USING (public.is_admin());

-- ---- mentors ----
CREATE POLICY "mentors_public_approved" ON public.mentors FOR SELECT USING (approval_status = 'approved' OR user_id = auth.uid() OR public.is_admin());
CREATE POLICY "mentors_self_update"     ON public.mentors FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "mentors_insert_self"     ON public.mentors FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_manage_mentors"    ON public.mentors FOR ALL USING (public.is_admin());

-- ---- enrollments ----
CREATE POLICY "enroll_own"          ON public.enrollments FOR SELECT USING (user_id = auth.uid() OR public.is_admin() OR public.is_approved_mentor());
CREATE POLICY "enroll_insert_own"   ON public.enrollments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_manage_enroll" ON public.enrollments FOR ALL USING (public.is_admin());

-- ---- emi_schedules ----
CREATE POLICY "emi_own"             ON public.emi_schedules FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "admin_manage_emi"    ON public.emi_schedules FOR ALL USING (public.is_admin());

-- ---- payments ----
CREATE POLICY "pay_own"             ON public.payments FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "pay_insert_own"      ON public.payments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_manage_pay"    ON public.payments FOR ALL USING (public.is_admin());

-- ---- reviews ----
CREATE POLICY "reviews_approved_public" ON public.reviews FOR SELECT USING (is_approved = TRUE OR user_id = auth.uid() OR public.is_admin());
CREATE POLICY "reviews_insert_enrolled" ON public.reviews FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = auth.uid() AND course_id = reviews.course_id AND enrollment_status = 'active')
);
CREATE POLICY "reviews_own_update"  ON public.reviews FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "admin_manage_reviews" ON public.reviews FOR ALL USING (public.is_admin());

-- ---- form_submissions ----
CREATE POLICY "forms_anon_insert"   ON public.form_submissions FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "forms_own_select"    ON public.form_submissions FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "admin_manage_forms"  ON public.form_submissions FOR ALL USING (public.is_admin());

-- ---- class_schedules ----
CREATE POLICY "schedules_enrolled"  ON public.class_schedules FOR SELECT USING (
  public.is_admin() OR public.is_approved_mentor()
  OR EXISTS (SELECT 1 FROM public.enrollments e
             WHERE e.user_id = auth.uid() AND e.batch_id = class_schedules.batch_id
               AND e.enrollment_status = 'active')
);
CREATE POLICY "admin_manage_schedules" ON public.class_schedules FOR ALL USING (public.is_admin());
CREATE POLICY "mentor_manage_schedules" ON public.class_schedules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.mentors WHERE user_id = auth.uid() AND id = class_schedules.mentor_id AND approval_status = 'approved')
);

-- ---- class_attendance ----
CREATE POLICY "attendance_own"      ON public.class_attendance FOR SELECT USING (user_id = auth.uid() OR public.is_admin() OR public.is_approved_mentor());
CREATE POLICY "admin_manage_att"    ON public.class_attendance FOR ALL USING (public.is_admin());
CREATE POLICY "mentor_manage_att"   ON public.class_attendance FOR ALL USING (public.is_approved_mentor());

-- ---- inquiries ----
CREATE POLICY "inquiries_anon_insert" ON public.inquiries FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "inquiries_own"         ON public.inquiries FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "admin_manage_inq"      ON public.inquiries FOR ALL USING (public.is_admin());

-- ---- notifications ----
CREATE POLICY "notif_own"           ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_own_update"    ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "admin_insert_notif"  ON public.notifications FOR INSERT WITH CHECK (public.is_admin());

-- ---- audit_logs ----
CREATE POLICY "audit_admin_read"    ON public.audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "audit_insert_all"    ON public.audit_logs FOR INSERT WITH CHECK (TRUE);

-- ---- admin_users ----
CREATE POLICY "admin_users_self"    ON public.admin_users FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "super_admin_manage"  ON public.admin_users FOR ALL USING (public.is_super_admin());

-- ---- mentor_batches ----
CREATE POLICY "batches_mentor"      ON public.mentor_batches FOR SELECT USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.mentors WHERE user_id = auth.uid() AND id = mentor_batches.mentor_id) OR
  EXISTS (SELECT 1 FROM public.enrollments e WHERE e.user_id = auth.uid() AND e.batch_id = mentor_batches.id)
);
CREATE POLICY "admin_manage_batches" ON public.mentor_batches FOR ALL USING (public.is_admin());
CREATE POLICY "mentor_manage_own_batches" ON public.mentor_batches FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.mentors WHERE user_id = auth.uid() AND id = mentor_batches.mentor_id)
);

-- ============================================================
-- SECTION 21: INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_email     ON public.user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role      ON public.user_profiles (role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone     ON public.user_profiles (phone);
CREATE INDEX IF NOT EXISTS idx_mentors_user_id         ON public.mentors (user_id);
CREATE INDEX IF NOT EXISTS idx_mentors_approval        ON public.mentors (approval_status);
CREATE INDEX IF NOT EXISTS idx_courses_category        ON public.courses (category);
CREATE INDEX IF NOT EXISTS idx_courses_mentor          ON public.courses (mentor_id);
CREATE INDEX IF NOT EXISTS idx_courses_active          ON public.courses (is_active, is_published);
CREATE INDEX IF NOT EXISTS idx_enrollments_user        ON public.enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course      ON public.enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status      ON public.enrollments (enrollment_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_user           ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status         ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_date           ON public.payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_emi_due_date            ON public.emi_schedules (due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reviews_course          ON public.reviews (course_id);
CREATE INDEX IF NOT EXISTS idx_audit_user              ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action            ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_schedules_mentor        ON public.class_schedules (mentor_id);
CREATE INDEX IF NOT EXISTS idx_schedules_batch         ON public.class_schedules (batch_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date          ON public.class_schedules (scheduled_at);

-- ============================================================
-- SECTION 22: RECOMMENDED pg_cron JOBS
-- Enable pg_cron in: Project Settings → Extensions → pg_cron
-- ============================================================
-- SELECT cron.schedule('expire-otps',       '*/5 * * * *', 'SELECT public.expire_otps()');
-- SELECT cron.schedule('mark-overdue-emi',  '30 0 * * *',
--   $$ UPDATE public.emi_schedules SET status = 'overdue', updated_at = NOW()
--      WHERE status = 'pending' AND due_date < CURRENT_DATE; $$);
-- SELECT cron.schedule('restrict-overdue-access', '0 1 * * *',
--   $$ UPDATE public.enrollments SET access_granted = FALSE
--      WHERE id IN (SELECT DISTINCT enrollment_id FROM public.emi_schedules
--                   WHERE status = 'overdue' AND due_date < CURRENT_DATE - 7); $$);

-- ============================================================
-- END OF SCHEMA
-- Run db/admin-setup.sql next to create the super admin user
-- ============================================================
