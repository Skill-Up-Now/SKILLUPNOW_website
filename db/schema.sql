-- ==========================================
-- SKILLUPNOW DATABASE SCHEMA
-- ==========================================
-- Execute this SQL in Supabase SQL Editor to create all tables

-- ==========================================
-- 1. USERS TABLE (Extended User Profile)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone_number VARCHAR(20),
  profile_picture_url TEXT,
  bio TEXT,
  learning_interest VARCHAR(255),
  experience_level VARCHAR(50) DEFAULT 'beginner', -- beginner, intermediate, advanced
  company_name VARCHAR(255),
  job_title VARCHAR(255),
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  account_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for email
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_is_admin ON public.user_profiles(is_admin);

-- ==========================================
-- 2. ADMIN USERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_role VARCHAR(50) DEFAULT 'moderator', -- super_admin, admin, moderator
  permissions TEXT[] DEFAULT ARRAY['view_dashboard', 'manage_courses', 'view_users'], -- array of permission strings
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_admin_users_role ON public.admin_users(admin_role);

-- ==========================================
-- 3. COURSE REGISTRATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.course_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id VARCHAR(50) NOT NULL,
  course_title VARCHAR(255) NOT NULL,
  course_category VARCHAR(100),
  course_level VARCHAR(50),
  registration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active', -- active, completed, dropped, paused
  progress_percentage INTEGER DEFAULT 0,
  completion_date TIMESTAMP WITH TIME ZONE,
  certificate_issued BOOLEAN DEFAULT FALSE,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_course_registrations_user_id ON public.course_registrations(user_id);
CREATE INDEX idx_course_registrations_course_id ON public.course_registrations(course_id);
CREATE INDEX idx_course_registrations_status ON public.course_registrations(status);

-- ==========================================
-- 4. FEEDBACK TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name VARCHAR(255),
  email VARCHAR(255),
  phone_number VARCHAR(20),
  feedback_type VARCHAR(100) DEFAULT 'general', -- general, course, instructor, platform
  course_id VARCHAR(50),
  course_title VARCHAR(255),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  subject VARCHAR(255),
  message TEXT NOT NULL,
  attachments TEXT[], -- array of file URLs
  status VARCHAR(50) DEFAULT 'received', -- received, reviewed, responded
  admin_response TEXT,
  responded_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX idx_feedback_status ON public.feedback(status);
CREATE INDEX idx_feedback_submitted_at ON public.feedback(submitted_at);

-- ==========================================
-- 5. EMI APPLICATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.emi_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  course_id VARCHAR(50) NOT NULL,
  course_title VARCHAR(255) NOT NULL,
  course_price DECIMAL(10, 2) NOT NULL,
  preferred_duration VARCHAR(50) DEFAULT '3_months', -- 3_months, 6_months, 12_months
  monthly_amount DECIMAL(10, 2),
  employment_status VARCHAR(100),
  company_name VARCHAR(255),
  annual_income DECIMAL(12, 2),
  id_type VARCHAR(100), -- aadhar, pan, license, passport
  id_number VARCHAR(50),
  document_url TEXT,
  application_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, processing
  approved_by UUID REFERENCES auth.users(id),
  approval_date TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  emi_start_date DATE,
  emi_end_date DATE,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_emi_applications_user_id ON public.emi_applications(user_id);
CREATE INDEX idx_emi_applications_status ON public.emi_applications(application_status);
CREATE INDEX idx_emi_applications_applied_at ON public.emi_applications(applied_at);

-- ==========================================
-- 6. PAYMENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id VARCHAR(50),
  course_title VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  payment_method VARCHAR(100), -- credit_card, debit_card, upi, net_banking, emi
  transaction_id VARCHAR(100) UNIQUE,
  order_id VARCHAR(100),
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, refunded
  payment_gateway VARCHAR(100), -- razorpay, stripe, paypal
  gateway_response JSONB,
  emi_application_id UUID REFERENCES public.emi_applications(id),
  emi_installment_number INTEGER,
  installment_due_date DATE,
  receipt_url TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(payment_status);
CREATE INDEX idx_payments_transaction_id ON public.payments(transaction_id);
CREATE INDEX idx_payments_created_at ON public.payments(created_at);

-- ==========================================
-- 7. CONTACT ENQUIRIES (Fee Enquiry) TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.contact_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  course_interested VARCHAR(100),
  course_title VARCHAR(255),
  program_duration VARCHAR(100),
  learning_experience VARCHAR(100), -- fresher, 1-2_years, 2-5_years, 5plus_years
  "current_role" VARCHAR(255),
  company_name VARCHAR(255),
  budget_range VARCHAR(100), -- 0-10k, 10-20k, 20k+
  preferred_payment_method VARCHAR(100), -- lumpsum, emi, scholarship
  preferred_contact_method VARCHAR(100), -- email, phone, whatsapp
  preferred_start_date DATE,
  message TEXT,
  attachments TEXT[],
  enquiry_status VARCHAR(50) DEFAULT 'new', -- new, contacted, converted, rejected
  assigned_to UUID REFERENCES auth.users(id),
  follow_up_date DATE,
  notes TEXT,
  source VARCHAR(100) DEFAULT 'website', -- website, referral, social_media, email
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contact_enquiries_email ON public.contact_enquiries(email);
CREATE INDEX idx_contact_enquiries_status ON public.contact_enquiries(enquiry_status);
CREATE INDEX idx_contact_enquiries_created_at ON public.contact_enquiries(created_at);

-- ==========================================
-- 8. AUDIT LOG TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action_type VARCHAR(100), -- login, logout, register, form_submit, course_enroll, payment_done
  entity_type VARCHAR(100), -- user, course, payment, emi, feedback
  entity_id VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ==========================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emi_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ROW LEVEL SECURITY POLICIES
-- ==========================================

-- Users can only view/edit their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can view their own enrollments
CREATE POLICY "Users can view own enrollments"
  ON public.course_registrations FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ));

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ));

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON public.feedback FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ));

-- Admin can view all contact enquiries
CREATE POLICY "Admin can view all enquiries"
  ON public.contact_enquiries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ));

-- Admin can view all records
CREATE POLICY "Admin full access"
  ON public.audit_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ));

-- ==========================================
-- CREATE VIEWS FOR REPORTING
-- ==========================================

-- Active Users View
CREATE OR REPLACE VIEW public.active_users_view AS
SELECT 
  up.id,
  up.full_name,
  up.email,
  up.experience_level,
  COUNT(cr.id) as enrolled_courses,
  MAX(up.last_login_at) as last_active
FROM public.user_profiles up
LEFT JOIN public.course_registrations cr ON up.id = cr.user_id
WHERE up.is_active = TRUE
GROUP BY up.id, up.full_name, up.email, up.experience_level;

-- Revenue Summary View
CREATE OR REPLACE VIEW public.revenue_summary_view AS
SELECT 
  DATE(created_at) as payment_date,
  COUNT(*) as total_payments,
  SUM(amount) as total_amount,
  COUNT(DISTINCT user_id) as unique_customers,
  payment_status
FROM public.payments
GROUP BY DATE(created_at), payment_status;

-- Course Enrollment Analytics
CREATE OR REPLACE VIEW public.course_analytics_view AS
SELECT 
  course_id,
  course_title,
  COUNT(*) as total_enrollments,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
  ROUND(100.0 * COUNT(CASE WHEN status = 'completed' THEN 1 END) / COUNT(*), 2) as completion_rate
FROM public.course_registrations
GROUP BY course_id, course_title;

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================

-- Allow authenticated users to read their data
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT ON public.course_registrations TO authenticated;
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT SELECT, INSERT ON public.emi_applications TO authenticated;
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT SELECT, INSERT ON public.contact_enquiries TO authenticated;

-- Allow anon user to insert data (sign-ups, enquiries)
GRANT INSERT ON public.user_profiles TO anon;
GRANT INSERT ON public.contact_enquiries TO anon;
GRANT INSERT ON public.feedback TO anon;

-- ==========================================
-- 9. COURSES TABLE (Admin-managed catalog)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'general', -- cloud, devops, ai, security, data, general
  level VARCHAR(50) NOT NULL DEFAULT 'beginner',    -- beginner, intermediate, advanced
  description TEXT,
  icon VARCHAR(10) DEFAULT '📚',
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  duration VARCHAR(50),       -- e.g. "40 hrs"
  instructor VARCHAR(255),
  badge VARCHAR(50),          -- Bestseller, New Course, Popular, Expert
  students_count INTEGER DEFAULT 0,
  rating DECIMAL(3, 1) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_courses_category ON public.courses(category);
CREATE INDEX idx_courses_level ON public.courses(level);
CREATE INDEX idx_courses_is_active ON public.courses(is_active);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Anyone can view active courses
CREATE POLICY "Anyone can view active courses"
  ON public.courses FOR SELECT
  USING (is_active = TRUE OR EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ));

-- Only admins can insert/update/delete courses
CREATE POLICY "Admins can manage courses"
  ON public.courses FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ));

GRANT SELECT ON public.courses TO anon;
GRANT SELECT ON public.courses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.courses TO authenticated;
