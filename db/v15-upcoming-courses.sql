-- v15: Upcoming Courses Feature
-- Adds is_upcoming flag to courses table
-- Run in Supabase SQL Editor

-- Add is_upcoming column to courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_upcoming BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast lookup of upcoming courses on the public page
CREATE INDEX IF NOT EXISTS idx_courses_upcoming
  ON public.courses (is_upcoming, course_status, visibility)
  WHERE is_upcoming = TRUE;

-- Comment
COMMENT ON COLUMN public.courses.is_upcoming IS
  'When TRUE the course is shown in the Upcoming Courses section on courses.html — visible but NOT enrollable';
