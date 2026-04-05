-- ============================================================
-- SKILLUPNOW — SUPABASE DATABASE SCHEMA
-- Platform: skillupnowadmin.org 
-- Run this entire file in Supabase SQL Editor (one migration)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- HELPER: auto-update updated_at on every write
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ============================================================
-- 1. USER PROFILES
--    Extends Supabase auth.users (one-to-one)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT        NOT NULL,
  email               TEXT        UNIQUE NOT NULL,
  phone               TEXT,
  date_of_birth       DATE,
  gender              TEXT        CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  address             TEXT,
  city                TEXT,
  state               TEXT,
  pincode             TEXT        CHECK (pincode ~ '^\d{6}$'),
  profile_picture_url TEXT,
  is_email_verified   BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  registration_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email  ON public.user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone  ON public.user_profiles (phone);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON public.user_profiles (is_active);


-- ============================================================
-- 2. OTP VERIFICATIONS
--    Time-limited one-time passwords for email/login flows
-- ============================================================
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  otp_code     TEXT        NOT NULL,                          -- store bcrypt hash, never plaintext
  otp_type     TEXT        NOT NULL CHECK (otp_type IN ('email_verification','password_reset','login')),
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','verified','expired')),
  attempts     INT         NOT NULL DEFAULT 0,
  max_attempts INT         NOT NULL DEFAULT 3,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes — critical for expiry-based lookups
CREATE INDEX IF NOT EXISTS idx_otp_email      ON public.otp_verifications (email);
CREATE INDEX IF NOT EXISTS idx_otp_user       ON public.otp_verifications (user_id);
CREATE INDEX IF NOT EXISTS idx_otp_expires    ON public.otp_verifications (expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_status     ON public.otp_verifications (status);

-- Auto-expire OTPs: mark as expired when expires_at has passed
CREATE OR REPLACE FUNCTION public.expire_otps()
RETURNS VOID LANGUAGE sql AS $$
  UPDATE public.otp_verifications
  SET    status = 'expired'
  WHERE  status = 'pending'
    AND  expires_at < NOW();
$$;
-- Call expire_otps() from a pg_cron job or at the start of each OTP lookup.


-- ============================================================
-- 3. COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT         NOT NULL,
  slug              TEXT         UNIQUE NOT NULL,
  level             TEXT         NOT NULL CHECK (level IN ('beginner','intermediate','advanced')),
  category          TEXT         NOT NULL CHECK (category IN (
                                   'IT','Cloud','Data Science','AI/ML',
                                   'Web Development','Cyber Security',
                                   'DevOps','Networking','Database','Other')),
  description       TEXT,
  short_description TEXT,
  key_topics        TEXT[],       -- Array of key topics covered
  learning_outcomes TEXT[],       -- Array of what students will achieve
  career_opportunities TEXT[],    -- Array of career paths unlocked
  price             NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  discounted_price  NUMERIC(10,2)           CHECK (discounted_price >= 0),
  duration_hours    INT,
  duration_months   INT,
  thumbnail_url     TEXT,
  syllabus          JSONB        NOT NULL DEFAULT '[]',       -- [{week, topic, subtopics[]}]
  prerequisites     TEXT[]       NOT NULL DEFAULT '{}',
  tools             TEXT[]       NOT NULL DEFAULT '{}',
  instructor_name   TEXT,
  instructor_bio    TEXT,
  is_emi_available  BOOLEAN      NOT NULL DEFAULT TRUE,
  min_emi_months    INT          NOT NULL DEFAULT 3  CHECK (min_emi_months >= 1),
  max_emi_months    INT          NOT NULL DEFAULT 12 CHECK (max_emi_months >= min_emi_months),
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  is_featured       BOOLEAN      NOT NULL DEFAULT FALSE,
  total_enrolled    INT          NOT NULL DEFAULT 0 CHECK (total_enrolled >= 0),
  rating            NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  total_reviews     INT          NOT NULL DEFAULT 0 CHECK (total_reviews >= 0),
  created_by        UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_courses_category    ON public.courses (category);
CREATE INDEX IF NOT EXISTS idx_courses_level       ON public.courses (level);
CREATE INDEX IF NOT EXISTS idx_courses_active      ON public.courses (is_active);
CREATE INDEX IF NOT EXISTS idx_courses_featured    ON public.courses (is_featured);
CREATE INDEX IF NOT EXISTS idx_courses_price       ON public.courses (price);
CREATE INDEX IF NOT EXISTS idx_courses_rating      ON public.courses (rating DESC);

-- Full-text search index on course name + description
CREATE INDEX IF NOT EXISTS idx_courses_search ON public.courses
  USING GIN (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(short_description,'')));


-- ============================================================
-- 4. COURSE REGISTRATIONS (Legacy)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.course_registrations (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id           TEXT         NOT NULL,
  course_title        TEXT         NOT NULL,
  course_category     TEXT,
  course_level        TEXT,
  registration_date   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  materials_given     BOOLEAN      NOT NULL DEFAULT FALSE,
  progress_percentage INT          NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  status              TEXT         NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active','completed','paused','cancelled')),
  amount              NUMERIC(10,2),
  payment_type        TEXT         CHECK (payment_type IN ('full','emi')),
  notes               TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_course_registrations_updated_at
  BEFORE UPDATE ON public.course_registrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_registrations_user   ON public.course_registrations (user_id);
CREATE INDEX IF NOT EXISTS idx_course_registrations_course ON public.course_registrations (course_id);
CREATE INDEX IF NOT EXISTS idx_course_registrations_status ON public.course_registrations (status);


-- ============================================================
-- 4. COURSE CONTENT (Recordings, Videos, Documents)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.course_content (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id        UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  content_type     TEXT        NOT NULL CHECK (content_type IN (
                                 'video','document','quiz','assignment','live_session')),
  description      TEXT,
  url              TEXT,
  duration_minutes INT         CHECK (duration_minutes >= 0),
  order_index      INT         NOT NULL DEFAULT 0,
  is_free_preview  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_course_content_updated_at
  BEFORE UPDATE ON public.course_content
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_course_content_course ON public.course_content (course_id, order_index);


-- ============================================================
-- 5. ENROLLMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.enrollments (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id           UUID         NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  enrollment_date     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  payment_type        TEXT         NOT NULL CHECK (payment_type IN ('full','emi')),
  payment_status      TEXT         NOT NULL DEFAULT 'pending'
                                   CHECK (payment_status IN ('pending','partial','completed','failed','refunded')),
  total_amount        NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  paid_amount         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining_balance   NUMERIC(10,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  emi_months          INT           CHECK (emi_months >= 1),
  emi_amount          NUMERIC(10,2) CHECK (emi_amount >= 0),
  next_due_date       DATE,
  progress_percentage INT           NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  completion_date     TIMESTAMPTZ,
  certificate_issued  BOOLEAN       NOT NULL DEFAULT FALSE,
  certificate_url     TEXT,
  status              TEXT          NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active','paused','completed','cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE TRIGGER trg_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_user          ON public.enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course        ON public.enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status        ON public.enrollments (status);
CREATE INDEX IF NOT EXISTS idx_enrollments_payment_status ON public.enrollments (payment_status);
CREATE INDEX IF NOT EXISTS idx_enrollments_due_date      ON public.enrollments (next_due_date);

-- Auto-increment courses.total_enrolled
CREATE OR REPLACE FUNCTION public.sync_course_enrollment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.courses SET total_enrolled = total_enrolled + 1 WHERE id = NEW.course_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.courses SET total_enrolled = GREATEST(total_enrolled - 1, 0) WHERE id = OLD.course_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_enrollment_count
  AFTER INSERT OR DELETE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.sync_course_enrollment_count();


-- ============================================================
-- 6. EMI SCHEDULES
--    One row per installment for each emi-based enrollment
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emi_schedules (
  id                   UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id        UUID         NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id              UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installment_number   INT          NOT NULL CHECK (installment_number >= 1),
  due_date             DATE         NOT NULL,
  amount               NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_amount          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  paid_date            TIMESTAMPTZ,
  status               TEXT         NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','paid','overdue','waived')),
  late_fee             NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (late_fee >= 0),
  payment_id           UUID,                                  -- FK added after payments table
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (enrollment_id, installment_number)
);

CREATE TRIGGER trg_emi_schedules_updated_at
  BEFORE UPDATE ON public.emi_schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_emi_enrollment ON public.emi_schedules (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_emi_user       ON public.emi_schedules (user_id);
CREATE INDEX IF NOT EXISTS idx_emi_due_date   ON public.emi_schedules (due_date);
CREATE INDEX IF NOT EXISTS idx_emi_status     ON public.emi_schedules (status);


-- ============================================================
-- 7. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                 UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID         NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  enrollment_id      UUID         REFERENCES public.enrollments(id) ON DELETE SET NULL,
  emi_schedule_id    UUID         REFERENCES public.emi_schedules(id) ON DELETE SET NULL,
  amount             NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency           TEXT         NOT NULL DEFAULT 'INR',
  payment_method     TEXT         NOT NULL CHECK (payment_method IN (
                                    'upi','card','net_banking','wallet',
                                    'cash','bank_transfer','cheque')),
  payment_gateway    TEXT,                                    -- 'razorpay', 'stripe', etc.
  transaction_id     TEXT         UNIQUE,                    -- gateway-issued txn reference
  gateway_order_id   TEXT,
  gateway_payment_id TEXT,
  status             TEXT         NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','processing','completed','failed','refunded','cancelled')),
  payment_date       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  description        TEXT,
  receipt_url        TEXT,
  metadata           JSONB        NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_user        ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_enrollment  ON public.payments (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status      ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_date        ON public.payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON public.payments (transaction_id);

-- Back-fill FK from emi_schedules → payments (deferred until payments table existed)
ALTER TABLE public.emi_schedules
  ADD CONSTRAINT fk_emi_payment
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

-- When a payment completes, update enrollment paid_amount + emi row
CREATE OR REPLACE FUNCTION public.handle_payment_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Update enrollment paid_amount
    IF NEW.enrollment_id IS NOT NULL THEN
      UPDATE public.enrollments
      SET    paid_amount = paid_amount + NEW.amount,
             payment_status = CASE
               WHEN (paid_amount + NEW.amount) >= total_amount THEN 'completed'
               ELSE 'partial'
             END
      WHERE  id = NEW.enrollment_id;
    END IF;
    -- Mark linked EMI instalment as paid
    IF NEW.emi_schedule_id IS NOT NULL THEN
      UPDATE public.emi_schedules
      SET    status      = 'paid',
             paid_amount = NEW.amount,
             paid_date   = NOW()
      WHERE  id = NEW.emi_schedule_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_completed
  AFTER UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_completed();


-- ============================================================
-- 8. FEEDBACK / REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id     UUID         REFERENCES public.courses(id) ON DELETE SET NULL,
  enrollment_id UUID         REFERENCES public.enrollments(id) ON DELETE SET NULL,
  rating        INT          NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title         TEXT,
  feedback_text TEXT         NOT NULL,
  is_approved   BOOLEAN      NOT NULL DEFAULT FALSE,
  is_featured   BOOLEAN      NOT NULL DEFAULT FALSE,
  admin_reply   TEXT,
  helpful_count INT          NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE TRIGGER trg_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_feedback_course   ON public.feedback (course_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user     ON public.feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_approved ON public.feedback (is_approved);
CREATE INDEX IF NOT EXISTS idx_feedback_rating   ON public.feedback (rating);

-- Recalculate courses.rating and total_reviews after every feedback change
CREATE OR REPLACE FUNCTION public.sync_course_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_course_id UUID;
BEGIN
  v_course_id := COALESCE(NEW.course_id, OLD.course_id);
  IF v_course_id IS NOT NULL THEN
    UPDATE public.courses
    SET    rating        = COALESCE((SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM public.feedback WHERE course_id = v_course_id AND is_approved = TRUE), 0),
           total_reviews = (SELECT COUNT(*) FROM public.feedback WHERE course_id = v_course_id AND is_approved = TRUE)
    WHERE  id = v_course_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_course_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.sync_course_rating();


-- ============================================================
-- 9. INQUIRIES / CONTACT ENQUIRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inquiries (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  name             TEXT         NOT NULL,
  email            TEXT         NOT NULL,
  phone            TEXT,
  course_id        UUID         REFERENCES public.courses(id) ON DELETE SET NULL,
  subject          TEXT         NOT NULL,
  inquiry_details  TEXT         NOT NULL,
  inquiry_type     TEXT         NOT NULL DEFAULT 'general'
                                CHECK (inquiry_type IN ('general','course','payment','technical','admission','other')),
  status           TEXT         NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open','in_progress','resolved','closed')),
  priority         TEXT         NOT NULL DEFAULT 'normal'
                                CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to      UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolved_at      TIMESTAMPTZ,
  source           TEXT         NOT NULL DEFAULT 'website'
                                CHECK (source IN ('website','phone','email','walk_in','referral')),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_inquiries_user     ON public.inquiries (user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status   ON public.inquiries (status);
CREATE INDEX IF NOT EXISTS idx_inquiries_priority ON public.inquiries (priority);
CREATE INDEX IF NOT EXISTS idx_inquiries_email    ON public.inquiries (email);
CREATE INDEX IF NOT EXISTS idx_inquiries_created  ON public.inquiries (created_at DESC);


-- ============================================================
-- 10. ADMIN USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'staff'
                          CHECK (role IN ('super_admin','admin','staff','support')),
  permissions JSONB       NOT NULL DEFAULT '{
    "users":    {"view":true,"edit":false,"delete":false},
    "courses":  {"view":true,"edit":false,"delete":false},
    "payments": {"view":true,"edit":false,"delete":false},
    "reports":  {"view":true}
  }',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_admin_users_role   ON public.admin_users (role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users (is_active);


-- ============================================================
-- 11. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT         NOT NULL,
  message    TEXT         NOT NULL,
  type       TEXT         NOT NULL DEFAULT 'info'
                          CHECK (type IN ('info','success','warning','error','payment','course','admin')),
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON public.notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications (created_at DESC);


-- ============================================================
-- 12. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,  -- 'login', 'enroll', 'payment', 'update_profile', etc.
  table_name  TEXT,
  record_id   TEXT,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user    ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs (created_at DESC);


-- ============================================================
-- HELPER FUNCTION: is the current session user an admin?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE  user_id   = auth.uid()
      AND  is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE  user_id   = auth.uid()
      AND  role      = 'super_admin'
      AND  is_active = TRUE
  );
$$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_content    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emi_schedules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;

-- ── user_profiles ──────────────────────────────────────────
CREATE POLICY "users: own profile" ON public.user_profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "admin: all profiles" ON public.user_profiles
  FOR ALL USING (public.is_admin());

-- ── otp_verifications ──────────────────────────────────────
CREATE POLICY "users: own otps" ON public.otp_verifications
  FOR ALL USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "admin: all otps" ON public.otp_verifications
  FOR ALL USING (public.is_admin());

-- ── courses: public read, admin write ──────────────────────
CREATE POLICY "public: read active courses" ON public.courses
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "admin: manage courses" ON public.courses
  FOR ALL USING (public.is_admin());

-- ── course_content ─────────────────────────────────────────
CREATE POLICY "enrolled: read content" ON public.course_content
  FOR SELECT USING (
    is_free_preview = TRUE
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE  e.course_id = course_content.course_id
        AND  e.user_id   = auth.uid()
        AND  e.status    = 'active'
    )
  );

CREATE POLICY "admin: manage content" ON public.course_content
  FOR ALL USING (public.is_admin());

-- ── enrollments ────────────────────────────────────────────
CREATE POLICY "users: own enrollments" ON public.enrollments
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "admin: all enrollments" ON public.enrollments
  FOR ALL USING (public.is_admin());

-- ── emi_schedules ──────────────────────────────────────────
CREATE POLICY "users: own emi" ON public.emi_schedules
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "admin: all emi" ON public.emi_schedules
  FOR ALL USING (public.is_admin());

-- ── payments ───────────────────────────────────────────────
CREATE POLICY "users: own payments" ON public.payments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users: insert own payment" ON public.payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin: all payments" ON public.payments
  FOR ALL USING (public.is_admin());

-- ── feedback ───────────────────────────────────────────────
CREATE POLICY "public: read approved feedback" ON public.feedback
  FOR SELECT USING (is_approved = TRUE);

CREATE POLICY "users: own feedback" ON public.feedback
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "admin: all feedback" ON public.feedback
  FOR ALL USING (public.is_admin());

-- ── inquiries ──────────────────────────────────────────────
CREATE POLICY "public: insert inquiry" ON public.inquiries
  FOR INSERT WITH CHECK (TRUE);   -- anyone can submit

CREATE POLICY "users: own inquiries" ON public.inquiries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admin: all inquiries" ON public.inquiries
  FOR ALL USING (public.is_admin());

-- ── admin_users ────────────────────────────────────────────
CREATE POLICY "admin: read admin list" ON public.admin_users
  FOR SELECT USING (public.is_admin());

CREATE POLICY "super_admin: manage admins" ON public.admin_users
  FOR ALL USING (public.is_super_admin());

-- ── notifications ──────────────────────────────────────────
CREATE POLICY "users: own notifications" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "admin: all notifications" ON public.notifications
  FOR ALL USING (public.is_admin());

-- ── audit_logs ─────────────────────────────────────────────
CREATE POLICY "admin: read audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "service: insert audit" ON public.audit_logs
  FOR INSERT WITH CHECK (TRUE);


-- ============================================================
-- UTILITY FUNCTION: generate EMI schedule rows
-- Usage: SELECT public.generate_emi_schedule('<enrollment_id>');
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_emi_schedule(p_enrollment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec          public.enrollments%ROWTYPE;
  installment  NUMERIC(10,2);
  i            INT;
BEGIN
  SELECT * INTO rec FROM public.enrollments WHERE id = p_enrollment_id;
  IF rec.payment_type <> 'emi' THEN
    RAISE EXCEPTION 'Enrollment % is not an EMI type', p_enrollment_id;
  END IF;
  installment := ROUND(rec.total_amount / rec.emi_months, 2);
  FOR i IN 1..rec.emi_months LOOP
    INSERT INTO public.emi_schedules
      (enrollment_id, user_id, installment_number, due_date, amount)
    VALUES
      (rec.id, rec.user_id, i,
       (rec.enrollment_date::DATE + (i * INTERVAL '1 month'))::DATE,
       CASE WHEN i = rec.emi_months
            THEN rec.total_amount - (installment * (rec.emi_months - 1)) -- absorb rounding
            ELSE installment
       END)
    ON CONFLICT (enrollment_id, installment_number) DO NOTHING;
  END LOOP;
  UPDATE public.enrollments
  SET    emi_amount    = installment,
         next_due_date = (enrollment_date::DATE + INTERVAL '1 month')::DATE
  WHERE  id = p_enrollment_id;
END;
$$;


-- ============================================================
-- ANALYTICS VIEWS (read-only, no extra tables needed)
-- ============================================================

-- Dashboard summary for admin
CREATE OR REPLACE VIEW public.v_admin_dashboard AS
SELECT
  (SELECT COUNT(*) FROM public.user_profiles WHERE is_active = TRUE)           AS total_users,
  (SELECT COUNT(*) FROM public.courses       WHERE is_active = TRUE)           AS total_courses,
  (SELECT COUNT(*) FROM public.enrollments   WHERE status = 'active')          AS active_enrollments,
  (SELECT COALESCE(SUM(amount),0) FROM public.payments WHERE status='completed') AS total_revenue,
  (SELECT COUNT(*) FROM public.inquiries     WHERE status = 'open')            AS open_inquiries,
  (SELECT COUNT(*) FROM public.feedback      WHERE is_approved = FALSE)        AS pending_reviews,
  (SELECT COUNT(*) FROM public.emi_schedules WHERE status = 'overdue')         AS overdue_emis;

-- Revenue by course
CREATE OR REPLACE VIEW public.v_revenue_by_course AS
SELECT
  c.id,
  c.name,
  c.category,
  COUNT(DISTINCT e.id)            AS enrollments,
  COALESCE(SUM(p.amount), 0)      AS total_collected
FROM public.courses     c
LEFT JOIN public.enrollments e ON e.course_id = c.id
LEFT JOIN public.payments    p ON p.enrollment_id = e.id AND p.status = 'completed'
GROUP BY c.id, c.name, c.category;

-- User enrollment summary
CREATE OR REPLACE VIEW public.v_user_enrollment_summary AS
SELECT
  u.id,
  up.full_name,
  up.email,
  COUNT(e.id)                        AS courses_enrolled,
  COALESCE(SUM(e.paid_amount), 0)    AS total_paid,
  COALESCE(SUM(e.remaining_balance),0) AS total_outstanding
FROM auth.users          u
JOIN  public.user_profiles up ON up.id = u.id
LEFT JOIN public.enrollments e  ON e.user_id = u.id
GROUP BY u.id, up.full_name, up.email;


-- ============================================================
-- AUTO-CREATE user_profile on new Supabase auth signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- DONE
-- All tables, indexes, constraints, triggers, RLS policies,
-- utility functions, and analytics views are created.
-- ============================================================
