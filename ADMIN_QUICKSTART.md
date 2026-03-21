# ==========================================
# ADMIN PANEL QUICK START GUIDE
# ==========================================

## 🚀 Quick Start (5 Minutes)

### Step 1: Execute Database Schema
1. Go to https://app.supabase.com → Select your SkillUpNow project
2. Click **SQL Editor** → **New Query**
3. Copy entire content of `/db/schema.sql`
4. Paste in Supabase editor
5. Click **Run**
6. ✅ All tables created

### Step 2: Grant Admin Access
In the same SQL Editor, run:
```sql
-- Replace USER_UUID with an actual user ID from your users list
INSERT INTO public.admin_users (id, admin_role, permissions, created_at, notes)
VALUES (
  'USER_UUID_HERE',
  'super_admin',
  ARRAY['view_dashboard', 'manage_courses', 'view_users', 'manage_payments', 'manage_emi', 'contact_sales', 'manage_admins'],
  NOW(),
  'Super admin for SkillUpNow'
);
```

**How to find USER_UUID:**
1. Go to **Authentication** → **Users**
2. Copy the **UID** column value
3. Replace `USER_UUID_HERE` in SQL above
4. Run the query

### Step 3: Access Admin Dashboard
1. Login to http://localhost:8000 with the admin user
2. Navigate to `/pages/admin-dashboard.html`
3. ✅ Dashboard loads!

---

## 📊 Admin Dashboard Features

### Dashboard Section
- **Total Users**: Count of all registered users
- **New Enquiries**: Count of uncontacted enquiries  
- **Pending EMI**: Count of pending EMI approvals
- **Total Revenue**: Sum of completed payments

### 📝 Enquiries Management
- View all contact enquiries
- See status: New, Contacted, Converted, Rejected
- Update enquiry status
- See date and student contact info
- Assign to sales team (future feature)

### 💳 EMI Applications
- View all EMI payment plan requests
- See: Student name, course, amount, duration
- Calculate monthly payment (amount ÷ duration)
- **Approve** - Set to approved status
- **Reject** - Set to rejected status
- View application date

### 💰 Payments
- View all payment transactions
- See: Student, course, amount, method, status
- Track transaction IDs
- Verify payment status (pending, completed, failed)

### 👥 Users
- View all registered users
- See: Name, email, phone, registration date
- Check active/inactive status
- View course enrollment count (future)

### ⭐ Feedback
- View student reviews and feedback
- See: Rating (1-5 stars), feedback text
- Track feedback type (review, complaint, suggestion)
- Reply to feedback (send email)

### 📋 Audit Logs
- Track all platform activity
- See: User, action type, entity, timestamp
- Monitor: logins, registrations, enrollments, payments
- Track IP addresses
- Compliance and debugging

---

## 🔑 Admin Roles

### Super Admin
```
Full access to all features
Permissions: view_dashboard, manage_courses, manage_payments, manage_emi, contact_sales, manage_admins
```

### Admin
```
Most features except admin management
Permissions: view_dashboard, manage_courses, manage_payments, manage_emi, contact_sales
```

### Moderator
```
Limited to viewing and support
Permissions: view_dashboard, view_users, contact_sales
```

---

## 📋 Common Tasks

### Task 1: Add New Admin User
```sql
INSERT INTO public.admin_users (id, admin_role, permissions, created_at)
VALUES (
  'new_user_uuid',
  'admin',
  ARRAY['view_dashboard', 'manage_courses', 'view_users', 'manage_payments', 'manage_emi', 'contact_sales'],
  NOW()
);
```

### Task 2: Remove Admin Access
```sql
DELETE FROM public.admin_users WHERE id = 'user_uuid_to_remove';
```

### Task 3: View All Admins
```sql
SELECT id, admin_role, permissions, created_at FROM public.admin_users;
```

### Task 4: Approve EMI Application
In Admin Dashboard:
1. Go to **💳 EMI Applications**
2. Find application
3. Click **Approve** button
4. Status updates to "approved"
5. Notice sent to student (future email feature)

### Task 5: Convert Lead to Customer
In Admin Dashboard:
1. Go to **📝 Enquiries**
2. Find enquiry
3. Click **Update** button
4. Change status to "converted"
5. Follow up tasks added to CRM (future feature)

---

## 🔒 Security Checklist

- [ ] Schema.sql executed (8 tables created)
- [ ] Admin user created with super_admin role
- [ ] Admin can login and access dashboard
- [ ] Admin cannot see other users' data (RLS enforced)
- [ ] All actions logged to audit_logs
- [ ] .env file created with Supabase credentials
- [ ] .env file added to .gitignore
- [ ] No hardcoded credentials in code
- [ ] Admin credentials kept secret
- [ ] 2FA enabled on Supabase account (future)

---

## 🐛 Troubleshooting

### Issue: "Access Denied. Admin privileges required."
**Solution:**
1. Check user UUID: Authentication → Users → copy UID
2. Run query: `SELECT * FROM admin_users WHERE id = 'user_uuid';`
3. If empty, add admin record:
```sql
INSERT INTO public.admin_users (id, admin_role, permissions, created_at)
VALUES ('USER_UUID', 'super_admin', ARRAY['view_dashboard', 'manage_courses', 'view_users', 'manage_payments', 'manage_emi', 'contact_sales', 'manage_admins'], NOW());
```

### Issue: Dashboard shows "No enquiries found"
**Solution:**
1. Check if enquiries exist: `SELECT COUNT(*) FROM contact_enquiries;`
2. If 0 rows, submit test form from `/pages/contact-enquiry.html`
3. Wait 5 seconds
4. Refresh admin dashboard
5. Enquiry should appear

### Issue: "Supabase not initialized" error
**Solution:**
1. Check `/config/supabase-config.js` exists
2. Check admin-dashboard.html includes:
   - `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
   - `<script src="../config/supabase-config.js"></script>`
3. Open browser console (F12)
4. Look for error messages
5. Check .env file has credentials

### Issue: Admin functions don't respond
**Solution:**
1. Open browser console (F12)
2. Check for JavaScript errors
3. Verify internet connection
4. Check Supabase project is active
5. Try logout and login again

---

## 📞 Support Resources

**Supabase Documentation:**
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Authentication: https://supabase.com/docs/guides/auth
- Real-time: https://supabase.com/docs/guides/realtime
- API Reference: https://supabase.com/docs/reference

**Database Schema:**
- See: `/db/schema.sql` - All table definitions
- See: `/db/DATABASE_SETUP.md` - Usage examples
- See: `/db/ADMIN_SETUP.md` - Admin-specific setup

**Dashboard Code:**
- File: `/pages/admin-dashboard.html` - Complete dashboard UI
- Config: `/config/supabase-config.js` - All API methods

---

## 🎯 Next Steps

1. **Execute schema.sql** in Supabase SQL Editor
2. **Grant admin access** to your user account
3. **Test login** with admin user
4. **Access dashboard** at `/pages/admin-dashboard.html`
5. **Submit test data** (course enrollment, enquiry, feedback)
6. **Verify data appears** in dashboard
7. **Test admin functions** (update status, approve EMI, etc.)
8. **Monitor audit logs** to verify actions are tracked
9. **Implement email notifications** (optional future enhancement)
10. **Set up payment gateway** (Razorpay/Stripe integration)

---

## 💡 Tips

✅ **Keep admin credentials safe** - Only share with administrators
✅ **Check audit logs regularly** - Monitor platform activity
✅ **Use strong passwords** - Minimum 12 characters
✅ **Review enquiries daily** - Quick response improves conversions
✅ **Test approval workflows** - Ensure EMI approvals work correctly
✅ **Monitor revenue** - Track total payments in dashboard
✅ **Export reports** - Use Supabase views for analytics
✅ **Backup data** - Supabase handles automatic backups
✅ **Scale with confidence** - PostgreSQL handles millions of records
✅ **Track user behavior** - Audit logs help identify issues

---

Generated: Admin Panel Quick Start
For detailed setup: See `/db/ADMIN_SETUP.md`
