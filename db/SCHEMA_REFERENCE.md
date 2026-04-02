# SkillUpNow — Database Schema Reference

**Platform:** skillupnowadmin.org 
**Database:** Supabase (PostgreSQL 15)
**Files:** `schema.sql` · `seed.sql`

---

## How to Deploy

1. Open the **Supabase Dashboard** → **SQL Editor**
2. Paste and run **`schema.sql`** (creates all tables, indexes, triggers, RLS, functions)
3. In **Authentication → Users**, create your super-admin and test users; copy their UUIDs
4. Update the placeholder UUIDs in **`seed.sql`**, then run it

---

## Entity Relationship Overview

```
auth.users (Supabase managed)
    │
    ├── user_profiles          (1:1)
    ├── otp_verifications      (1:many)
    ├── admin_users            (1:1, optional)
    ├── notifications          (1:many)
    ├── audit_logs             (1:many)
    │
    ├── enrollments            (1:many)
    │       ├── emi_schedules  (1:many)
    │       └── payments       (1:many)
    │
    ├── feedback               (1:many)
    └── inquiries              (1:many)

courses
    ├── course_content         (1:many)
    ├── enrollments            (1:many)
    ├── feedback               (1:many)
    └── inquiries              (1:many)
```

---

## Table Reference

### 1. `user_profiles`
Extends Supabase `auth.users` with platform-specific user data.

| Column               | Type        | Notes                                    |
|----------------------|-------------|------------------------------------------|
| `id`                 | UUID (PK)   | References `auth.users(id)`              |
| `full_name`          | TEXT        | Required                                 |
| `email`              | TEXT        | Unique, mirrors auth.users email         |
| `phone`              | TEXT        |                                          |
| `date_of_birth`      | DATE        |                                          |
| `gender`             | TEXT        | male / female / other / prefer_not_to_say|
| `address`            | TEXT        |                                          |
| `city`               | TEXT        |                                          |
| `state`              | TEXT        |                                          |
| `pincode`            | TEXT        | Validated: 6 digits                      |
| `profile_picture_url`| TEXT        | Supabase Storage URL                     |
| `is_email_verified`  | BOOLEAN     | Default FALSE                            |
| `is_active`          | BOOLEAN     | Default TRUE                             |
| `registration_date`  | TIMESTAMPTZ | Auto-set on insert                       |
| `last_login`         | TIMESTAMPTZ | Updated by app on each login             |

**Trigger:** `trg_user_profiles_updated_at` — sets `updated_at` on every update
**Auto-created:** `trg_on_auth_user_created` inserts a row whenever a new Supabase Auth user signs up

---

### 2. `otp_verifications`
Time-limited one-time passwords for email verification, password reset, and 2FA login.

| Column         | Type        | Notes                                         |
|----------------|-------------|-----------------------------------------------|
| `id`           | UUID (PK)   |                                               |
| `user_id`      | UUID (FK)   | `auth.users` — nullable for pre-signup OTPs   |
| `email`        | TEXT        | Always set                                    |
| `otp_code`     | TEXT        | **Store bcrypt hash only — never plaintext**  |
| `otp_type`     | TEXT        | email_verification / password_reset / login   |
| `status`       | TEXT        | pending / verified / expired                  |
| `attempts`     | INT         | Incremented on each failed attempt            |
| `max_attempts` | INT         | Default 3 — lock after max_attempts failures  |
| `expires_at`   | TIMESTAMPTZ | Default NOW() + 10 minutes                    |
| `verified_at`  | TIMESTAMPTZ | Set when status → verified                    |

**Function:** `expire_otps()` — marks all expired-but-pending OTPs as expired.
Call this at the start of each OTP lookup, or schedule via `pg_cron`:
```sql
SELECT cron.schedule('expire-otps', '*/5 * * * *', 'SELECT public.expire_otps()');
```

---

### 3. `courses`
Master course catalogue managed by admins.

| Column              | Type          | Notes                                          |
|---------------------|---------------|------------------------------------------------|
| `id`                | UUID (PK)     |                                                |
| `name`              | TEXT          | Required                                       |
| `slug`              | TEXT          | Unique URL-friendly identifier                 |
| `level`             | TEXT          | beginner / intermediate / advanced             |
| `category`          | TEXT          | IT / Cloud / Data Science / AI/ML / …          |
| `description`       | TEXT          | Full HTML-safe description                     |
| `short_description` | TEXT          | Used in cards (max ~160 chars)                 |
| `price`             | NUMERIC(10,2) | Full price in INR                              |
| `discounted_price`  | NUMERIC(10,2) | Displayed sale price (nullable)                |
| `duration_hours`    | INT           | Total class hours                              |
| `duration_months`   | INT           | Programme length                               |
| `thumbnail_url`     | TEXT          | Supabase Storage URL                           |
| `syllabus`          | JSONB         | Array of `{week, topic, subtopics[]}`          |
| `prerequisites`     | TEXT[]        | List of prerequisite skills                    |
| `tools`             | TEXT[]        | Software/tools used in the course              |
| `instructor_name`   | TEXT          |                                                |
| `is_emi_available`  | BOOLEAN       | Whether EMI payment is allowed                 |
| `min_emi_months`    | INT           | Minimum EMI tenure                             |
| `max_emi_months`    | INT           | Maximum EMI tenure                             |
| `is_active`         | BOOLEAN       | FALSE = hidden from students                   |
| `is_featured`       | BOOLEAN       | Shown in hero/featured sections                |
| `total_enrolled`    | INT           | Auto-maintained by trigger                     |
| `rating`            | NUMERIC(3,2)  | Auto-maintained by feedback trigger            |
| `total_reviews`     | INT           | Auto-maintained by feedback trigger            |

**Triggers:**
- `trg_enrollment_count` — increments/decrements `total_enrolled` on enrollment insert/delete
- `trg_course_rating` — recalculates `rating` and `total_reviews` when approved feedback changes

---

### 4. `course_content`
Individual pieces of course material (videos, PDFs, quizzes, live sessions).

| Column             | Type | Notes                                                    |
|--------------------|------|----------------------------------------------------------|
| `course_id`        | UUID | FK → courses                                             |
| `title`            | TEXT |                                                          |
| `content_type`     | TEXT | video / document / quiz / assignment / live_session      |
| `url`              | TEXT | Supabase Storage URL or external link                    |
| `duration_minutes` | INT  |                                                          |
| `order_index`      | INT  | Determines display order within course                   |
| `is_free_preview`  | BOOL | Visible without enrollment if TRUE                       |

**RLS:** Only enrolled students (and admins) can access non-preview content.

---

### 5. `enrollments`
Core linking table between users and courses, tracking payment and progress.

| Column               | Type          | Notes                                           |
|----------------------|---------------|-------------------------------------------------|
| `id`                 | UUID (PK)     |                                                 |
| `user_id`            | UUID (FK)     | References auth.users                           |
| `course_id`          | UUID (FK)     | References courses                              |
| `payment_type`       | TEXT          | full / emi                                      |
| `payment_status`     | TEXT          | pending / partial / completed / failed / refunded|
| `total_amount`       | NUMERIC(10,2) | Price at time of enrollment (not course.price)  |
| `paid_amount`        | NUMERIC(10,2) | Running total of confirmed payments             |
| `remaining_balance`  | NUMERIC(10,2) | **Computed column** = total_amount - paid_amount|
| `emi_months`         | INT           | Number of EMI instalments (nullable)            |
| `emi_amount`         | NUMERIC(10,2) | Per-instalment amount (set by generate_emi_schedule)|
| `next_due_date`      | DATE          | Date of next EMI payment due                    |
| `progress_percentage`| INT           | 0–100, updated by app as user completes lessons |
| `completion_date`    | TIMESTAMPTZ   | Set when progress = 100                         |
| `certificate_issued` | BOOLEAN       |                                                 |
| `status`             | TEXT          | active / paused / completed / cancelled         |

**Unique constraint:** `(user_id, course_id)` — one enrollment per user per course
**Function:** `generate_emi_schedule(enrollment_id)` — creates all EMI schedule rows and sets `emi_amount` + `next_due_date`

---

### 6. `emi_schedules`
One row per monthly instalment for EMI-type enrollments.

| Column                | Type          | Notes                                      |
|-----------------------|---------------|--------------------------------------------|
| `enrollment_id`       | UUID (FK)     | References enrollments                     |
| `user_id`             | UUID (FK)     | Denormalised for quick RLS lookups         |
| `installment_number`  | INT           | 1-based sequence                           |
| `due_date`            | DATE          | Expected payment date                      |
| `amount`              | NUMERIC(10,2) | Instalment amount (last may differ ±₹1)   |
| `paid_amount`         | NUMERIC(10,2) | Updated when payment completes             |
| `paid_date`           | TIMESTAMPTZ   |                                            |
| `status`              | TEXT          | pending / paid / overdue / waived          |
| `late_fee`            | NUMERIC(10,2) | Added by admin for overdue instalments     |
| `payment_id`          | UUID (FK)     | References payments — set on payment       |

**Unique constraint:** `(enrollment_id, installment_number)`

---

### 7. `payments`
Financial ledger. One row per payment attempt.

| Column               | Type          | Notes                                          |
|----------------------|---------------|------------------------------------------------|
| `id`                 | UUID (PK)     |                                                |
| `user_id`            | UUID (FK)     | References auth.users (ON DELETE RESTRICT)     |
| `enrollment_id`      | UUID (FK)     | Nullable — supports non-course payments        |
| `emi_schedule_id`    | UUID (FK)     | Nullable — links to specific EMI instalment    |
| `amount`             | NUMERIC(10,2) | Must be > 0                                    |
| `currency`           | TEXT          | Default 'INR'                                  |
| `payment_method`     | TEXT          | upi / card / net_banking / wallet / cash / …   |
| `payment_gateway`    | TEXT          | 'razorpay', 'stripe', etc.                     |
| `transaction_id`     | TEXT (UNIQUE) | Gateway-issued reference number                |
| `status`             | TEXT          | pending / processing / completed / failed / …  |
| `payment_date`       | TIMESTAMPTZ   |                                                |
| `metadata`           | JSONB         | Raw gateway response, webhook data, etc.       |

**Trigger:** `trg_payment_completed` — when status changes to 'completed':
- Adds `amount` to `enrollments.paid_amount`
- Updates `enrollments.payment_status` to 'partial' or 'completed'
- Marks linked `emi_schedules` row as 'paid'

---

### 8. `feedback`
Course reviews submitted by enrolled students.

| Column         | Type | Notes                                                    |
|----------------|------|----------------------------------------------------------|
| `user_id`      | UUID | FK → auth.users                                          |
| `course_id`    | UUID | FK → courses (nullable in case course is later deleted)  |
| `enrollment_id`| UUID | FK → enrollments (optional, for validation)              |
| `rating`       | INT  | 1–5 stars                                                |
| `title`        | TEXT | Short headline                                           |
| `feedback_text`| TEXT | Required review body                                     |
| `is_approved`  | BOOL | Admin must approve before it is publicly visible         |
| `is_featured`  | BOOL | Shown in homepage testimonials                           |
| `admin_reply`  | TEXT | Admin response to the review                             |
| `helpful_count`| INT  | Number of "helpful" votes                                |

**Unique constraint:** `(user_id, course_id)` — one review per user per course
**Trigger:** `trg_course_rating` — recalculates `courses.rating` and `courses.total_reviews` automatically

---

### 9. `inquiries`
Contact form submissions and course enquiries.

| Column            | Type | Notes                                                 |
|-------------------|------|-------------------------------------------------------|
| `user_id`         | UUID | Nullable — anonymous users can enquire                |
| `name`            | TEXT | Required                                              |
| `email`           | TEXT | Required                                              |
| `phone`           | TEXT |                                                       |
| `course_id`       | UUID | Nullable                                              |
| `subject`         | TEXT | Required                                              |
| `inquiry_details` | TEXT | Full message body                                     |
| `inquiry_type`    | TEXT | general / course / payment / technical / admission / other|
| `status`          | TEXT | open / in_progress / resolved / closed                |
| `priority`        | TEXT | low / normal / high / urgent                          |
| `assigned_to`     | UUID | Admin user handling this enquiry                      |
| `resolution_notes`| TEXT | Admin notes on how it was resolved                    |
| `source`          | TEXT | website / phone / email / walk_in / referral          |

---

### 10. `admin_users`
Maps auth users to admin roles. Only entries here can access admin features.

| Column       | Type  | Notes                                                  |
|--------------|-------|--------------------------------------------------------|
| `user_id`    | UUID  | Unique FK → auth.users                                 |
| `role`       | TEXT  | super_admin / admin / staff / support                  |
| `permissions`| JSONB | Granular per-module permissions object                 |
| `is_active`  | BOOL  | Disable without deleting                               |
| `created_by` | UUID  | Which admin created this record                        |

---

### 11. `notifications`
In-app notification centre for users.

| Column     | Type | Notes                                           |
|------------|------|-------------------------------------------------|
| `user_id`  | UUID | FK → auth.users                                 |
| `type`     | TEXT | info / success / warning / error / payment / … |
| `is_read`  | BOOL | Partial index on unread for performance         |
| `action_url`| TEXT| Deep-link for the notification                 |

---

### 12. `audit_logs`
Immutable activity log for security and compliance.

| Column      | Type | Notes                                             |
|-------------|------|---------------------------------------------------|
| `user_id`   | UUID | Who performed the action (nullable for system)    |
| `action`    | TEXT | e.g. 'login', 'enroll', 'payment_complete'        |
| `table_name`| TEXT | Which table was affected                          |
| `record_id` | TEXT | PK of the affected row                            |
| `old_values`| JSONB| Snapshot before change                           |
| `new_values`| JSONB| Snapshot after change                            |
| `ip_address`| INET | Client IP                                         |
| `user_agent`| TEXT | Browser/client info                               |

---

## Row Level Security Summary

| Table              | Anon  | Logged-in User           | Admin         |
|--------------------|-------|--------------------------|---------------|
| user_profiles      | ✗     | Own row only             | All rows      |
| otp_verifications  | ✗     | Own rows only            | All rows      |
| courses            | Read (active only) | Read (active only) | Full |
| course_content     | Free previews only | Enrolled courses | Full |
| enrollments        | ✗     | Own rows only            | All rows      |
| emi_schedules      | ✗     | Own rows only            | All rows      |
| payments           | ✗     | Own rows (select/insert) | Full          |
| feedback           | Read (approved) | Own rows + approved | Full  |
| inquiries          | Insert only | Own rows (select)   | Full          |
| admin_users        | ✗     | ✗                        | Read (super_admin: Full) |
| notifications      | ✗     | Own rows only            | All rows      |
| audit_logs         | ✗     | ✗                        | Read only     |

---

## Key Functions & Triggers

| Function / Trigger                  | Purpose                                          |
|-------------------------------------|--------------------------------------------------|
| `handle_updated_at()`               | Sets `updated_at = NOW()` on every update        |
| `handle_new_user()`                 | Auto-inserts `user_profiles` on auth signup      |
| `expire_otps()`                     | Marks expired OTPs — call via pg_cron            |
| `generate_emi_schedule(uuid)`       | Creates instalment rows for an EMI enrollment    |
| `sync_course_enrollment_count()`    | Keeps `courses.total_enrolled` accurate          |
| `sync_course_rating()`              | Keeps `courses.rating` & `total_reviews` accurate|
| `handle_payment_completed()`        | Cascades completed payment to enrollment + EMI   |
| `is_admin()`                        | Returns TRUE if current session user is admin    |
| `is_super_admin()`                  | Returns TRUE if current session user is super_admin|

---

## Analytics Views

| View                        | Description                               |
|-----------------------------|-------------------------------------------|
| `v_admin_dashboard`         | Single-row summary: users, revenue, open items |
| `v_revenue_by_course`       | Revenue collected per course              |
| `v_user_enrollment_summary` | Per-user: courses enrolled, paid, outstanding |

---

## Recommended pg_cron Jobs

```sql
-- Expire old OTPs every 5 minutes
SELECT cron.schedule('expire-otps', '*/5 * * * *', 'SELECT public.expire_otps()');

-- Mark overdue EMI instalments every morning at 6 AM IST (00:30 UTC)
SELECT cron.schedule('mark-overdue-emi', '30 0 * * *', $$
  UPDATE public.emi_schedules
  SET    status = 'overdue'
  WHERE  status = 'pending'
    AND  due_date < CURRENT_DATE;
$$);
```

> Enable pg_cron in Supabase: **Project Settings → Extensions → pg_cron**

---

## Security Checklist

- [x] All tables have Row Level Security enabled
- [x] Passwords handled entirely by Supabase Auth (bcrypt internally)
- [x] OTP codes stored as **bcrypt hashes** — never plaintext
- [x] OTPs expire after 10 minutes and lock after 3 failed attempts
- [x] Payments use `ON DELETE RESTRICT` on `user_id` — no orphan financial records
- [x] Audit log is insert-only for non-admins
- [x] `is_admin()` / `is_super_admin()` use `SECURITY DEFINER` to prevent bypass
- [ ] **TODO:** Store Supabase keys in environment variables, never in client-side code
- [ ] **TODO:** Enable Supabase **PITR** (Point-in-Time Recovery) for financial data
- [ ] **TODO:** Set up Supabase **Vault** for any secrets/API keys stored in DB
