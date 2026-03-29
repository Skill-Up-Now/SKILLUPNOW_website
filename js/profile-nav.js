/* ==========================================
   PROFILE NAVIGATION - Global Handler
   ========================================== */

class ProfileNavigationManager {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  async init() {
    await this.checkUserSession();
    this.setupEventListeners();
    this.setupResponsiveMenu();
  }

  async checkUserSession() {
    try {
      if (!window.supabaseConfig) return;

      const user = await window.supabaseConfig.getCurrentUser();
      if (user) {
        this.currentUser = user;
        this.showLoggedInUI();
      } else {
        this.showLoggedOutUI();
      }
    } catch (error) {
      console.error('Session check error:', error);
      this.showLoggedOutUI();
    }
  }

  showLoggedInUI() {
    const profileSection = document.getElementById('profile-section');
    const signInBtn = document.getElementById('signin-btn');
    const ctaBtn = document.getElementById('cta-btn');

    // Show profile section only
    if (profileSection) profileSection.style.display = 'flex';

    // Hide both auth buttons completely
    if (signInBtn) signInBtn.style.display = 'none';
    if (ctaBtn) ctaBtn.style.display = 'none';

    // Update profile button with user initial
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
      const name = this.currentUser.email?.split('@')[0] || 'User';
      const initial = name.charAt(0).toUpperCase();
      profileBtn.textContent = initial;
      profileBtn.title = `Profile: ${this.currentUser.email}`;
    }

    // Check if admin
    this.checkAdminStatus();
  }

  showLoggedOutUI() {
    const profileSection = document.getElementById('profile-section');
    const signInBtn = document.getElementById('signin-btn');
    const ctaBtn = document.getElementById('cta-btn');

    // Hide profile section
    if (profileSection) profileSection.style.display = 'none';

    // Show both auth buttons
    if (signInBtn) signInBtn.style.display = '';
    if (ctaBtn) {
      ctaBtn.style.display = '';
      ctaBtn.textContent = 'Get Started';
      ctaBtn.onclick = () => openModal?.('register');
    }
  }

  checkAdminStatus() {
    try {
      if (!window.supabaseConfig || !this.currentUser) return;

      window.supabaseConfig.isAdmin(this.currentUser.id).then(isAdmin => {
        if (isAdmin) {
          const adminLink = document.getElementById('dd-admin-link');
          if (adminLink) adminLink.style.display = 'flex';
        }
      });
    } catch (error) {
      console.error('Admin check error:', error);
    }
  }

  setupEventListeners() {
    const profileBtn = document.getElementById('profile-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const profileSection = document.getElementById('profile-section');
    let hideTimeout;

    if (profileBtn) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleProfileDropdown();
      });
    }

    // Hover behavior: show on mouseenter, hide with delay on mouseleave
    if (profileSection) {
      profileSection.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        profileDropdown?.classList.add('active');
      });
      profileSection.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => profileDropdown?.classList.remove('active'), 200);
      });
    }

    if (profileDropdown) {
      profileDropdown.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
      profileDropdown.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => profileDropdown.classList.remove('active'), 200);
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (profileDropdown && !profileDropdown.contains(e.target) && !profileBtn?.contains(e.target)) {
        profileDropdown.classList.remove('active');
      }
    });
  }

  toggleProfileDropdown() {
    const dropdown = document.getElementById('profile-dropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('active');
  }

  setupResponsiveMenu() {
    const mobileMenu = document.querySelector('.mobile-menu-toggle');
    if (mobileMenu) {
      mobileMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
          navLinks.classList.toggle('active');
        }
      });
    }
  }

  async logout() {
    try {
      const result = await window.supabaseConfig.signOut();
      if (result.success) {
        this.currentUser = null;
        this.showLoggedOutUI();
        window.location.href = 'index.html';
      }
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = 'index.html';
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.profileNav = new ProfileNavigationManager();
});
