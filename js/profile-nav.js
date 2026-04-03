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
    this.injectCursor();
    this.buildDropdown();
    this.injectHamburger(); // always inject on all pages
    this.injectAuthButtons();
    await this.checkUserSession();
    this.setupEventListeners();
    this.setupResponsiveMenu();
  }

  /* ── Inject custom cursor elements into body ── */
  injectCursor() {
    if (document.getElementById('cursor')) return; // already present
    const dot = document.createElement('div');
    dot.id = 'cursor';
    const ring = document.createElement('div');
    ring.id = 'cursor-ring';
    document.body.prepend(ring);
    document.body.prepend(dot);
  }

  /* ── Inject hamburger button into nav ── */
  injectHamburger() {
    const nav = document.querySelector('nav');
    if (!nav || nav.querySelector('.mobile-menu-toggle')) return;

    // Add Home link to nav-links if missing (only on non-home pages)
    if (this.inPages) {
      const navLinks = nav.querySelector('.nav-links');
      if (navLinks && !navLinks.querySelector('.nav-home-link')) {
        const homeLi = document.createElement('li');
        homeLi.innerHTML = `<a href="../index.html" class="nav-home-link">Home</a>`;
        navLinks.insertBefore(homeLi, navLinks.firstChild);
      }
    }

    const btn = document.createElement('button');
    btn.className = 'mobile-menu-toggle';
    btn.setAttribute('aria-label', 'Toggle navigation');
    btn.innerHTML = '<span></span><span></span><span></span>';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const links = nav.querySelector('.nav-links');
      if (!links) return;
      links.classList.toggle('mobile-open');
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

  /* ── Inject combined login button ── */
  injectAuthButtons() {
    const navActions = document.querySelector('nav .nav-actions');
    if (!navActions) return;

    // Single combined Login button with icon
    if (!document.getElementById('login-btn')) {
      const btn = document.createElement('button');
      btn.id = 'login-btn';
      btn.className = 'nav-signin';
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> Login`;
      btn.addEventListener('click', () => {
        if (typeof openModal === 'function') {
          const hasRoleSelect = !!document.getElementById('rs');
          openModal(hasRoleSelect ? 'role-select' : 'login');
        } else {
          window.location.href = (this.inPages ? '../' : '') + 'index.html';
        }
      });
      navActions.appendChild(btn);
    }

    // Get-started / register button with arrow icon
    if (!document.getElementById('cta-btn')) {
      const btn = document.createElement('button');
      btn.id = 'cta-btn';
      btn.className = 'nav-cta';
      btn.innerHTML = `Get Started <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
      btn.addEventListener('click', () => {
        if (typeof openModal === 'function') {
          openModal('register');
        } else {
          window.location.href = (this.inPages ? '../' : '') + 'index.html';
        }
      });
      navActions.appendChild(btn);
    }
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
    const loginBtn = document.getElementById('login-btn');
    const signinBtn = document.getElementById('signin-btn');
    const ctaBtn = document.getElementById('cta-btn');

    if (profileSection) profileSection.style.display = 'flex';
    if (loginBtn) loginBtn.style.display = 'none';
    if (signinBtn) signinBtn.style.display = 'none';
    if (ctaBtn) ctaBtn.style.display = 'none';

    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
      const name = this.currentUser.email?.split('@')[0] || 'User';
      const initial = name.charAt(0).toUpperCase();
      profileBtn.textContent = initial;
      profileBtn.title = `Profile: ${this.currentUser.email}`;
    }

    this.checkAdminStatus();
  }

  showLoggedOutUI() {
    const profileSection = document.getElementById('profile-section');
    const loginBtn = document.getElementById('login-btn');
    const signinBtn = document.getElementById('signin-btn');
    const ctaBtn = document.getElementById('cta-btn');

    if (profileSection) profileSection.style.display = 'none';
    if (loginBtn) loginBtn.style.display = '';
    if (signinBtn) signinBtn.style.display = '';
    if (ctaBtn) {
      ctaBtn.style.display = '';
      ctaBtn.textContent = 'Get Started';
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
    // Click listener is already added in injectHamburger() — do not add again
    // (double listener would toggle mobile-open twice, cancelling out)
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
