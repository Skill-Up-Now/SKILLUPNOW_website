-- v9-admin-rls-fix.sql
-- Grants admin users permission to DELETE from the payments table
-- and provides an admin_delete_payment RPC as a safe fallback.
-- Run this in Supabase SQL Editor (as a superuser / service-role).

-- ────────────────────────────────────────────────
-- 1. Allow admin to DELETE payments directly
-- ────────────────────────────────────────────────
DROP POLICY IF EXISTS payments_admin_delete ON public.payments;
CREATE POLICY payments_admin_delete
  ON public.payments
  FOR DELETE
  USING (public.is_admin());

-- ────────────────────────────────────────────────
-- 2. Extend existing SELECT policy so admin sees all rows
--    (schema.sql already has payments_own_or_admin for SELECT,
--     this is a no-op if that policy already exists — safe to run)
-- ────────────────────────────────────────────────
DROP POLICY IF EXISTS payments_own_or_admin ON public.payments;
CREATE POLICY payments_own_or_admin
  ON public.payments
  FOR SELECT
  USING (student_user_id = auth.uid() OR public.is_admin());

-- ────────────────────────────────────────────────
-- 3. admin_delete_payment RPC — SECURITY DEFINER fallback
--    used by deletePaymentRecord() in admin-dashboard.html
--    when a direct DELETE is blocked by RLS.
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_payment(target_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;
  DELETE FROM public.payments WHERE id = target_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_payment(uuid) TO authenticated;

-- ────────────────────────────────────────────────
-- 4. Allow admin to UPDATE enrollments (for revokeAccess)
--    (schema.sql may not have an explicit UPDATE policy)
-- ────────────────────────────────────────────────
DROP POLICY IF EXISTS enrollments_admin_update ON public.enrollments;
CREATE POLICY enrollments_admin_update
  ON public.enrollments
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
