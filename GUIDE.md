# SkillUpNow — Complete Project Guide

## Architecture Overview

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (no build tools) |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Storage | Supabase Storage (avatars, mentor docs) |
| Payments | Razorpay (checkout.js CDN) |
| Fonts | Google Fonts — Plus Jakarta Sans, Inter |
| Cursor | Neural Pointer (js/neural-cursor.js) |

---

## Directory Structure

```
SKILLUPNOW_website/
├── index.html                  ← Public homepage
├── .env                        ← Credentials (never commit)
├── GUIDE.md                    ← This file
│
├── css/
│   ├── variables.css           ← CSS custom properties (theme tokens)
│   ├── main.css                ← Global styles, nav, footer, components
│   ├── animations.css          ← Keyframe animations
│   ├── forms.css               ← Form field styles
│   └── responsive.css          ← Media queries
│
├── js/
│   ├── profile-nav.js          ← Universal header, footer, cursor & auth modal
│   ├── neural-cursor.js        ← AI-style canvas cursor (injected by profile-nav)
│   ├── theme.js                ← Light/dark theme toggle
│   └── main.js                 ← Homepage-specific logic
│
├── config/
│   └── supabase-config.js      ← SupabaseConfig class (all DB methods)
│
├── pages/
│   ├── courses.html            ← Public course catalog + enrollment modal
│   ├── pamphlet.html           ← Printable course brochure
│   ├── profile.html            ← Student dashboard (learning, payments, EMI)
│   ├── payment.html            ← Payment page + invoice viewer
│   ├── emi-application.html    ← EMI application form
│   ├── feedback.html           ← Course review submission
│   ├── contact-enquiry.html    ← Contact / general enquiry form
│   ├── quick-registration.html ← Quick signup with OTP
│   ├── course-registration.html← Detailed enrollment form
│   ├── mentor-signup.html      ← 4-step mentor application (KYC + docs)
│   ├── mentor-dashboard.html   ← Mentor portal
│   ├── admin-login.html        ← Admin-only login (URL: /pages/admin-login.html)
│   └── admin-dashboard.html    ← Full admin panel
│
└── db/
    ├── schema.sql              ← Complete database schema
    └── admin-setup.sql         ← Super admin creation SQL
```

---

## Step-by-Step Project Setup

### Step 1 — Supabase Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy your **Project URL** and **anon/public key**
3. Update `config/supabase-config.js`:
   ```javascript
   this.SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
   this.SUPABASE_ANON_KEY = 'your-anon-key';
   ```
4. Also update `.env` with the same values

### Step 2 — Run Database Schema
1. Open Supabase → **SQL Editor**
2. Paste and run `db/schema.sql` (full schema with all tables, RLS, triggers, views)
3. Verify tables created: `user_profiles`, `mentors`, `courses`, `enrollments`, `payments`, `emi_schedules`, `reviews`, `form_submissions`, `class_schedules`, `admin_users`, `notifications`, `audit_logs`

### Step 3 — Enable Google OAuth
1. Supabase → **Authentication → Providers → Google**
2. Create a Google OAuth 2.0 credential at [console.cloud.google.com](https://console.cloud.google.com):
   - Authorized redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
3. Paste Client ID and Secret into Supabase
4. Add your site URL to **Authentication → URL Configuration → Redirect URLs**

### Step 4 — Create Super Admin
1. Supabase → **Authentication → Users → Add User**
   - Email: `skillupnow@gmail.com`
   - Password: value from `.env → ADMIN_PASSWORD`
   - ✓ Check **Auto Confirm User**
2. Copy the user's **UUID** from the users list
3. Open `db/admin-setup.sql`, replace `<PASTE_USER_UUID_HERE>` with the real UUID
4. Run the SQL in Supabase SQL Editor
5. Verify: the SELECT at the bottom should return 1 row

### Step 5 — Supabase Storage Buckets
Create two public buckets:
- `avatars` — for user profile photos
- `mentor-docs` — for mentor KYC documents (PAN, Aadhaar, certificates)

Set bucket policies:
```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');
```

### Step 6 — Razorpay Setup
1. Create account at [razorpay.com](https://razorpay.com)
2. Get your **Key ID** from Settings → API Keys
3. Update in `pages/courses.html` and `pages/payment.html`:
   ```javascript
   key: 'rzp_test_YOUR_KEY_ID',
   ```
4. For production use `rzp_live_` keys

### Step 7 — Email Confirmation Setting
Two options in Supabase → **Authentication → Email**:
- **Disabled (recommended for dev)**: Users log in immediately after signup
- **Enabled**: Users receive OTP/magic-link; the auth modal handles OTP verification

---

## Authentication Flow

### Student Login
1. Click **Login** in nav → Modal opens → Choose "Student"
2. Enter email + password (or Google)
3. On success → redirects to `profile.html` (reload)

### Mentor Login  
1. Click **Login** → Modal → Choose "Mentor"
2. Enter credentials → checks `mentors` table
   - `approval_status = 'approved'` → `mentor-dashboard.html`
   - Pending/rejected → shows status message
   - No mentor record → prompts to apply

### Admin Login
- **NOT accessible from the public nav** — by design
- Navigate manually to: `/pages/admin-login.html`
- Enter admin credentials from `.env`
- On success → `admin-dashboard.html`

### Student Signup
1. Click **Sign Up** → Modal → Choose "Student"
2. Fill: First Name, Last Name, Email, Phone, Password, Confirm Password
3. Agree to Terms → Create Account
4. If email confirmation enabled → OTP screen → verify → profile.html
5. If disabled → direct login → profile.html

### Mentor Signup (two-phase)
**Phase 1** (modal):
- Basic info: name, email, phone, expertise, password
- Creates Supabase auth user + user_profiles row
- Redirects to `mentor-signup.html`

**Phase 2** (full application — mentor-signup.html):
- Step 1: Personal info + education
- Step 2: Expertise tags + LinkedIn
- Step 3: Upload photo, PAN card, Aadhaar, address proof, certificates (each < 1MB)
- Step 4: OTP email verification
- Submits → `mentors` table with `approval_status = 'pending'`
- Admin reviews and approves/rejects in admin dashboard

---

## Key Database Tables

| Table | Purpose |
|---|---|
| `user_profiles` | Extended profile for every auth user |
| `mentors` | Mentor KYC, documents, approval status |
| `mentor_batches` | Mentor ↔ student groups per course |
| `courses` | Course catalog with pricing, EMI settings |
| `course_categories` | Course categories |
| `enrollments` | Student ↔ course enrollment records |
| `emi_schedules` | Per-installment EMI payment schedule |
| `payments` | Payment records (Razorpay + manual) |
| `class_schedules` | Google Meet class links & times |
| `class_attendance` | Per-student attendance per class |
| `reviews` | Student course reviews (admin-approved) |
| `form_submissions` | Consolidated: registration/EMI/contact/feedback forms |
| `inquiries` | Contact enquiry tickets |
| `admin_users` | Admin access control |
| `notifications` | In-app notifications |
| `audit_logs` | Immutable action log (append-only) |

### Analytics Views
| View | Purpose |
|---|---|
| `v_admin_dashboard` | Single-row platform summary |
| `v_revenue_by_course` | Revenue breakdown per course |
| `v_revenue_by_month` | Monthly revenue trend |
| `v_mentor_performance` | Mentor rating + student stats |
| `v_user_enrollment_summary` | Per-user enrollment totals |

---

## Adding a New Page

Every page should include this standard boilerplate:
```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title — SkillUpNow</title>
  <link rel="stylesheet" href="../css/variables.css">
  <link rel="stylesheet" href="../css/main.css">
  <link rel="stylesheet" href="../css/responsive.css">
</head>
<body>
<div class="mesh-bg"></div>
<div class="orb orb1"></div>

<!-- Your page content here -->
<div class="page-wrap" style="padding-top:80px">
  <nav></nav>       <!-- profile-nav.js fills this -->
  ...content...
  <footer></footer> <!-- profile-nav.js fills this -->
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../config/supabase-config.js"></script>
<script src="../js/theme.js"></script>
<script src="../js/profile-nav.js"></script>
<!-- page-specific script here -->
</body>
</html>
```

`profile-nav.js` automatically:
- Fills `<nav>` with the full header (logo, links, auth buttons)
- Fills `<footer>` with the canonical footer
- Injects the neural cursor canvas
- Opens the auth modal when Login/Sign Up is clicked
- Shows profile avatar + dropdown when logged in

---

## Role-Based Access

| Role | Access |
|---|---|
| `student` | profile.html, enroll in courses, pay, review |
| `mentor` | mentor-dashboard.html (approved only) |
| `admin` / `super_admin` | admin-dashboard.html (URL-only access) |

RLS (Row Level Security) is enforced at the database level via:
```sql
-- Helper functions in schema.sql
is_admin()           → checks admin_users table
is_approved_mentor() → checks mentors.approval_status = 'approved'
is_super_admin()     → checks admin_users.role = 'super_admin'
```

---

## Razorpay Payment Flow

```
courses.html → Enroll Now → Modal
→ initiatePayment()
  → upsert enrollment (pending)
  → Razorpay.open()
    → on success: insert payment record
    → update enrollment status to 'active'
    → redirect to profile.html?tab=learning
```

EMI payments use the same flow but:
- `payment_type = 'emi'`
- `emi_schedules` rows are created for each installment
- Subsequent EMI payments go through `payment.html?emi=<schedule_id>`

---

## Google Meet Integration

Mentors schedule classes via `admin-dashboard.html` or `mentor-dashboard.html`:
1. Admin/mentor fills: batch, title, date/time, duration, Google Meet link
2. Inserts into `class_schedules`
3. Students see upcoming classes in `profile.html?tab=schedule`
4. Meeting link shown before class start time

---

## Theme System

Light/dark toggle via `js/theme.js`:
```javascript
// Toggle: stored in localStorage
document.documentElement.setAttribute('data-theme', 'dark' | 'light');
```

All colors use CSS custom properties defined in `css/variables.css`:
```css
:root[data-theme="dark"]  { --bg: #06041a; --txt: #f0eeff; ... }
:root[data-theme="light"] { --bg: #f8f7ff; --txt: #12103a; ... }
```

---

## Deployment Checklist

- [ ] Replace test Razorpay key with live key (`rzp_live_...`)
- [ ] Set production Supabase URL + keys
- [ ] Enable Row Level Security on all tables
- [ ] Set `SUPABASE_URL` / `SUPABASE_ANON_KEY` in hosting env vars
- [ ] Add `.env` to `.gitignore`
- [ ] Run `db/schema.sql` on production Supabase
- [ ] Run `db/admin-setup.sql` with production admin UUID
- [ ] Configure Google OAuth redirect URI for production domain
- [ ] Add production domain to Supabase **Redirect URLs**
- [ ] Set `is_active = true` on test courses/mentors before launch
- [ ] Test payment flow end-to-end with a real card in test mode

---

## Common Issues & Fixes

| Issue | Fix |
|---|---|
| Login says "Auth service not ready" | Ensure supabase-config.js loads before profile-nav.js |
| Google OAuth not working | Check redirect URI in Google Console and Supabase Auth settings |
| Profile picture not loading | Check `avatars` bucket is public; verify URL path format |
| Admin link not showing in dropdown | User must be in `admin_users` table with `is_active = true` |
| Mentor link not showing in dropdown | Mentor record must exist with `approval_status = 'approved'` |
| Cursor not visible | neural-cursor.js must be in `js/` directory; check browser console |
| EMI form shows no courses | Set `is_emi_available = true` on courses in admin dashboard |
| Reviews not appearing on course page | Admin must approve reviews (`is_approved = true`) |

---

## Credentials Reference

| Item | Value | Location |
|---|---|---|
| Supabase URL | See `.env` | `.env` |
| Supabase Anon Key | See `.env` | `.env` |
| Admin Email | `skillupnow@gmail.com` | `.env` |
| Admin Password | See `.env` | `.env` |
| Admin Login URL | `/pages/admin-login.html` | URL only — not linked |
| Razorpay Key (test) | Update in payment pages | `pages/courses.html`, `pages/payment.html` |
