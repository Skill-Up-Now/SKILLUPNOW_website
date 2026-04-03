/* ==========================================
   SITE COMPONENTS — Universal Header & Footer
   ========================================== */

class ProfileNavigationManager {
  constructor() {
    this.currentUser = null;
    const path = window.location.pathname.replace(/\\/g, '/');
    this.inPages     = path.includes('/pages/');
    // root: prefix for links back to index.html ('../' from pages, '' from root)
    this.rootPfx     = this.inPages ? '../' : '';
    // pages: prefix for links to /pages/*.html ('' from pages, 'pages/' from root)
    this.pagesPfx    = this.inPages ? ''    : 'pages/';
    this.isAdminPage = path.includes('admin-dashboard') || path.includes('admin-login');
    this.init();
  }

  async init() {
    if (this.isAdminPage) return;
    this.injectCursor();
    this.rebuildNav();
    this.replaceFooter();
    this.setupMobileMenu();
    this.setupLoginDropdown();
    this.setupProfileDropdown();
    await this.checkUserSession();
  }

  /* ── Cursor elements ── */
  injectCursor() {
    if (document.getElementById('cursor')) return;
    const dot  = document.createElement('div'); dot.id = 'cursor';
    const ring = document.createElement('div'); ring.id = 'cursor-ring';
    document.body.prepend(ring);
    document.body.prepend(dot);
  }

  /* ── Build nav HTML with correct paths ── */
  buildNavHTML() {
    const r = this.rootPfx;   // '../' from /pages/, '' from root
    const p = this.pagesPfx;  // '' from /pages/, 'pages/' from root

    return `
      <a href="${r}index.html" class="nav-logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="nav-logo-text">SkillUpNow</span>
      </a>

      <ul class="nav-links" id="nav-links-list">
        <li><a href="${r}index.html" class="nav-link-item">Home</a></li>
        <li><a href="${p}courses.html" class="nav-link-item">Courses</a></li>
        <li><a href="${p}feedback.html" class="nav-link-item">Reviews</a></li>
        <li><a href="${p}contact-enquiry.html" class="nav-link-item">Enquiry</a></li>
      </ul>

      <div class="nav-actions" id="nav-actions">

        <!-- Profile section: shown after login -->
        <div id="profile-section" style="display:none; align-items:center; position:relative;">
          <button id="profile-btn" class="profile-icon-btn" title="My Profile">U</button>
          <div id="profile-dropdown" class="profile-dropdown">
            <a href="${p}profile.html#learning-path" class="pd-item">
              <span class="pd-icon">🎓</span>
              <div>
                <div class="pd-title">Learning Path</div>
                <div class="pd-sub">Your enrolled courses</div>
              </div>
            </a>
            <a href="${p}profile.html?edit=1" class="pd-item">
              <span class="pd-icon">✏️</span>
              <div>
                <div class="pd-title">Edit Profile</div>
                <div class="pd-sub">Update your info</div>
              </div>
            </a>
            <a id="dd-admin-link" href="${p}admin-dashboard.html" class="pd-item" style="display:none;">
              <span class="pd-icon">⚙️</span>
              <div>
                <div class="pd-title">Admin Panel</div>
                <div class="pd-sub">Manage platform</div>
              </div>
            </a>
            <button onclick="window.profileNav && window.profileNav.logout()" class="pd-item pd-logout">
              <span class="pd-icon">🚪</span>
              <div>
                <div class="pd-title" style="color:#ff6b6b;">Logout</div>
                <div class="pd-sub">Sign out safely</div>
              </div>
            </button>
          </div>
        </div>

        <!-- Login wrapper: shown when logged out -->
        <div id="login-wrapper" class="login-wrapper">
          <button id="login-btn" class="nav-signin" aria-haspopup="true" aria-expanded="false">
            <svg class="login-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            <span class="login-btn-text">Login</span>
            <svg class="chevron-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="login-dropdown" id="login-dropdown" role="menu">
            <button class="ld-item" onclick="window.profileNav && window.profileNav.openUserLogin()" role="menuitem">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              User Login
            </button>
            <a href="${p}admin-login.html" class="ld-item ld-mentor" role="menuitem">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              Mentor Login
            </a>
          </div>
        </div>

        <!-- Get Started: shown when logged out, hidden on mobile -->
        <button id="cta-btn" class="nav-cta" onclick="window.profileNav && window.profileNav.openRegister()">
          Get Started
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>

        <!-- Mobile hamburger -->
        <button class="mobile-menu-toggle" id="mobile-toggle" aria-label="Open menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>

      </div>
    `;
  }

  /* ── Build footer HTML with correct paths ── */
  buildFooterHTML() {
    const r = this.rootPfx;
    const p = this.pagesPfx;

    return `
      <div class="footer-grid-main" style="display:grid; grid-template-columns:2.2fr 1fr 1fr; gap:3.5rem; margin-bottom:3.5rem;">
        <div>
          <a href="${r}index.html" class="nav-logo" style="margin-bottom:1rem; display:inline-flex;">
            <div class="logo-icon">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="nav-logo-text">SkillUpNow</span>
          </a>
          <p style="font-size:0.84rem; color:var(--txt4); line-height:1.75; max-width:280px; margin-top:1rem;">Premium IT &amp; professional skills training. Secure, scalable, and built for career transformation.</p>
          <div style="margin-top:1.2rem; display:flex; flex-direction:column; gap:0.45rem;">
            <a href="mailto:skillupnow.off@gmail.com" class="footer-contact-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              skillupnow.off@gmail.com
            </a>
            <a href="tel:+919876543210" class="footer-contact-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.17 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.08 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>
              +91 98765 43210
            </a>
            <div style="display:flex; align-items:center; gap:0.45rem; font-size:0.74rem; color:var(--txt4); margin-top:0.2rem; font-weight:500;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              SSL Enabled
            </div>
          </div>
        </div>

        <div>
          <h5 class="footer-col-title">Platform</h5>
          <ul class="footer-col-links">
            <li><a href="${r}index.html#how-it-works" class="footer-link">How It Works</a></li>
            <li><a href="${p}contact-enquiry.html" class="footer-link">Fee Enquiry</a></li>
            <li><a href="${p}emi-application.html" class="footer-link">EMI Options</a></li>
            <li><a href="${p}feedback.html" class="footer-link">Reviews</a></li>
          </ul>
        </div>

        <div>
          <h5 class="footer-col-title">Company</h5>
          <ul class="footer-col-links">
            <li><a href="#" class="footer-link">About Us</a></li>
            <li><a href="#" class="footer-link">Privacy Policy</a></li>
            <li><a href="#" class="footer-link">Terms of Service</a></li>
            <li><a href="${p}contact-enquiry.html" class="footer-link">Contact Us</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p class="footer-copy">© 2026 SkillUpNow. All rights reserved.</p>
        <div class="footer-socials">
          <a href="#" class="footer-social-icon" aria-label="Facebook">📘</a>
          <a href="#" class="footer-social-icon" aria-label="X">𝕏</a>
          <a href="#" class="footer-social-icon" aria-label="YouTube">📺</a>
          <a href="#" class="footer-social-icon" aria-label="Instagram">📷</a>
        </div>
      </div>
    `;
  }

  /* ── Rebuild nav element ── */
  rebuildNav() {
    const nav = document.querySelector('nav:not(.page-breadcrumb):not(.sidebar-nav):not([data-skip-component])');
    if (!nav) return;
    nav.innerHTML = this.buildNavHTML();
  }

  /* ── Replace footer with canonical footer ── */
  replaceFooter() {
    const footers = document.querySelectorAll('footer:not([data-skip-component])');
    if (!footers.length) return;
    footers.forEach((footer, idx) => {
      if (idx < footers.length - 1) {
        footer.remove();
      } else {
        footer.className = 'site-footer';
        footer.removeAttribute('style');
        footer.innerHTML = this.buildFooterHTML();
      }
    });
  }

  /* ── Mobile hamburger ── */
  setupMobileMenu() {
    const toggle   = document.getElementById('mobile-toggle');
    const navLinks = document.getElementById('nav-links-list');
    const nav      = document.querySelector('nav');
    if (!toggle || !navLinks) return;

    toggle.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = navLinks.classList.toggle('mobile-open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen);
      toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (nav && !nav.contains(e.target)) {
        navLinks.classList.remove('mobile-open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close when any nav link is clicked
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ── Login dropdown ── */
  setupLoginDropdown() {
    const loginWrapper  = document.getElementById('login-wrapper');
    const loginDropdown = document.getElementById('login-dropdown');
    const loginBtn      = document.getElementById('login-btn');
    if (!loginWrapper || !loginDropdown || !loginBtn) return;

    const openDd  = () => {
      loginDropdown.classList.add('active');
      loginBtn.setAttribute('aria-expanded', 'true');
      const ch = loginBtn.querySelector('.chevron-icon');
      if (ch) ch.style.transform = 'rotate(180deg)';
    };
    const closeDd = () => {
      loginDropdown.classList.remove('active');
      loginBtn.setAttribute('aria-expanded', 'false');
      const ch = loginBtn.querySelector('.chevron-icon');
      if (ch) ch.style.transform = '';
    };
    const toggleDd = () => loginDropdown.classList.contains('active') ? closeDd() : openDd();

    let hideTimer;

    // Click to toggle
    loginBtn.addEventListener('click', e => { e.stopPropagation(); toggleDd(); });

    // Hover on desktop
    loginWrapper.addEventListener('mouseenter', () => { clearTimeout(hideTimer); openDd(); });
    loginWrapper.addEventListener('mouseleave', () => { hideTimer = setTimeout(closeDd, 200); });
    loginDropdown.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    loginDropdown.addEventListener('mouseleave', () => { hideTimer = setTimeout(closeDd, 200); });

    // Close on outside click / Escape
    document.addEventListener('click', e => {
      if (!loginWrapper.contains(e.target)) closeDd();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeDd();
    });
  }

  /* ── Profile dropdown ── */
  setupProfileDropdown() {
    const profileSection  = document.getElementById('profile-section');
    const profileDropdown = document.getElementById('profile-dropdown');
    const profileBtn      = document.getElementById('profile-btn');
    if (!profileBtn || !profileDropdown) return;

    let hideTimer;
    const openDd  = () => profileDropdown.classList.add('active');
    const closeDd = () => profileDropdown.classList.remove('active');

    profileBtn.addEventListener('click', e => {
      e.stopPropagation();
      profileDropdown.classList.toggle('active');
    });

    // Mobile: touchstart fires before click; use it exclusively on touch devices
    profileBtn.addEventListener('touchstart', e => {
      e.preventDefault(); // prevents ghost click
      e.stopPropagation();
      profileDropdown.classList.toggle('active');
    }, { passive: false });

    if (profileSection) {
      profileSection.addEventListener('mouseenter', () => { clearTimeout(hideTimer); openDd(); });
      profileSection.addEventListener('mouseleave', () => { hideTimer = setTimeout(closeDd, 200); });
    }
    profileDropdown.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    profileDropdown.addEventListener('mouseleave', () => { hideTimer = setTimeout(closeDd, 200); });

    document.addEventListener('click', e => {
      if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) closeDd();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDd(); });
  }

  /* ── Auth session ── */
  async checkUserSession() {
    try {
      if (!window.supabaseConfig) return;
      const user = await window.supabaseConfig.getCurrentUser();
      if (user) { this.currentUser = user; this.showLoggedInUI(); }
      else       { this.showLoggedOutUI(); }
    } catch (err) {
      console.error('Session check error:', err);
      this.showLoggedOutUI();
    }
  }

  showLoggedInUI() {
    const ps  = document.getElementById('profile-section');
    const lw  = document.getElementById('login-wrapper');
    const cta = document.getElementById('cta-btn');

    if (ps)  { ps.style.display  = 'flex'; ps.style.alignItems = 'center'; }
    if (lw)  { lw.style.display  = 'none'; }
    if (cta) { cta.style.display = 'none'; }

    const btn = document.getElementById('profile-btn');
    if (btn && this.currentUser) {
      const name = (this.currentUser.email || '').split('@')[0] || 'U';
      btn.textContent = name.charAt(0).toUpperCase();
      btn.title = `Signed in as ${this.currentUser.email}`;
    }
    this.checkAdminStatus();
  }

  showLoggedOutUI() {
    const ps  = document.getElementById('profile-section');
    const lw  = document.getElementById('login-wrapper');
    const cta = document.getElementById('cta-btn');

    if (ps)  ps.style.display  = 'none';
    if (lw)  lw.style.display  = '';
    if (cta) cta.style.display = '';
  }

  checkAdminStatus() {
    if (!window.supabaseConfig || !this.currentUser) return;
    window.supabaseConfig.checkAdminAccess(this.currentUser.id)
      .then(r => {
        if (r && r.isAdmin) {
          const al = document.getElementById('dd-admin-link');
          if (al) al.style.display = 'flex';
        }
      }).catch(() => {});
  }

  /* ── Actions ── */
  openUserLogin() {
    // Close login dropdown first
    document.getElementById('login-dropdown')?.classList.remove('active');
    if (typeof openModal === 'function') {
      openModal(document.getElementById('rs') ? 'role-select' : 'login');
    } else {
      window.location.href = this.rootPfx + 'index.html';
    }
  }

  openRegister() {
    if (typeof openModal === 'function') openModal('register');
    else window.location.href = this.rootPfx + 'index.html';
  }

  async logout() {
    try { if (window.supabaseConfig) await window.supabaseConfig.signOut(); } catch {}
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    sessionStorage.clear();
    window.location.href = this.rootPfx + 'index.html';
  }

  /* Backward-compat stubs */
  buildDropdown() {}
  toggleProfileDropdown() { document.getElementById('profile-dropdown')?.classList.toggle('active'); }
}

document.addEventListener('DOMContentLoaded', () => {
  window.profileNav = new ProfileNavigationManager();
});
