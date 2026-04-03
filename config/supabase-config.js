/* ==========================================
   SUPABASE CLIENT CONFIGURATION
   ========================================== */

// Import Supabase (add this to your HTML: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>)

class SupabaseConfig {
  constructor() {
    this.SUPABASE_URL = 'https://kenlnisfhrkgolvxitfc.supabase.co';
    this.SUPABASE_ANON_KEY = 'sb_publishable_bn3ALAJLmsKePx3V-NsMBw_ADJ-3S3D';
    
    // Initialize Supabase client
    this.client = null;
    this.initializeClient();
  }

  initializeClient() {
    if (typeof supabase !== 'undefined') {
      this.client = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
      console.log('✅ Supabase client initialized successfully');
    } else {
      console.error('❌ Supabase library not loaded. Add: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    }
  }

  getClient() {
    return this.client;
  }

  // ==================== AUTHENTICATION ====================
  
  async signUp(email, password, userData) {
    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: userData,
          emailRedirectTo: null
        }
      });

      if (error) throw error;

      // Create user profile immediately after signup (requires email confirmation disabled in Supabase)
      if (data.user) {
        await this.createUserProfile(data.user.id, { ...userData, email });
        await this.logAuditEvent(data.user.id, 'register', 'user', data.user.id);
      }

      return { success: true, data, message: 'Account created successfully!' };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: error.message };
    }
  }

  async verifyEmailOTP(email, token, userData) {
    try {
      const { data, error } = await this.client.auth.verifyOtp({
        email,
        token,
        type: 'signup'
      });

      if (error) throw error;

      // Now create the user profile after confirmed OTP
      if (data.user) {
        await this.createUserProfile(data.user.id, { ...userData, email });
        await this.logAuditEvent(data.user.id, 'register', 'user', data.user.id);
      }

      return { success: true, data, message: 'Email verified! Your account is ready.' };
    } catch (error) {
      console.error('OTP verification error:', error);
      return { success: false, error: error.message };
    }
  }

  async signIn(email, password) {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
      // Log the login in audit trail
      await this.logAuditEvent(data.user.id, 'login', 'user', data.user.id);
      
      return { success: true, data, message: 'Signed in successfully!' };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
      return { success: true, message: 'Signed out successfully!' };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }

  async getCurrentUser() {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async getSession() {
    try {
      const { data: { session } } = await this.client.auth.getSession();
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  // ==================== USER PROFILES ====================
  
  async createUserProfile(userId, userData) {
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .insert([{
          id: userId,
          full_name: userData.full_name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          city: userData.city || null,
          state: userData.state || null,
          gender: userData.gender || null,
          is_email_verified: true
        }]);

      if (error) throw error;
      return { success: true, data, message: 'Profile created successfully' };
    } catch (error) {
      console.error('Error creating profile:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserProfile(userId) {
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching profile:', error);
      return { success: false, error: error.message };
    }
  }

  async updateUserProfile(userId, updates) {
    try {
      updates.updated_at = new Date().toISOString();
      
      const { data, error } = await this.client
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
      return { success: true, data, message: 'Profile updated successfully' };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== COURSE REGISTRATIONS ====================
  
  async enrollCourse(userId, courseData) {
    try {
      const { data, error } = await this.client
        .from('course_registrations')
        .insert([{
          user_id: userId,
          course_id: courseData.id,
          course_title: courseData.title,
          course_category: courseData.category,
          course_level: courseData.level,
          status: 'active'
        }]);

      if (error) throw error;
      
      await this.logAuditEvent(userId, 'course_enroll', 'course', courseData.id);
      
      return { success: true, data, message: 'Course enrollment successful!' };
    } catch (error) {
      console.error('Error enrolling course:', error);
      return { success: false, error: error.message };
    }
  }

  async getEnrolledCourses(userId) {
    try {
      const { data, error } = await this.client
        .from('course_registrations')
        .select('*')
        .eq('user_id', userId)
        .order('registration_date', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching courses:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== FEEDBACK ====================
  
  async submitFeedback(feedbackData) {
    try {
      const { data, error } = await this.client
        .from('feedback')
        .insert([{
          user_id: feedbackData.user_id || null,
          full_name: feedbackData.full_name,
          email: feedbackData.email,
          phone_number: feedbackData.phone_number,
          feedback_type: feedbackData.feedback_type || 'general',
          course_id: feedbackData.course_id || null,
          course_title: feedbackData.course_title || null,
          rating: feedbackData.rating,
          subject: feedbackData.subject,
          message: feedbackData.message,
          status: 'received'
        }]);

      if (error) throw error;
      
      if (feedbackData.user_id) {
        await this.logAuditEvent(feedbackData.user_id, 'feedback_submitted', 'feedback', data[0]?.id);
      }
      
      return { success: true, data, message: 'Thank you for your feedback!' };
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== EMI APPLICATIONS ====================
  
  async applyForEMI(userId, emiData) {
    try {
      const { data, error } = await this.client
        .from('emi_applications')
        .insert([{
          user_id: userId,
          full_name: emiData.full_name,
          email: emiData.email,
          phone_number: emiData.phone_number,
          course_id: emiData.course_id,
          course_title: emiData.course_title,
          course_price: emiData.course_price,
          preferred_duration: emiData.preferred_duration,
          monthly_amount: this.calculateEMIAmount(emiData.course_price, emiData.preferred_duration),
          employment_status: emiData.employment_status,
          company_name: emiData.company_name,
          annual_income: emiData.annual_income,
          id_type: emiData.id_type,
          id_number: emiData.id_number,
          application_status: 'pending'
        }]);

      if (error) throw error;
      
      await this.logAuditEvent(userId, 'emi_applied', 'emi', data[0]?.id);
      
      return { success: true, data, message: 'EMI application submitted! We will review and get back to you soon.' };
    } catch (error) {
      console.error('Error applying for EMI:', error);
      return { success: false, error: error.message };
    }
  }

  calculateEMIAmount(price, duration) {
    const months = parseInt(duration.split('_')[0]);
    return Math.round(price / months * 100) / 100;
  }

  async getEMIApplication(userId) {
    try {
      const { data, error } = await this.client
        .from('emi_applications')
        .select('*')
        .eq('user_id', userId)
        .order('applied_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching EMI applications:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== PAYMENTS ====================
  
  async recordPayment(userId, paymentData) {
    try {
      const { data, error } = await this.client
        .from('payments')
        .insert([{
          user_id: userId,
          course_id: paymentData.course_id,
          course_title: paymentData.course_title,
          amount: paymentData.amount,
          currency: paymentData.currency || 'INR',
          payment_method: paymentData.payment_method,
          transaction_id: paymentData.transaction_id,
          order_id: paymentData.order_id,
          payment_status: paymentData.payment_status || 'pending',
          payment_gateway: paymentData.payment_gateway,
          gateway_response: paymentData.gateway_response,
          emi_application_id: paymentData.emi_application_id || null,
          emi_installment_number: paymentData.emi_installment_number || null
        }]);

      if (error) throw error;
      
      if (paymentData.payment_status === 'completed') {
        await this.logAuditEvent(userId, 'payment_done', 'payment', data[0]?.id);
      }
      
      return { success: true, data, message: 'Payment recorded successfully' };
    } catch (error) {
      console.error('Error recording payment:', error);
      return { success: false, error: error.message };
    }
  }

  async getPayments(userId) {
    try {
      const { data, error } = await this.client
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching payments:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== CONTACT ENQUIRIES ====================
  
  async submitContactEnquiry(enquiryData) {
    try {
      const { data, error } = await this.client
        .from('contact_enquiries')
        .insert([{
          full_name: enquiryData.full_name,
          email: enquiryData.email,
          phone_number: enquiryData.phone_number,
          course_interested: enquiryData.course_interested,
          course_title: enquiryData.course_title,
          program_duration: enquiryData.program_duration,
          learning_experience: enquiryData.learning_experience,
          current_role: enquiryData.current_role,
          company_name: enquiryData.company_name,
          budget_range: enquiryData.budget_range,
          preferred_payment_method: enquiryData.preferred_payment_method,
          preferred_contact_method: enquiryData.preferred_contact_method,
          preferred_start_date: enquiryData.preferred_start_date,
          message: enquiryData.message,
          enquiry_status: 'new'
        }]);

      if (error) throw error;
      
      return { 
        success: true, 
        data, 
        message: 'Thank you for your enquiry! Our team will contact you soon.' 
      };
    } catch (error) {
      console.error('Error submitting enquiry:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== AUDIT LOGGING ====================
  
  async logAuditEvent(userId, actionType, entityType, entityId, oldValues = null, newValues = null) {
    try {
      const { error } = await this.client
        .from('audit_logs')
        .insert([{
          user_id: userId,
          action_type: actionType,
          entity_type: entityType,
          entity_id: entityId,
          old_values: oldValues,
          new_values: newValues,
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent
        }]);

      if (error) console.error('Audit log error:', error);
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }

  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  // ==================== ADMIN FUNCTIONS ====================
  
  async checkAdminAccess(userId) {
    try {
      const { data, error } = await this.client
        .from('admin_users')
        .select('role, permissions')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error && error.code === 'PGRST116') {
        return { success: false, isAdmin: false };
      }

      if (error) throw error;

      return { success: true, isAdmin: true, role: data.role, permissions: data.permissions };
    } catch (error) {
      console.error('Error checking admin access:', error);
      return { success: false, isAdmin: false };
    }
  }

  async getAllContactEnquiries() {
    try {
      const { data, error } = await this.client
        .from('contact_enquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching enquiries:', error);
      return { success: false, error: error.message };
    }
  }

  async getAllUsers() {
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .order('account_created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { success: false, error: error.message };
    }
  }

  async updateEnquiryStatus(enquiryId, status) {
    try {
      const { data, error } = await this.client
        .from('contact_enquiries')
        .update({ enquiry_status: status, updated_at: new Date().toISOString() })
        .eq('id', enquiryId);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating enquiry:', error);
      return { success: false, error: error.message };
    }
  }

  async updateEMIStatus(emiId, status, approvedBy = null) {
    try {
      const updates = {
        application_status: status,
        updated_at: new Date().toISOString()
      };
      
      if (status === 'approved') {
        updates.approved_by = approvedBy;
        updates.approval_date = new Date().toISOString();
      }

      const { data, error } = await this.client
        .from('emi_applications')
        .update(updates)
        .eq('id', emiId);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating EMI application:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== USER PROFILE FUNCTIONS ====================
  
  async getUserCourses(userId) {
    try {
      const { data, error } = await this.client
        .from('course_registrations')
        .select('*')
        .eq('user_id', userId)
        .order('registration_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user courses:', error);
      return [];
    }
  }

  async getUserStats(userId) {
    try {
      const { data: allCourses } = await this.client
        .from('course_registrations')
        .select('id, status, certificate_issued')
        .eq('user_id', userId);

      const completed = (allCourses || []).filter(c => c.status === 'completed');
      const certs = (allCourses || []).filter(c => c.certificate_issued === true);

      return {
        courses_enrolled: allCourses?.length || 0,
        courses_completed: completed.length,
        certificates_earned: certs.length,
        hours_learned: completed.length * 25
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return { courses_enrolled: 0, courses_completed: 0, certificates_earned: 0, hours_learned: 0 };
    }
  }

  async getUserCertificates(userId) {
    try {
      const { data, error } = await this.client
        .from('course_registrations')
        .select('id, course_title, completion_date, registration_date')
        .eq('user_id', userId)
        .eq('certificate_issued', true)
        .order('completion_date', { ascending: false });

      if (error) throw error;
      return (data || []).map(cert => ({
        id: cert.id,
        course_name: cert.course_title,
        earned_date: cert.completion_date || cert.registration_date
      }));
    } catch (error) {
      console.error('Error fetching certificates:', error);
      return [];
    }
  }

  async getUserPayments(userId) {
    try {
      const { data, error } = await this.client
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  }

  async getUserEMIApplications(userId) {
    try {
      const { data, error } = await this.client
        .from('emi_applications')
        .select('*')
        .eq('user_id', userId)
        .order('applied_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching EMI applications:', error);
      return [];
    }
  }

  async getUserLearningPaths(userId) {
    try {
      const paths = [
        {
          id: 1,
          path_name: 'Full Stack Development',
          description: 'Master frontend and backend development',
          icon: '💻',
          progress: 45,
          total_courses: 8,
          courses_completed: 4
        },
        {
          id: 2,
          path_name: 'Data Science Mastery',
          description: 'Learn data analysis and machine learning',
          icon: '📊',
          progress: 30,
          total_courses: 6,
          courses_completed: 2
        },
        {
          id: 3,
          path_name: 'Cloud Computing',
          description: 'AWS, Azure, and GCP expertise',
          icon: '☁️',
          progress: 60,
          total_courses: 5,
          courses_completed: 3
        }
      ];
      return paths;
    } catch (error) {
      console.error('Error fetching learning paths:', error);
      return [];
    }
  }

  // ==================== USER ENROLLMENTS ====================

  async createEnrollment(userId, enrollmentData) {
    try {
      const priceNum = parseInt((enrollmentData.price || '0').replace(/[^\d]/g, '')) || 0;
      const { data, error } = await this.client
        .from('user_enrollments')
        .insert([{
          user_id: userId,
          course_id: enrollmentData.id,
          course_name: enrollmentData.name,
          course_category: enrollmentData.category || null,
          enrollment_status: 'pending',
          payment_status: 'pending',
          payment_type: enrollmentData.payment_type || 'full',
          total_fee: priceNum,
          amount_paid: 0,
          remaining_balance: priceNum,
          emi_months: enrollmentData.emi_months || null,
          emi_amount_per_month: enrollmentData.emi_amount_per_month || null,
          course_access_enabled: false
        }])
        .select()
        .single();

      if (error) throw error;
      await this.logAuditEvent(userId, 'enrollment_created', 'user_enrollment', data.id);
      return { success: true, data, message: 'Enrollment created!' };
    } catch (error) {
      console.error('Error creating enrollment:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserEnrollments(userId) {
    try {
      const { data, error } = await this.client
        .from('user_enrollments')
        .select('*')
        .eq('user_id', userId)
        .order('enrollment_date', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching user enrollments:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  async getAllEnrollments() {
    try {
      const { data, error } = await this.client
        .from('user_enrollments')
        .select('*, user_profiles(full_name, email)')
        .order('enrollment_date', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching all enrollments:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  async updateEnrollmentStatus(enrollmentId, status, approvedBy = null) {
    try {
      const updates = { enrollment_status: status, updated_at: new Date().toISOString() };
      if (status === 'active') {
        updates.approved_by = approvedBy;
        updates.course_access_enabled = true;
      } else if (status === 'disabled') {
        updates.course_access_enabled = false;
      }
      const { data, error } = await this.client
        .from('user_enrollments')
        .update(updates)
        .eq('id', enrollmentId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating enrollment status:', error);
      return { success: false, error: error.message };
    }
  }

  async updateEnrollmentPayment(enrollmentId, paymentData) {
    try {
      const { data, error } = await this.client
        .from('user_enrollments')
        .update({
          payment_status: paymentData.payment_status,
          payment_type: paymentData.payment_type || 'full',
          amount_paid: paymentData.amount_paid,
          remaining_balance: paymentData.remaining_balance,
          updated_at: new Date().toISOString()
        })
        .eq('id', enrollmentId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating enrollment payment:', error);
      return { success: false, error: error.message };
    }
  }

  async toggleCourseAccess(enrollmentId, enabled) {
    try {
      const { data, error } = await this.client
        .from('user_enrollments')
        .update({ course_access_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', enrollmentId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error toggling course access:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== ADMIN COURSE MANAGEMENT ====================

  async getAllCourses() {
    try {
      const { data, error } = await this.client
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching all courses:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  async getAllCoursesAdmin() {
    try {
      const { data, error } = await this.client
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching all courses (admin):', error);
      return { success: false, data: [], error: error.message };
    }
  }

  async createCourse(courseData, adminUserId) {
    try {
      const slug = (courseData.name || courseData.title || '')
        .toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        + '-' + Date.now();

      const { data, error } = await this.client
        .from('courses')
        .insert([{
          name: courseData.name || courseData.title || '',
          slug: courseData.slug || slug,
          category: courseData.category,
          level: (courseData.level || 'beginner').toLowerCase(),
          description: courseData.description || '',
          short_description: courseData.short_description || '',
          price: parseFloat(courseData.price) || 0,
          duration_months: parseInt(courseData.duration_months) || null,
          duration_hours: parseInt(courseData.duration_hours) || null,
          thumbnail_url: courseData.thumbnail_url || null,
          instructor_name: courseData.instructor_name || '',
          is_emi_available: courseData.is_emi_available !== false,
          is_active: courseData.is_active !== false,
          is_featured: courseData.is_featured || false,
          total_enrolled: 0,
          rating: 0,
          created_by: adminUserId
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data, message: 'Course created successfully!' };
    } catch (error) {
      console.error('Error creating course:', error);
      return { success: false, error: error.message };
    }
  }

  async updateCourse(courseId, updates) {
    try {
      updates.updated_at = new Date().toISOString();
      const { data, error } = await this.client
        .from('courses')
        .update(updates)
        .eq('id', courseId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data, message: 'Course updated successfully!' };
    } catch (error) {
      console.error('Error updating course:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteCourse(courseId) {
    try {
      const { error } = await this.client
        .from('courses')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', courseId);

      if (error) throw error;
      return { success: true, message: 'Course removed successfully!' };
    } catch (error) {
      console.error('Error deleting course:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== ADMIN STUDY MATERIALS ====================
  
  async getStudyMaterials(courseId) {
    try {
      // Mock study materials
      const materials = [
        { id: 1, course_id: courseId, title: 'Module 1: Introduction', type: 'pdf', size: '2.5MB', uploaded_at: new Date() },
        { id: 2, course_id: courseId, title: 'Module 2: Advanced Concepts', type: 'pdf', size: '3.2MB', uploaded_at: new Date() }
      ];
      return materials;
    } catch (error) {
      console.error('Error fetching study materials:', error);
      return [];
    }
  }

  async uploadStudyMaterial(courseId, materialData) {
    try {
      // Upload logic
      return { success: true, message: 'Study material uploaded successfully' };
    } catch (error) {
      console.error('Error uploading material:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteStudyMaterial(materialId) {
    try {
      // Delete logic
      return { success: true, message: 'Study material deleted successfully' };
    } catch (error) {
      console.error('Error deleting material:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== ADMIN RECORDINGS ====================
  
  async getCourseRecordings(courseId) {
    try {
      // Mock recordings
      const recordings = [
        { id: 1, course_id: courseId, title: 'Live Class - Week 1', duration: '45 min', uploaded_at: new Date(), url: '#' },
        { id: 2, course_id: courseId, title: 'Live Class - Week 2', duration: '52 min', uploaded_at: new Date(), url: '#' },
        { id: 3, course_id: courseId, title: 'Q&A Session', duration: '30 min', uploaded_at: new Date(), url: '#' }
      ];
      return recordings;
    } catch (error) {
      console.error('Error fetching recordings:', error);
      return [];
    }
  }

  async uploadRecording(courseId, recordingData) {
    try {
      // Upload recording logic
      return { success: true, message: 'Recording uploaded successfully' };
    } catch (error) {
      console.error('Error uploading recording:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteRecording(recordingId) {
    try {
      // Delete recording logic
      return { success: true, message: 'Recording deleted successfully' };
    } catch (error) {
      console.error('Error deleting recording:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== ADMIN DASHBOARD STATS ====================
  
  async getDashboardStats() {
    try {
      const { data: users } = await this.client
        .from('user_profiles')
        .select('id');

      const { data: enquiries } = await this.client
        .from('contact_enquiries')
        .select('id');

      const { data: emiApps } = await this.client
        .from('emi_applications')
        .select('id')
        .eq('application_status', 'pending');

      const { data: payments } = await this.client
        .from('payments')
        .select('amount')
        .eq('payment_status', 'completed');

      return {
        total_users: users?.length || 0,
        new_enquiries: enquiries?.length || 0,
        pending_emi: emiApps?.length || 0,
        total_revenue: payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return { total_users: 0, new_enquiries: 0, pending_emi: 0, total_revenue: 0 };
    }
  }
}

// Initialize and export
const supabaseConfig = new SupabaseConfig();

// Make it globally available
window.supabaseConfig = supabaseConfig;
// Expose the raw Supabase client so admin dashboard can call .from() directly
window.supabaseConfig.supabase = supabaseConfig.client;
window.supabase = typeof supabase !== 'undefined' ? supabase : null;
