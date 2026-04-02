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
    this.injectThemeBtn();
    this.injectAuthButtons();
    await this.checkUserSession();
    this.setupEventListeners();
    this.setupResponsiveMenu();
  }

  /* ── Inject hamburger button into nav ── */
  injectHamburger() {
    const nav = document.querySelector('nav');
    if (!nav || nav.querySelector('.mobile-menu-toggle')) return;

    // Ensure nav-links has a Home link on mobile
    const navLinks = nav.querySelector('.nav-links');
    if (navLinks && !navLinks.querySelector('.nav-home-link')) {
      const homeLi = document.createElement('li');
      homeLi.innerHTML = `<a href="../index.html" class="nav-home-link">Home</a>`;
      navLinks.insertBefore(homeLi, navLinks.firstChild);
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

  /* ── Inject theme button if missing ── */
  injectThemeBtn() {
    if (document.getElementById('theme-btn')) return;
    const navActions = document.querySelector('nav .nav-actions');
    if (!navActions) return;
    const btn = document.createElement('button');
    btn.id = 'theme-btn';
    btn.className = 'theme-icon-btn';
    btn.title = 'Toggle theme';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.textContent = '☀️';
    btn.addEventListener('click', function() {
      if (window.themeManager) window.themeManager.toggleTheme();
      this.classList.add('spinning');
      setTimeout(() => this.classList.remove('spinning'), 400);
    });
    // Insert before first child (so it's leftmost in nav-actions)
    navActions.insertBefore(btn, navActions.firstChild);
  }

  /* ── Inject sign-in + admin login buttons if missing ── */
  injectAuthButtons() {
    const navActions = document.querySelector('nav .nav-actions');
    if (!navActions) return;

    // Admin login link
    if (!document.getElementById('admin-nav-link')) {
      const adminLink = document.createElement('a');
      adminLink.id = 'admin-nav-link';
      adminLink.href = this.inPages ? 'admin-login.html' : 'pages/admin-login.html';
      adminLink.className = 'nav-admin-link';
      adminLink.title = 'Admin Login';
      adminLink.textContent = 'Admin';
      navActions.appendChild(adminLink);
    }

    // User sign-in button
    if (!document.getElementById('signin-btn')) {
      const btn = document.createElement('button');
      btn.id = 'signin-btn';
      btn.className = 'nav-signin';
      btn.textContent = 'Sign In';
      btn.addEventListener('click', () => {
        if (typeof openModal === 'function') {
          openModal('login');
        } else {
          const base = this.inPages ? '../index.html' : 'index.html';
          window.location.href = base;
        }
      });
      navActions.appendChild(btn);
    }

    // Get-started / register button
    if (!document.getElementById('cta-btn')) {
      const btn = document.createElement('button');
      btn.id = 'cta-btn';
      btn.className = 'nav-cta';
      btn.textContent = 'Get Started';
      btn.addEventListener('click', () => {
        if (typeof openModal === 'function') {
          openModal('register');
        } else {
          const base = this.inPages ? '../index.html' : 'index.html';
          window.location.href = base;
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
    const signInBtn = document.getElementById('signin-btn');
    const ctaBtn = document.getElementById('cta-btn');
    const adminNavLink = document.getElementById('admin-nav-link');

    if (profileSection) profileSection.style.display = 'flex';
    if (signInBtn) signInBtn.style.display = 'none';
    if (ctaBtn) ctaBtn.style.display = 'none';
    if (adminNavLink) adminNavLink.style.display = 'none';

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
    const signInBtn = document.getElementById('signin-btn');
    const ctaBtn = document.getElementById('cta-btn');
    const adminNavLink = document.getElementById('admin-nav-link');

    if (profileSection) profileSection.style.display = 'none';
    if (signInBtn) signInBtn.style.display = '';
    if (ctaBtn) {
      ctaBtn.style.display = '';
      ctaBtn.textContent = 'Get Started';
    }
    if (adminNavLink) adminNavLink.style.display = '';
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
