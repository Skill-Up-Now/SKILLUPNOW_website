# ==========================================
# ADMIN PANEL & ACCESS CONTROL SETUP
# ==========================================

## Admin Access Architecture

Your SkillUpNow platform uses role-based access control (RBAC) through Supabase. Admins can manage:

- **Enquiries Management** - View and manage contact enquiries
- **Payment Verification** - Approve or review payments
- **EMI Applications** - Approve/reject EMI payment plans
- **Course Registrations** - View student enrollments
- **User Management** - View user profiles
- **Feedback Management** - Respond to student feedback
- **Audit Logs** - Track platform activity

---

## Step 1: Grant Admin Access to a User

### Option A: Via Supabase SQL Console

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your **SkillUpNow** project
3. Go to **SQL Editor**
4. Create a new query and run:

```sql
-- Grant Super Admin Access
INSERT INTO public.admin_users (id, admin_role, permissions, created_at, notes)
VALUES (
  'USER_UUID_HERE',  -- Replace with actual user ID
  'super_admin',
  ARRAY['view_dashboard', 'manage_courses', 'view_users', 'manage_payments', 'manage_emi', 'contact_sales', 'manage_admins'],
  NOW(),
  'Super admin for SkillUpNow platform'
);
```

### Option B: Via SQL - Grant Admin Role

```sql
-- Grant Admin Access (limited permissions)
INSERT INTO public.admin_users (id, admin_role, permissions, created_at)
VALUES (
  'USER_UUID_HERE',
  'admin',
  ARRAY['view_dashboard', 'manage_courses', 'view_users', 'manage_payments', 'manage_emi', 'contact_sales'],
  NOW()
);
```

### Option C: Via SQL - Grant Moderator Role (Limited Access)

```sql
-- Grant Moderator Access (view-only)
INSERT INTO public.admin_users (id, admin_role, permissions, created_at)
VALUES (
  'USER_UUID_HERE',
  'moderator',
  ARRAY['view_dashboard', 'view_users', 'contact_sales'],
  NOW()
);
```

---

## Step 2: Find User UUID

To get a user's UUID:

1. Go to **Authentication** → **Users** in Supabase dashboard
2. Find the user and copy their **UID**
3. Use that UID in the SQL queries above

---

## Step 3: Admin Dashboard Implementation

### Create Admin Dashboard Pages

Create these admin pages for full functionality:

#### `/pages/admin-dashboard.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Admin Dashboard - SkillUpNow</title>
  <link rel="stylesheet" href="../css/main.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="../config/supabase-config.js"></script>
</head>
<body>
  <div class="admin-container">
    <aside class="admin-sidebar">
      <h2>Admin Panel</h2>
      <nav>
        <a href="#dashboard" class="nav-item active">📊 Dashboard</a>
        <a href="#enquiries" class="nav-item">📝 Enquiries</a>
        <a href="#emi-apps" class="nav-item">💳 EMI Applications</a>
        <a href="#payments" class="nav-item">💰 Payments</a>
        <a href="#users" class="nav-item">👥 Users</a>
        <a href="#feedback" class="nav-item">⭐ Feedback</a>
        <a href="#logs" class="nav-item">📋 Audit Logs</a>
      </nav>
    </aside>

    <main class="admin-content">
      <!-- Dashboard will be populated here -->
      <div id="content-area"></div>
    </main>
  </div>

  <script>
    // Admin functionality would be implemented here
    // See example below for enquiries management
  </script>
</body>
</html>
```

---

## Step 4: Example Admin Functions

### View All Contact Enquiries

```javascript
async function loadAdminEnquiries() {
  if (!window.supabaseConfig) return;

  try {
    // First check if user is admin
    const user = await window.supabaseConfig.getCurrentUser();
    const adminCheck = await window.supabaseConfig.checkAdminAccess(user.id);

    if (!adminCheck.isAdmin) {
      alert('Access denied. Admin privileges required.');
      return;
    }

    // Fetch all enquiries
    const result = await window.supabaseConfig.getAllContactEnquiries();

    if (result.success && result.data) {
      console.log('Enquiries:', result.data);
      displayEnquiries(result.data);
    } else {
      console.error('Error fetching enquiries:', result.error);
    }
  } catch (error) {
    console.error('Admin function error:', error);
  }
}

function displayEnquiries(enquiries) {
  const html = enquiries.map(e => `
    <div class="enquiry-card">
      <h4>${e.full_name}</h4>
      <p>Email: ${e.email}</p>
      <p>Phone: ${e.phone_number}</p>
      <p>Course: ${e.course_interested}</p>
      <p>Status: <span class="badge">${e.enquiry_status}</span></p>
      <p>Submitted: ${new Date(e.created_at).toLocaleDateString()}</p>
      <button onclick="assignEnquiry('${e.id}')">Assign to Self</button>
      <button onclick="updateEnquiryStatus('${e.id}', 'contacted')">Mark Contacted</button>
    </div>
  `).join('');

  document.getElementById('enquiries-list').innerHTML = html;
}
```

### Approve EMI Application

```javascript
async function approveEMIApplication(emiId) {
  if (!window.supabaseConfig) return;

  const user = await window.supabaseConfig.getCurrentUser();
  
  try {
    const result = await window.supabaseConfig.updateEMIStatus(
      emiId, 
      'approved', 
      user.id
    );

    if (result.success) {
      alert('✅ EMI application approved!');
      loadEMIApplications(); // Refresh list
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (error) {
    console.error('Error approving EMI:', error);
  }
}
```

### View User Analytics

```javascript
async function loadUserAnalytics() {
  if (!window.supabaseConfig) return;

  try {
    const users = await window.supabaseConfig.getAllUsers();

    if (users.success && users.data) {
      const stats = {
        totalUsers: users.data.length,
        activeUsers: users.data.filter(u => u.is_active).length,
        newUsersThisMonth: users.data.filter(u => {
          const created = new Date(u.account_created_at);
          const now = new Date();
          return created.getMonth() === now.getMonth() && 
                 created.getFullYear() === now.getFullYear();
        }).length
      };

      console.log('User Analytics:', stats);
      return stats;
    }
  } catch (error) {
    console.error('Analytics error:', error);
  }
}
```

---

## Step 5: Admin Roles Explained

### Super Admin
- Full access to all features
- Can create/delete other admins
- Can configure system settings
- **Permissions:** All

### Admin
- Can manage courses, EMI, payments
- Can respond to feedback
- Can view all user data
- **Permissions:** view_dashboard, manage_courses, manage_payments, manage_emi, contact_sales

### Moderator  
- Can view dashboards and users
- Can contact sales inquiries
- **Permissions:** view_dashboard, view_users, contact_sales

---

## Step 6: Security Best Practices

1. **Never share admin credentials** - Use unique passwords
2. **Audit logs are tracked** - All admin actions are logged
3. **RLS policies enforce access** - Users can only see their data
4. **Use strong passwords** - Minimum 12 characters
5. **Enable 2FA** - Use Supabase 2FA if available
6. **Regular backups** - Supabase handles automatic backups
7. **Revoke old admins** - Remove access when staff leaves

---

## Step 7: Remove Admin Access

To remove admin access from a user:

```sql
DELETE FROM public.admin_users 
WHERE id = 'USER_UUID_HERE';

-- Or you can set is_admin = FALSE on user profile
UPDATE public.user_profiles 
SET is_admin = FALSE 
WHERE id = 'USER_UUID_HERE';
```

---

## Troubleshooting Admin Access

### Issue: Admin sees "Access Denied"
**Solution:** Verify admin_users record exists with `SELECT * FROM public.admin_users WHERE id = 'their_uuid';`

### Issue: Admin functions not working
**Solution:** Check RLS policies are correct. Run:
```sql
SELECT * FROM pg_policies WHERE tablename = 'admin_users';
```

### Issue: Can't login to admin panel
**Solution:** Ensure user exists in auth.users table and user_profiles table

---

## Admin Activity Monitoring

View all admin actions in audit logs:

```sql
SELECT 
  user_id, 
  action_type, 
  entity_type, 
  created_at,
  COUNT(*) as count
FROM public.audit_logs
WHERE action_type IN ('login', 'user_update', 'emi_approved', 'payment_verified')
GROUP BY user_id, action_type, entity_type, created_at
ORDER BY created_at DESC;
```

---

## Support

For detailed Supabase documentation on:
- **Authentication:** https://supabase.com/docs/guides/auth
- **Row Level Security:** https://supabase.com/docs/guides/database/postgres/row-level-security
- **Real-time:** https://supabase.com/docs/guides/realtime

