-- ============================================================
-- SKILLUPNOW AUTH HARDENING HELPERS
-- Optional post-schema script for housekeeping / security tasks.
-- ============================================================

-- Expire stale signup email OTPs.
UPDATE public.signup_email_otps
SET consumed_at = NOW()
WHERE consumed_at IS NULL
  AND expires_at < NOW();

-- Expire stale admin login OTPs.
UPDATE public.admin_login_otp_challenges
SET consumed_at = NOW()
WHERE consumed_at IS NULL
  AND expires_at < NOW();

-- Expire stale SMS OTPs.
UPDATE public.sms_verification_requests
SET consumed_at = NOW()
WHERE consumed_at IS NULL
  AND expires_at < NOW();

-- Restrict overdue enrollments after grace period.
UPDATE public.enrollments e
SET access_status = 'restricted',
    updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM public.payment_schedules ps
  JOIN public.course_access_policies cap ON cap.course_id = e.course_id
  WHERE ps.enrollment_id = e.id
    AND ps.is_access_blocking = TRUE
    AND ps.schedule_status = 'overdue'
    AND ps.due_at < NOW() - make_interval(days => cap.grace_days_after_due)
);

-- Revoke expired video sessions.
UPDATE public.video_access_sessions
SET revoked_at = COALESCE(revoked_at, NOW()),
    revocation_reason = COALESCE(revocation_reason, 'Expired playback session')
WHERE revoked_at IS NULL
  AND expires_at < NOW();

-- Suggested pg_cron jobs:
-- SELECT cron.schedule('sun-expire-signup-otps', '*/5 * * * *',
--   $$ UPDATE public.signup_email_otps
--      SET consumed_at = NOW()
--      WHERE consumed_at IS NULL AND expires_at < NOW(); $$);
--
-- SELECT cron.schedule('sun-expire-admin-otps', '*/5 * * * *',
--   $$ UPDATE public.admin_login_otp_challenges
--      SET consumed_at = NOW()
--      WHERE consumed_at IS NULL AND expires_at < NOW(); $$);
--
-- SELECT cron.schedule('sun-restrict-overdue-access', '15 * * * *',
--   $$ UPDATE public.enrollments e
--      SET access_status = 'restricted', updated_at = NOW()
--      WHERE EXISTS (
--        SELECT 1
--        FROM public.payment_schedules ps
--        JOIN public.course_access_policies cap ON cap.course_id = e.course_id
--        WHERE ps.enrollment_id = e.id
--          AND ps.is_access_blocking = TRUE
--          AND ps.schedule_status = 'overdue'
--          AND ps.due_at < NOW() - make_interval(days => cap.grace_days_after_due)
--      ); $$);
