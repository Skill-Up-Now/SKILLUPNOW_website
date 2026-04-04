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
    this.setupProfileDropdown();
    this.injectAuthModal();
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
        <li><a href="${p}pamphlet.html" class="nav-link-item nav-pamphlet-btn" style="display:inline-flex;align-items:center;gap:0.35rem;background:linear-gradient(135deg,rgba(124,92,252,0.18),rgba(61,107,255,0.18));border:1.5px solid rgba(124,92,252,0.35);border-radius:50px;padding:0.35rem 0.9rem;font-weight:700;transition:all 0.25s;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>Pamphlet</a></li>
      </ul>

      <div class="nav-actions" id="nav-actions">

        <!-- Profile section: shown after login -->
        <div id="profile-section" style="display:none; align-items:center; position:relative;">
          <button id="profile-btn" class="profile-icon-btn" title="My Profile">U</button>
          <div id="profile-dropdown" class="profile-dropdown">
            <a href="${p}profile.html?tab=courses" class="pd-item">
              <span class="pd-icon">🎓</span>
              <div>
                <div class="pd-title">My Learning Path</div>
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

        <!-- Auth buttons: shown when logged out -->
        <div id="login-wrapper" class="login-wrapper" style="display:none;align-items:center;gap:.6rem;">
          <button id="login-btn" class="nav-signin" onclick="window.profileNav && window.profileNav.openLoginModal()">
            <svg class="login-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            <span class="login-btn-text">Login</span>
          </button>
        </div>

        <!-- Sign Up: shown only when logged out -->
        <button id="cta-btn" class="nav-cta nav-signup-btn" style="display:none;" onclick="window.profileNav && window.profileNav.openRegister()">
          <span class="nav-signup-text">Sign Up</span>
          <svg class="nav-signup-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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
      <div class="footer-grid-main" style="display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:3rem; margin-bottom:3.5rem;">
        <div>
          <a href="${r}index.html" class="nav-logo" style="margin-bottom:1rem; display:inline-flex;">
            <div class="logo-icon">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="nav-logo-text">SkillUpNow</span>
          </a>
          <p style="font-size:0.84rem; color:var(--txt4); line-height:1.75; max-width:280px; margin-top:1rem;">Premium IT &amp; professional skills training. Secure, scalable, and built for career transformation.</p>
          <div style="margin-top:1.2rem; display:flex; flex-direction:column; gap:0.5rem;">
            <a href="mailto:skillupnow.off@gmail.com" class="footer-contact-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              skillupnow.off@gmail.com
            </a>
            <a href="tel:+916381721061" class="footer-contact-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.17 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.08 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>
              +91 6381 721061
            </a>
            <a href="tel:+916383633054" class="footer-contact-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.17 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.08 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>
              +91 6383 633054
            </a>
            <div style="display:flex; align-items:center; gap:0.45rem; font-size:0.74rem; color:var(--txt4); margin-top:0.2rem; font-weight:500;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              SSL Enabled
            </div>
          </div>
        </div>

        <div>
          <h5 class="footer-col-title">Courses</h5>
          <ul class="footer-col-links">
            <li><a href="${p}courses.html" class="footer-link">Cloud Computing</a></li>
            <li><a href="${p}courses.html" class="footer-link">DevOps &amp; CI/CD</a></li>
            <li><a href="${p}courses.html" class="footer-link">AI &amp; Machine Learning</a></li>
            <li><a href="${p}courses.html" class="footer-link">Cybersecurity</a></li>
            <li><a href="${p}courses.html" class="footer-link">Data Engineering</a></li>
          </ul>
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
            <li><a href="${r}index.html#about-us" class="footer-link">About Us</a></li>
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

  /* ── Inject universal auth modal (styles + HTML + JS) ── */
  injectAuthModal() {
    if (document.getElementById('pn-auth-modal')) return;

    /* ── Modal CSS ── */
    const style = document.createElement('style');
    style.id = 'pn-auth-modal-style';
    style.textContent = `
      #pn-auth-modal {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(6,4,20,0.78);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; visibility: hidden;
        transition: opacity .28s ease, visibility .28s ease;
        pointer-events: none;
        padding: 1rem;
      }
      #pn-auth-modal.pn-open {
        opacity: 1; visibility: visible; pointer-events: all;
      }
      .pn-box {
        background: linear-gradient(160deg, #16123a 0%, #0f0d28 100%);
        border: 1px solid rgba(124,92,252,.35);
        border-radius: 22px;
        padding: 2.5rem 2.2rem;
        width: 100%; max-width: 430px;
        max-height: 92vh; overflow-y: auto;
        transform: scale(.93) translateY(16px);
        transition: transform .3s cubic-bezier(.23,1,.32,1);
        position: relative;
        box-shadow: 0 32px 64px rgba(0,0,0,.65), 0 0 0 1px rgba(124,92,252,.12);
      }
      #pn-auth-modal.pn-open .pn-box {
        transform: scale(1) translateY(0);
      }
      .pn-close {
        position: absolute; top: 1.1rem; right: 1.1rem;
        width: 30px; height: 30px; border-radius: 50%;
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.06);
        color: rgba(200,191,255,.55);
        font-size: .82rem; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all .2s; line-height: 1;
        font-family: inherit;
      }
      .pn-close:hover { background: rgba(255,255,255,.14); color: #fff; transform: scale(1.1); }

      /* Role select */
      .pn-brand { display: flex; align-items: center; gap: .6rem; margin-bottom: 1.8rem; }
      .pn-brand-logo {
        width: 36px; height: 36px; border-radius: 10px;
        background: linear-gradient(135deg,#7c5cfc,#3d6bff);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 16px rgba(124,92,252,.4);
        flex-shrink: 0;
      }
      .pn-brand-name {
        font-size: .95rem; font-weight: 800;
        background: linear-gradient(135deg,#fff,#c8bfff);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .pn-title {
        font-size: 1.6rem; font-weight: 800;
        color: #f0eeff; letter-spacing: -.02em;
        margin-bottom: .3rem; line-height: 1.2;
        font-family: 'Outfit', 'Inter', sans-serif;
      }
      .pn-sub { font-size: .84rem; color: rgba(200,191,255,.5); margin-bottom: 1.9rem; line-height: 1.5; }
      .pn-role-cards { display: grid; grid-template-columns: 1fr 1fr; gap: .85rem; margin-bottom: 1.6rem; }
      .pn-role-card {
        background: rgba(124,92,252,.07);
        border: 1.5px solid rgba(124,92,252,.2);
        border-radius: 14px; padding: 1.4rem 1rem;
        text-align: center; cursor: pointer;
        transition: all .22s ease;
      }
      .pn-role-card:hover {
        background: rgba(124,92,252,.16);
        border-color: rgba(124,92,252,.55);
        transform: translateY(-3px);
        box-shadow: 0 8px 24px rgba(124,92,252,.22);
      }
      .pn-role-icon { font-size: 2rem; margin-bottom: .6rem; }
      .pn-role-name { font-size: .9rem; font-weight: 700; color: #e0d8ff; margin-bottom: .25rem; }
      .pn-role-desc { font-size: .72rem; color: rgba(200,191,255,.4); line-height: 1.4; }

      /* Form views */
      .pn-back {
        background: none; border: none;
        color: rgba(200,191,255,.45); font-size: .82rem;
        cursor: pointer; margin-bottom: 1.4rem; padding: 0;
        display: flex; align-items: center; gap: .35rem;
        transition: color .2s; font-family: inherit;
      }
      .pn-back:hover { color: #a89eff; }
      .pn-field { margin-bottom: .95rem; }
      .pn-field label {
        display: block; font-size: .72rem; font-weight: 700;
        color: rgba(200,191,255,.45); text-transform: uppercase;
        letter-spacing: .06em; margin-bottom: .4rem;
      }
      .pn-field input {
        width: 100%; padding: .8rem 1rem;
        background: rgba(255,255,255,.05);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 11px; color: #f0eeff;
        font-size: .88rem; font-family: inherit;
        transition: border-color .2s, box-shadow .2s; outline: none;
      }
      .pn-field input:focus {
        border-color: rgba(124,92,252,.65);
        box-shadow: 0 0 0 3px rgba(124,92,252,.15);
      }
      .pn-field input::placeholder { color: rgba(200,191,255,.2); }
      .pn-btn {
        width: 100%; padding: .9rem;
        background: linear-gradient(135deg,#7c5cfc 0%,#3d6bff 100%);
        color: #fff; border: none; border-radius: 50px;
        font-size: .9rem; font-weight: 700; cursor: pointer;
        transition: filter .2s, transform .2s;
        margin-top: .2rem;
        box-shadow: 0 6px 24px rgba(124,92,252,.38);
        font-family: inherit; letter-spacing: .01em;
      }
      .pn-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
      .pn-btn:active { transform: translateY(0); }
      .pn-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; filter: none; }
      .pn-err {
        background: rgba(239,68,68,.09);
        border: 1px solid rgba(239,68,68,.28);
        border-radius: 10px; padding: .65rem .9rem;
        font-size: .81rem; color: #f87171;
        margin-bottom: .9rem; display: none; line-height: 1.45;
      }
      .pn-ok {
        background: rgba(74,222,128,.08);
        border: 1px solid rgba(74,222,128,.28);
        border-radius: 10px; padding: .65rem .9rem;
        font-size: .81rem; color: #4ade80;
        margin-bottom: .9rem; display: none;
      }
      .pn-switch {
        text-align: center; font-size: .82rem;
        color: rgba(200,191,255,.4); margin-top: 1.1rem;
      }
      .pn-switch a {
        color: #9b7dff; font-weight: 700;
        text-decoration: none; cursor: pointer;
        transition: color .2s;
      }
      .pn-switch a:hover { color: #b9a0ff; }
      .pn-divider {
        display: flex; align-items: center; gap: .8rem;
        margin: 1.1rem 0; font-size: .72rem;
        color: rgba(255,255,255,.14); font-weight: 600;
      }
      .pn-divider::before, .pn-divider::after {
        content: ''; flex: 1; height: 1px;
        background: rgba(255,255,255,.06);
      }

      /* Scrollbar */
      .pn-box::-webkit-scrollbar { width: 4px; }
      .pn-box::-webkit-scrollbar-thumb { background: rgba(124,92,252,.25); border-radius: 4px; }

      /* Responsive */
      @media (max-width: 480px) {
        .pn-box { padding: 1.8rem 1.4rem; border-radius: 18px; }
        .pn-role-cards { grid-template-columns: 1fr; gap: .65rem; }
        .pn-title { font-size: 1.35rem; }
      }
    `;
    document.head.appendChild(style);

    /* ── Modal HTML ── */
    const wrap = document.createElement('div');
    wrap.id = 'pn-auth-modal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Sign in to SkillUpNow');

    wrap.innerHTML = `
      <div class="pn-box" role="document">
        <button class="pn-close" onclick="window._pnClose()" aria-label="Close">✕</button>

        <!-- ── Role Select ── -->
        <div id="pn-v-role">
          <div class="pn-brand">
            <div class="pn-brand-logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="pn-brand-name">SkillUpNow</span>
          </div>
          <div class="pn-title">Welcome Back</div>
          <div class="pn-sub">Choose how you'd like to sign in to continue learning</div>
          <div class="pn-role-cards">
            <div class="pn-role-card" onclick="window._pnView('login')" role="button" tabindex="0">
              <div class="pn-role-icon">👤</div>
              <div class="pn-role-name">User Login</div>
              <div class="pn-role-desc">For students &amp; learners</div>
            </div>
            <div class="pn-role-card" onclick="window._pnMentorLogin()" role="button" tabindex="0">
              <div class="pn-role-icon">🎓</div>
              <div class="pn-role-name">Mentor Login</div>
              <div class="pn-role-desc">For instructors &amp; admins</div>
            </div>
          </div>
          <div class="pn-switch">Don't have an account? <a onclick="window._pnView('register')">Get Started →</a></div>
        </div>

        <!-- ── User Login Form ── -->
        <div id="pn-v-login" style="display:none;">
          <button class="pn-back" onclick="window._pnView('role')">← Back</button>
          <div class="pn-title">Sign In</div>
          <div class="pn-sub">Enter your credentials to access your learning dashboard</div>
          <div class="pn-err" id="pn-login-err"></div>
          <div class="pn-field">
            <label>Email Address</label>
            <input type="email" id="pn-login-email" placeholder="you@example.com" autocomplete="email">
          </div>
          <div class="pn-field">
            <label>Password</label>
            <input type="password" id="pn-login-pw" placeholder="••••••••" autocomplete="current-password">
          </div>
          <button class="pn-btn" id="pn-login-btn" onclick="window._pnSubmitLogin()">Sign In</button>
          <div class="pn-switch">New here? <a onclick="window._pnView('register')">Create a free account →</a></div>
        </div>

        <!-- ── Register Form ── -->
        <div id="pn-v-register" style="display:none;">
          <button class="pn-back" onclick="window._pnView('role')">← Back</button>
          <div class="pn-title">Get Started</div>
          <div class="pn-sub">Create your free SkillUpNow account and start learning today</div>
          <div class="pn-err" id="pn-reg-err"></div>
          <div class="pn-ok"  id="pn-reg-ok"></div>
          <div class="pn-field">
            <label>Full Name</label>
            <input type="text" id="pn-reg-name" placeholder="Your full name" autocomplete="name">
          </div>
          <div class="pn-field">
            <label>Email Address</label>
            <input type="email" id="pn-reg-email" placeholder="you@example.com" autocomplete="email">
          </div>
          <div class="pn-field">
            <label>Phone Number</label>
            <input type="tel" id="pn-reg-phone" placeholder="+91 98765 43210" autocomplete="tel">
          </div>
          <div class="pn-field">
            <label>Password</label>
            <input type="password" id="pn-reg-pw" placeholder="Min. 6 characters" autocomplete="new-password">
          </div>
          <button class="pn-btn" id="pn-reg-btn" onclick="window._pnSubmitRegister()">Create Account</button>
          <div class="pn-switch">Already have an account? <a onclick="window._pnView('login')">Sign in →</a></div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    /* ── Close on backdrop click ── */
    wrap.addEventListener('click', e => { if (e.target === wrap) window._pnClose(); });

    /* ── Keyboard accessibility ── */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') window._pnClose();
      // Enter on role cards
      if (e.key === 'Enter' && e.target.classList.contains('pn-role-card')) e.target.click();
    });

    /* ── Enter key submits login/register ── */
    wrap.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const login = document.getElementById('pn-v-login');
      const reg   = document.getElementById('pn-v-register');
      if (login && login.style.display !== 'none') { window._pnSubmitLogin(); return; }
      if (reg   && reg.style.display   !== 'none') { window._pnSubmitRegister(); }
    });

    /* ── Global helpers ── */
    const self = this;

    window._pnViews = ['pn-v-role','pn-v-login','pn-v-register'];
    window._pnView = (view) => {
      window._pnViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === 'pn-v-' + view ? '' : 'none';
      });
      // Clear errors on switch
      ['pn-login-err','pn-reg-err','pn-reg-ok'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.textContent = ''; }
      });
    };

    window._pnClose = () => {
      const modal = document.getElementById('pn-auth-modal');
      if (modal) modal.classList.remove('pn-open');
    };

    window._pnMentorLogin = () => {
      window._pnClose();
      window.location.href = self.pagesPfx + 'admin-login.html';
    };

    window._pnSubmitLogin = async () => {
      const emailEl = document.getElementById('pn-login-email');
      const pwEl    = document.getElementById('pn-login-pw');
      const errEl   = document.getElementById('pn-login-err');
      const btn     = document.getElementById('pn-login-btn');
      if (!emailEl || !pwEl) return;

      const email = emailEl.value.trim();
      const pw    = pwEl.value;
      if (!email || !pw) {
        errEl.textContent = 'Please enter your email and password.';
        errEl.style.display = ''; return;
      }
      errEl.style.display = 'none';
      btn.disabled = true; btn.textContent = 'Signing in…';

      try {
        if (!window.supabaseConfig) throw new Error('Auth service not ready. Please refresh.');
        const r = await window.supabaseConfig.signIn(email, pw);
        if (!r.success) throw new Error(r.error || 'Login failed. Check your credentials.');
        const user = r.data?.user || r.user;
        if (!user) throw new Error('No user data returned.');
        localStorage.setItem('user_email', user.email || '');
        localStorage.setItem('user_id',    user.id    || '');
        self.currentUser = user;
        self.showLoggedInUI();
        window._pnClose();
        // If admin, redirect to dashboard
        try {
          const ac = await window.supabaseConfig.checkAdminAccess(user.id);
          if (ac && ac.isAdmin) {
            window.location.href = self.pagesPfx + 'admin-dashboard.html';
            return;
          }
        } catch (_) { /* not admin, continue */ }
        // Reload page to apply session state
        window.location.reload();
      } catch (e) {
        errEl.textContent = e.message || 'Login failed. Please try again.';
        errEl.style.display = '';
        btn.disabled = false; btn.textContent = 'Sign In';
      }
    };

    window._pnSubmitRegister = async () => {
      const nameEl  = document.getElementById('pn-reg-name');
      const emailEl = document.getElementById('pn-reg-email');
      const phoneEl = document.getElementById('pn-reg-phone');
      const pwEl    = document.getElementById('pn-reg-pw');
      const errEl   = document.getElementById('pn-reg-err');
      const okEl    = document.getElementById('pn-reg-ok');
      const btn     = document.getElementById('pn-reg-btn');
      if (!nameEl || !emailEl || !pwEl) return;

      const name  = nameEl.value.trim();
      const email = emailEl.value.trim();
      const phone = phoneEl ? phoneEl.value.trim() : '';
      const pw    = pwEl.value;

      if (!name || !email || !pw) {
        errEl.textContent = 'Full name, email, and password are required.';
        errEl.style.display = ''; return;
      }
      if (pw.length < 6) {
        errEl.textContent = 'Password must be at least 6 characters long.';
        errEl.style.display = ''; return;
      }
      errEl.style.display = 'none';
      btn.disabled = true; btn.textContent = 'Creating account…';

      try {
        if (!window.supabaseConfig) throw new Error('Auth service not ready. Please refresh.');
        const r = await window.supabaseConfig.signUp(email, pw, { full_name: name, email, phone });
        if (!r.success) throw new Error(r.error || 'Registration failed.');

        // Auto sign-in after register
        btn.textContent = 'Signing you in…';
        const lr = await window.supabaseConfig.signIn(email, pw);
        if (lr.success && (lr.data?.user || lr.user)) {
          const user = lr.data?.user || lr.user;
          localStorage.setItem('user_email', user.email || '');
          localStorage.setItem('user_id',    user.id    || '');
          self.currentUser = user;
          self.showLoggedInUI();
          window._pnClose();
          window.location.reload();
        } else {
          okEl.textContent = 'Account created! Please sign in with your new credentials.';
          okEl.style.display = '';
          window._pnView('login');
        }
      } catch (e) {
        errEl.textContent = e.message || 'Registration failed. Please try again.';
        errEl.style.display = '';
        btn.disabled = false; btn.textContent = 'Create Account';
      }
    };
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
      const initial = name.charAt(0).toUpperCase();
      btn.textContent = initial;
      btn.title = `Signed in as ${this.currentUser.email}`;

      // Load profile picture asynchronously
      if (window.supabaseConfig) {
        window.supabaseConfig.getUserProfile(this.currentUser.id).then(pr => {
          const picUrl = pr?.data?.profile_picture_url;
          if (picUrl && document.getElementById('profile-btn') === btn) {
            btn.textContent = '';
            btn.style.padding = '0';
            btn.style.overflow = 'hidden';
            const img = document.createElement('img');
            img.src = picUrl;
            img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
            img.onerror = () => { btn.textContent = initial; btn.style.padding = ''; btn.style.overflow = ''; };
            btn.appendChild(img);
          }
        }).catch(() => {});
      }
    }
    this.checkAdminStatus();
  }

  showLoggedOutUI() {
    const ps  = document.getElementById('profile-section');
    const lw  = document.getElementById('login-wrapper');
    const cta = document.getElementById('cta-btn');

    if (ps)  ps.style.display  = 'none';
    if (lw)  { lw.style.display = 'flex'; lw.style.alignItems = 'center'; }
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

  /* Open the login role-select modal */
  openLoginModal() {
    // On pages that already have openModal (index.html with main.js modal)
    if (typeof openModal === 'function' && document.getElementById('mo')) {
      openModal('role-select');
      return;
    }
    // Use the injected universal modal
    this.injectAuthModal();
    const modal = document.getElementById('pn-auth-modal');
    if (modal) {
      window._pnView('role');
      modal.classList.add('pn-open');
      // Focus first interactive element
      setTimeout(() => {
        const first = modal.querySelector('.pn-role-card');
        if (first) first.focus();
      }, 100);
    }
  }

  /* Open register view of modal */
  openRegister() {
    if (typeof openModal === 'function' && document.getElementById('mo')) {
      openModal('register');
      return;
    }
    this.injectAuthModal();
    const modal = document.getElementById('pn-auth-modal');
    if (modal) {
      window._pnView('register');
      modal.classList.add('pn-open');
      setTimeout(() => {
        const first = modal.querySelector('#pn-reg-name');
        if (first) first.focus();
      }, 100);
    }
  }

  /* Legacy: called from old code */
  openUserLogin() {
    this.openLoginModal();
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
  setupLoginDropdown() {} // no-op: dropdown replaced with modal
}

document.addEventListener('DOMContentLoaded', () => {
  window.profileNav = new ProfileNavigationManager();
});
