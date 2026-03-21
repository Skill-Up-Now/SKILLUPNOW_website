# ==========================================
# DATABASE SETUP INSTRUCTIONS
# ==========================================

## Step 1: Set Up Supabase Project

Your Supabase project is already created with the following details:
- **Project URL:** https://kenlnisfhrkgolvxitfc.supabase.co
- **Publishable Key:** sb_publishable_bn3ALAJLmsKePx3V-NsMBw_ADJ-3S3D
- **Database:** PostgreSQL

## Step 2: Initialize Database Schema

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: **SkillUpNow**
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire content from `/db/schema.sql`
6. Paste it in the SQL editor
7. Click **Run** to execute all SQL statements

This will create:
- User profiles table
- Admin users table
- Course registrations table
- Feedback table
- EMI applications table
- Payments table
- Contact enquiries table
- Audit logs table
- Row-level security policies
- Views for analytics
- Indexes for performance

## Step 3: Enable Authentication

1. Go to **Authentication** in Supabase dashboard
2. Click **Providers**
3. Ensure **Email** provider is enabled
4. Configure email templates if needed

## Step 4: Set Up API Credentials

All credentials are already in your `.env` file:
```
VITE_SUPABASE_URL=https://kenlnisfhrkgolvxitfc.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_bn3ALAJLmsKePx3V-NsMBw_ADJ-3S3D
```

**⚠️ SECURITY NOTE:** Never share or expose the database connection string in public code!

## Step 5: Include Supabase Library

Add this script to your HTML files (in `<head>` or before closing `</body>`):

```html
<!-- Supabase JavaScript Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Your Supabase Configuration -->
<script src="config/supabase-config.js"></script>
```

## Step 6: Test Database Connection

Open browser console and run:
```javascript
// Test authentication
const session = await supabaseConfig.getSession();
console.log('Session:', session);

// Test user profile
const user = await supabaseConfig.getCurrentUser();
console.log('Current user:', user);
```

---

## DATABASE SCHEMA OVERVIEW

### 1. **user_profiles** - Extended User Information
```
- id (UUID, PK)
- full_name, email, phone_number
- profile_picture_url, bio
- learning_interest, experience_level
- company_name, job_title
- is_admin, is_active
- account_created_at, last_login_at
```

### 2. **admin_users** - Admin Access Control
```
- id (UUID, PK)
- admin_role (super_admin, admin, moderator)
- permissions (array)
- created_by, created_at
```

### 3. **course_registrations** - Student Enrollments
```
- id (UUID, PK)
- user_id, course_id, course_title
- status (active, completed, dropped, paused)
- progress_percentage, completion_date
- certificate_issued
```

### 4. **feedback** - Student Reviews & Complaints
```
- id (UUID, PK)
- user_id, full_name, email
- feedback_type (general, course, instructor, platform)
- rating (1-5), subject, message
- status (received, reviewed, responded)
- admin_response, responded_by
```

### 5. **emi_applications** - EMI/Installment Plans
```
- id (UUID, PK)
- user_id, course_id, course_title
- preferred_duration (3/6/12 months)
- monthly_amount
- employment_status, company_name, annual_income
- id_type, id_number, document_url
- application_status (pending, approved, rejected)
```

### 6. **payments** - Payment Transactions
```
- id (UUID, PK)
- user_id, course_id, amount
- payment_method (credit_card, debit_card, upi, net_banking, emi)
- transaction_id, order_id
- payment_status (pending, completed, failed, refunded)
- payment_gateway (razorpay, stripe, paypal)
- receipt_url
```

### 7. **contact_enquiries** - Fee & General Enquiries
```
- id (UUID, PK)
- full_name, email, phone_number
- course_interested, budget_range
- learning_experience, current_role
- preferred_payment_method, preferred_start_date
- enquiry_status (new, contacted, converted, rejected)
- assigned_to (admin user)
```

### 8. **audit_logs** - Activity Tracking
```
- id (UUID, PK)
- user_id, action_type, entity_type
- entity_id, old_values, new_values
- ip_address, user_agent, created_at
```

---

## USAGE EXAMPLES

### Register New User
```javascript
const result = await supabaseConfig.signUp('user@example.com', 'password123', {
  full_name: 'John Doe',
  email: 'user@example.com',
  phone_number: '+91 9876543210',
  learning_interest: 'Cloud Computing',
  experience_level: 'intermediate'
});

if (result.success) {
  console.log('✅ Registration successful!');
} else {
  console.error('❌ Error:', result.error);
}
```

### Sign In User
```javascript
const result = await supabaseConfig.signIn('user@example.com', 'password123');

if (result.success) {
  console.log('✅ Logged in successfully!');
  const user = result.data.user;
  console.log('User ID:', user.id);
} else {
  console.error('❌ Error:', result.error);
}
```

### Enroll in Course
```javascript
const userId = (await supabaseConfig.getCurrentUser()).id;

const result = await supabaseConfig.enrollCourse(userId, {
  id: '1',
  title: 'AWS Solutions Architect Pro',
  category: 'cloud',
  level: 'advanced'
});

if (result.success) {
  console.log('✅ Course enrollment successful!');
} else {
  console.error('❌ Error:', result.error);
}
```

### Submit Feedback
```javascript
const result = await supabaseConfig.submitFeedback({
  user_id: userId,
  full_name: 'John Doe',
  email: 'john@example.com',
  phone_number: '+91 9876543210',
  feedback_type: 'course',
  course_id: '1',
  course_title: 'AWS Solutions Architect Pro',
  rating: 5,
  subject: 'Excellent Course!',
  message: 'Great instructor and content. Highly recommended!'
});
```

### Apply for EMI
```javascript
const result = await supabaseConfig.applyForEMI(userId, {
  full_name: 'John Doe',
  email: 'john@example.com',
  phone_number: '+91 9876543210',
  course_id: '1',
  course_title: 'AWS Solutions Architect Pro',
  course_price: 14999,
  preferred_duration: '6_months',
  employment_status: 'employed',
  company_name: 'TechCorp',
  annual_income: 600000,
  id_type: 'aadhar',
  id_number: '1234-5678-9012'
});
```

### Submit Contact Enquiry
```javascript
const result = await supabaseConfig.submitContactEnquiry({
  full_name: 'Jane Doe',
  email: 'jane@example.com',
  phone_number: '+91 9876543210',
  course_interested: 'cloud',
  course_title: 'AWS Solutions Architect Pro',
  program_duration: '3_months',
  learning_experience: '2-5_years',
  current_role: 'Software Engineer',
  company_name: 'StartupXYZ',
  budget_range: '10-20k',
  preferred_payment_method: 'emi',
  preferred_contact_method: 'phone',
  message: 'Interested in your AWS course'
});
```

### Check Admin Access
```javascript
const userId = (await supabaseConfig.getCurrentUser()).id;
const adminCheck = await supabaseConfig.checkAdminAccess(userId);

if (adminCheck.isAdmin) {
  console.log('Admin role:', adminCheck.role);
  console.log('Permissions:', adminCheck.permissions);
} else {
  console.log('User is not an admin');
}
```

---

## SECURITY BEST PRACTICES

1. **Never expose your database connection string** - Use environment variables
2. **Row-level security (RLS) is enabled** - Users can only access their own data
3. **All forms validate data** - Sanitize input before sending to database
4. **Audit logging enabled** - All actions are tracked
5. **Use HTTPS** - Never send credentials over HTTP
6. **Regular backups** - Supabase automatically backs up your database
7. **Admin-only operations** - Certain actions require admin verification

---

## ADMIN PANEL ACCESS

To grant admin access to a user:

1. Go to Supabase SQL Editor
2. Run this query:
```sql
INSERT INTO public.admin_users (id, admin_role, permissions, created_at)
VALUES (
  'USER_ID_HERE', -- Replace with actual user UUID
  'admin',
  ARRAY['view_dashboard', 'manage_courses', 'view_users', 'manage_payments', 'manage_emi', 'contact_sales'],
  NOW()
);
```

---

## TROUBLESHOOTING

### Issue: "Supabase library not loaded"
**Solution:** Make sure you've added the Supabase script tag to your HTML file BEFORE including supabase-config.js

### Issue: "Access denied" on database operations
**Solution:** Check if Row-Level Security (RLS) policies are properly configured. You may need to adjust the RLS policies based on your use case.

### Issue: Authentication not working
**Solution:** Ensure email provider is enabled in Supabase Authentication settings

### Issue: Database queries are slow
**Solution:** Use the indexes that were created. Run this query to check:
```sql
SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan DESC;
```

---

## SUPPORT & RESOURCES

- **Supabase Documentation:** https://supabase.com/docs
- **Supabase Community:** https://github.com/supabase/supabase/discussions
- **Our API Reference:** See config/supabase-config.js for all available methods

