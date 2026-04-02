/* ==========================================
   PROFILE NAVIGATION - Global Handler
   ========================================== */

class ProfileNavigationManager {
  constructor() {
    this.currentUser = null;
    this.inPages = window.location.pathname.replace(/\\/g, '/').includes('/pages/');
    this.base = this.inPages ? '' : 'pages/';
    this.init();
  }

  async init() {
    this.buildDropdown();
    if (this.inPages) {
      this.injectHamburger();
      this.injectBreadcrumb();
    }
    await this.checkUserSession();
    this.setupEventListeners();
    this.setupResponsiveMenu();
  }

  /* ── Inject hamburger button into nav ── */
  injectHamburger() {
    const nav = document.querySelector('nav');
    if (!nav || nav.querySelector('.mobile-menu-toggle')) return;
    const btn = document.createElement('button');
    btn.className = 'mobile-menu-toggle';
    btn.setAttribute('aria-label', 'Toggle navigation');
    btn.innerHTML = '<span></span><span></span><span></span>';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const navLinks = nav.querySelector('.nav-links');
      if (!navLinks) return;
      navLinks.classList.toggle('mobile-open');
      btn.classList.toggle('open');
    });
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) {
        nav.querySelector('.nav-links')?.classList.remove('mobile-open');
        btn.classList.remove('open');
      }
    });
    const navActions = nav.querySelector('.nav-actions');
    if (navActions) navActions.appendChild(btn);
    else nav.appendChild(btn);
  }

  /* ── Inject animated breadcrumb below nav ── */
  injectBreadcrumb() {
    if (document.getElementById('breadcrumb-bar')) return;
    const title = document.title || '';
    const pageLabel = document.body.dataset.breadcrumb
      || title.split('—')[0].split('-')[0].split('|')[0].trim().replace(/SkillUpNow/i, '').trim();
    if (!pageLabel) return;

    const bc = document.createElement('nav');
    bc.id = 'breadcrumb-bar';
    bc.className = 'breadcrumb-bar';
    bc.setAttribute('aria-label', 'Breadcrumb');
    bc.innerHTML = `
      <a href="../index.html" class="bc-item bc-home">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Home
      </a>
      <span class="bc-sep" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </span>
      <span class="bc-item bc-current" aria-current="page">${pageLabel}</span>`;

    const nav = document.querySelector('nav');
    if (nav) nav.after(bc);
  }

  /* Build standardized dropdown HTML — consistent across all pages */
  buildDropdown() {
    const dropdown = document.getElementById('profile-dropdown');
    if (!dropdown) return;
    const b = this.base;
    dropdown.innerHTML = `
      <a href="${b}profile.html?edit=1" style="display:flex;align-items:center;gap:0.8rem;padding:1rem;text-decoration:none;color:var(--txt2);border-bottom:1px solid var(--border);transition:all 0.25s;" onmouseover="this.style.background='rgba(124,92,252,0.08)'" onmouseout="this.style.background=''">
        <span style="font-size:1.2rem;">✏️</span>
        <div>
          <div style="font-weight:600;color:var(--txt);">Edit Profile</div>
          <div style="font-size:0.75rem;color:var(--txt4);">Update your info</div>
        </div>
      </a>
      <a href="${b}profile.html#learning-paths" style="display:flex;align-items:center;gap:0.8rem;padding:1rem;text-decoration:none;color:var(--txt2);border-bottom:1px solid var(--border);transition:all 0.25s;" onmouseover="this.style.background='rgba(124,92,252,0.08)'" onmouseout="this.style.background=''">
        <span style="font-size:1.2rem;">🗺️</span>
        <div>
          <div style="font-weight:600;color:var(--txt);">My Learning Path</div>
          <div style="font-size:0.75rem;color:var(--txt4);">Track your journey</div>
        </div>
      </a>
      <a id="dd-admin-link" href="${b}admin-dashboard.html" style="display:none;align-items:center;gap:0.8rem;padding:1rem;text-decoration:none;color:var(--txt2);border-bottom:1px solid var(--border);transition:all 0.25s;" onmouseover="this.style.background='rgba(124,92,252,0.08)'" onmouseout="this.style.background=''">
        <span style="font-size:1.2rem;">⚙️</span>
        <div>
          <div style="font-weight:600;color:var(--txt);">Admin Panel</div>
          <div style="font-size:0.75rem;color:var(--txt4);">Manage platform</div>
        </div>
      </a>
      <button onclick="window.profileNav && window.profileNav.logout()" style="width:100%;text-align:left;padding:1rem;border:none;background:transparent;color:var(--txt2);cursor:pointer;display:flex;align-items:center;gap:0.8rem;transition:all 0.25s;" onmouseover="this.style.background='rgba(255,107,107,0.08)'" onmouseout="this.style.background=''">
        <span style="font-size:1.2rem;">🚪</span>
        <div>
          <div style="font-weight:600;color:#ff6b6b;">Logout</div>
          <div style="font-size:0.75rem;color:var(--txt4);">Sign out safely</div>
        </div>
      </button>
    `;
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

      window.supabaseConfig.checkAdminAccess(this.currentUser.id).then(result => {
        if (result && result.isAdmin) {
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
      if (window.supabaseConfig) await window.supabaseConfig.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    sessionStorage.clear();
    const inPages = window.location.pathname.includes('/pages/');
    window.location.href = inPages ? '../index.html' : 'index.html';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.profileNav = new ProfileNavigationManager();
});
