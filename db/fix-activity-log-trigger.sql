-- ============================================================
-- SKILLUPNOW ACTIVITY LOG TRIGGER FIX
-- Fixes "record old has no field user_id" for tables like courses
-- that have `id` but do not have a `user_id` column.
-- Run this in Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_row_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entity_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_entity_id := COALESCE(to_jsonb(OLD)->>'id', to_jsonb(OLD)->>'user_id');
  ELSE
    v_entity_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'user_id');
  END IF;

  INSERT INTO public.activity_logs (
    actor_user_id, actor_type, entity_type, entity_id, action_name, old_values, new_values
  ) VALUES (
    auth.uid(),
    COALESCE(public.current_actor_type(), 'system'),
    TG_TABLE_NAME,
    v_entity_id,
    LOWER(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
