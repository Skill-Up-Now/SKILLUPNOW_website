/* ==========================================
   SITE COMPONENTS — Universal Header, Footer, Cursor & Auth Modal
   ========================================== */

class ProfileNavigationManager {
  constructor() {
    this.currentUser = null;
    const path = window.location.pathname.replace(/\\/g, '/');
    this.inPages     = path.includes('/pages/');
    this.rootPfx     = this.inPages ? '../' : '';
    this.pagesPfx    = this.inPages ? ''    : 'pages/';
    this.isAdminPage = path.includes('admin-dashboard') || path.includes('admin-login');
    this.isMentorPage = path.includes('mentor-dashboard') || path.includes('mentor-signup');
    this._pendingOtpEmail = null;
    this._pendingOtpRole  = null;
    this._pendingOtpData  = null;
    this.init();
  }

  async init() {
    if (this.isAdminPage) return;
    this.injectNeuralCursor();
    this.rebuildNav();
    this.replaceFooter();
    this.updateYearFields();
    this.setupMobileMenu();
    this.setupProfileDropdown();
    this.setupScrollNav();
    this.injectAuthModal();
    await this.checkUserSession();
    this.handleUrlAuth();
  }

  /* ── Handle ?login=1 / ?signup=1 URL params ── */
  handleUrlAuth() {
    const p = new URLSearchParams(window.location.search);
    if (p.get('login') === '1')  { setTimeout(() => this.openLoginModal(), 300); }
    if (p.get('signup') === '1') { setTimeout(() => this.openRegister(), 300); }
  }

  /* ── Year placeholders ── */
  updateYearFields() {
    const year = new Date().getFullYear();
    document.querySelectorAll('.site-year').forEach(el => { el.textContent = year; });
  }

  /* ── Neural cursor: inject neural-cursor.js dynamically ── */
  injectNeuralCursor() {
    if (document.getElementById('nc-canvas')) return;  // already loaded
    const s = document.createElement('script');
    s.src = this.rootPfx + 'js/neural-cursor.js';
    s.defer = true;
    document.head.appendChild(s);
  }

  /* ── Scroll: add .scrolled class to nav for effects ── */
  setupScrollNav() {
    const tick = () => {
      const nav = document.querySelector('nav');
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', tick, { passive: true });
    tick();
  }

  /* ── Build nav HTML ── */
  buildNavHTML() {
    const r = this.rootPfx;
    const p = this.pagesPfx;
    const path = window.location.pathname.replace(/\\/g, '/');
    const isHome     = path.endsWith('/') || path.endsWith('index.html') || path.endsWith('index');
    const isCourses  = path.includes('courses');
    const isFeedback = path.includes('feedback');
    const isContact  = path.includes('contact-enquiry');
    const isPamphlet = path.includes('pamphlet');

    return `
      <a href="${r}index.html" class="nav-logo" aria-label="SkillUpNow Home">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="nav-logo-text">SkillUpNow</span>
      </a>

      <ul class="nav-links" id="nav-links-list" role="navigation" aria-label="Main navigation">
        <li><a href="${r}index.html"          class="nav-link-item ${isHome     ? 'active' : ''}">Home</a></li>
        <li><a href="${p}courses.html"         class="nav-link-item ${isCourses  ? 'active' : ''}">Courses</a></li>
        <li><a href="${p}pamphlet.html"        class="nav-link-item ${isPamphlet ? 'active' : ''}">Brochure</a></li>
        <li><a href="${p}feedback.html"        class="nav-link-item ${isFeedback ? 'active' : ''}">Reviews</a></li>
        <li><a href="${p}contact-enquiry.html" class="nav-link-item ${isContact  ? 'active' : ''}">Contact</a></li>
      </ul>

      <div class="nav-actions" id="nav-actions">

        <!-- Profile: shown after login -->
        <div id="profile-section" style="display:none;align-items:center;position:relative;">
          <button id="profile-btn" class="profile-icon-btn" aria-label="My profile" aria-haspopup="true" aria-expanded="false">U</button>
          <div id="profile-dropdown" class="profile-dropdown" role="menu">
            <div class="pd-header" id="pd-user-info">
              <div class="pd-avatar-sm" id="pd-avatar-sm">U</div>
              <div>
                <div class="pd-user-name" id="pd-name">User</div>
                <div class="pd-user-email" id="pd-email"></div>
              </div>
            </div>
            <div class="pd-divider"></div>
            <a href="${p}profile.html" class="pd-item" role="menuitem">
              <span class="pd-icon">🎓</span>
              <div><div class="pd-title">My Dashboard</div><div class="pd-sub">Learning path & progress</div></div>
            </a>
            <a href="${p}profile.html?tab=payments" class="pd-item" role="menuitem">
              <span class="pd-icon">💳</span>
              <div><div class="pd-title">Payments & EMI</div><div class="pd-sub">Invoices & installments</div></div>
            </a>
            <a id="dd-mentor-link" href="${p}mentor-dashboard.html" class="pd-item" role="menuitem" style="display:none;">
              <span class="pd-icon">📋</span>
              <div><div class="pd-title">Mentor Portal</div><div class="pd-sub">Batches & schedules</div></div>
            </a>
            <a id="dd-admin-link" href="${p}admin-dashboard.html" class="pd-item" role="menuitem" style="display:none;">
              <span class="pd-icon">⚙️</span>
              <div><div class="pd-title">Admin Panel</div><div class="pd-sub">Manage platform</div></div>
            </a>
            <div class="pd-divider"></div>
            <button onclick="window.profileNav && window.profileNav.logout()" class="pd-item pd-logout" role="menuitem">
              <span class="pd-icon">🚪</span>
              <div><div class="pd-title" style="color:#ff6b6b;">Sign Out</div><div class="pd-sub">See you soon!</div></div>
            </button>
          </div>
        </div>

        <!-- Auth buttons: shown when logged out (visible by default, hidden on login) -->
        <div id="login-wrapper" style="display:flex;align-items:center;gap:.6rem;">
          <button id="login-btn" class="nav-signin" onclick="window.profileNav && window.profileNav.openLoginModal()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            Login
          </button>
          <button id="cta-btn" class="nav-cta nav-signup-btn" onclick="window.profileNav && window.profileNav.openRegister()">
            Sign Up
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>

        <!-- Mobile hamburger -->
        <button class="mobile-menu-toggle" id="mobile-toggle" aria-label="Open menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    `;
  }

  /* ── Build footer HTML ── */
  buildFooterHTML() {
    const r = this.rootPfx;
    const p = this.pagesPfx;
    return `
      <div class="footer-inner">
        <div class="footer-brand-col">
          <a href="${r}index.html" class="nav-logo" style="margin-bottom:1.2rem;display:inline-flex;">
            <div class="logo-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            <span class="nav-logo-text">SkillUpNow</span>
          </a>
          <p class="footer-tagline">Premium IT &amp; professional skills training. Mentor-led, live + recorded, with EMI options.</p>
          <div class="footer-contacts">
            <a href="mailto:skillupnow.off@gmail.com" class="footer-contact-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              skillupnow.off@gmail.com
            </a>
            <a href="tel:+916381721061" class="footer-contact-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.17 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.08 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>
              +91 6381 721 061
            </a>
          </div>
          <div class="footer-ssl-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            SSL Secured
          </div>
        </div>

        <div class="footer-links-col">
          <h5 class="footer-col-title">Platform</h5>
          <ul class="footer-col-links">
            <li><a href="${p}courses.html"         class="footer-link">All Courses</a></li>
            <li><a href="${p}pamphlet.html"         class="footer-link">Course Brochure</a></li>
            <li><a href="${p}emi-application.html"  class="footer-link">EMI Options</a></li>
            <li><a href="${p}feedback.html"         class="footer-link">Student Reviews</a></li>
            <li><a href="${p}contact-enquiry.html"  class="footer-link">Fee Enquiry</a></li>
          </ul>
        </div>

        <div class="footer-links-col">
          <h5 class="footer-col-title">For Mentors</h5>
          <ul class="footer-col-links">
            <li><a href="${p}mentor-signup.html"    class="footer-link">Become a Mentor</a></li>
            <li><a href="${p}mentor-dashboard.html" class="footer-link">Mentor Dashboard</a></li>
          </ul>
          <h5 class="footer-col-title" style="margin-top:1.5rem;">Company</h5>
          <ul class="footer-col-links">
            <li><a href="${r}index.html#about"      class="footer-link">About Us</a></li>
            <li><a href="#"                         class="footer-link">Privacy Policy</a></li>
            <li><a href="#"                         class="footer-link">Terms of Service</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p class="footer-copy">© <span class="site-year">${new Date().getFullYear()}</span> SkillUpNow. All rights reserved. Chennai, Tamil Nadu.</p>
        <div class="footer-socials">
          <a href="#" class="footer-social-icon" aria-label="Facebook" title="Facebook">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          </a>
          <a href="#" class="footer-social-icon" aria-label="Twitter / X" title="X">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a href="#" class="footer-social-icon" aria-label="YouTube" title="YouTube">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>
          </a>
          <a href="#" class="footer-social-icon" aria-label="Instagram" title="Instagram">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </a>
        </div>
      </div>
    `;
  }

  /* ── Rebuild nav element ── */
  rebuildNav() {
    const nav = document.querySelector('nav:not([data-skip-component])');
    if (!nav) return;
    nav.innerHTML = this.buildNavHTML();
  }

  /* ── Replace footer ── */
  replaceFooter() {
    const footers = document.querySelectorAll('footer:not([data-skip-component])');
    if (!footers.length) return;
    footers.forEach((footer, idx) => {
      if (idx < footers.length - 1) { footer.remove(); return; }
      footer.className = 'site-footer';
      footer.removeAttribute('style');
      footer.innerHTML = this.buildFooterHTML();
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

    document.addEventListener('click', e => {
      if (nav && !nav.contains(e.target)) {
        navLinks.classList.remove('mobile-open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

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
    document.addEventListener('click', e => {
      const btn  = document.getElementById('profile-btn');
      const dd   = document.getElementById('profile-dropdown');
      if (!btn || !dd) return;
      if (btn.contains(e.target)) {
        const open = dd.classList.toggle('active');
        btn.setAttribute('aria-expanded', open);
      } else if (!dd.contains(e.target)) {
        dd.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.getElementById('profile-dropdown')?.classList.remove('active');
        document.getElementById('profile-btn')?.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ======================================================
     NEW AUTH MODAL — Completely redesigned
     ====================================================== */
  injectAuthModal() {
    if (document.getElementById('pn-auth-modal')) return;

    /* ── EmailJS config ─────────────────────────────────────────
       Fill these from your EmailJS dashboard (emailjs.com):
         Service ID  → Email Services → copy the Service ID
         Public Key  → Account → API Keys → Public Key
       Template ID is already set: template_bjqerns
    ── */
    const EMAILJS_SERVICE_ID  = 'service_skillupnow'; // ← replace with your Service ID
    const EMAILJS_TEMPLATE_ID = 'template_bjqerns';
    const EMAILJS_PUBLIC_KEY  = '6chiuXaZ_OqXbYyG1';     // ← replace with your Public Key

    // Load EmailJS SDK once
    if (!window._emailjsLoaded) {
      window._emailjsLoaded = true;
      const ejs = document.createElement('script');
      ejs.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      ejs.onload = () => {
        if (window.emailjs) window.emailjs.init(EMAILJS_PUBLIC_KEY);
      };
      document.head.appendChild(ejs);
    }

    // OTP helpers (stored on window for cross-function access)
    window._pnOtpGenerate = () => Math.floor(100000 + Math.random() * 900000).toString();
    window._pnOtpStore = (email, otp) => {
      sessionStorage.setItem('pn_otp', JSON.stringify({
        otp, email, expires: Date.now() + 10 * 60 * 1000
      }));
    };
    window._pnOtpVerify = (email, entered) => {
      try {
        const stored = JSON.parse(sessionStorage.getItem('pn_otp') || '{}');
        if (!stored.otp) return false;
        if (stored.email !== email) return false;
        if (Date.now() > stored.expires) { sessionStorage.removeItem('pn_otp'); return false; }
        return stored.otp === entered;
      } catch { return false; }
    };
    window._pnOtpSend = async (email, name, otp) => {
      if (!window.emailjs) throw new Error('Email service not ready. Please refresh and try again.');
      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        email, name, otp
      }, EMAILJS_PUBLIC_KEY);
    };

    /* ── CSS ── */
    const style = document.createElement('style');
    style.id = 'pn-auth-modal-style';
    style.textContent = `
      /* ── Overlay ── */
      #pn-auth-modal {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(30, 20, 80, 0.55);
        backdrop-filter: blur(14px) saturate(1.6);
        -webkit-backdrop-filter: blur(14px) saturate(1.6);
        display: flex; align-items: center; justify-content: center;
        padding: 1rem;
        opacity: 0; visibility: hidden; pointer-events: none;
        transition: opacity .3s ease, visibility .3s ease;
      }
      #pn-auth-modal.pn-open {
        opacity: 1; visibility: visible; pointer-events: all;
      }

      /* ── Box (LIGHT THEME) ── */
      .pn-box {
        width: 100%; max-width: 460px;
        max-height: 94vh; overflow-y: auto; overflow-x: hidden;
        background: #ffffff;
        border: 1.5px solid rgba(124,92,252,.15);
        border-radius: 24px;
        padding: 2.5rem 2.2rem 2rem;
        position: relative;
        box-shadow: 0 24px 64px rgba(80,40,180,.14), 0 2px 16px rgba(124,92,252,.08);
        transform: scale(.94) translateY(20px);
        transition: transform .32s cubic-bezier(.22,1,.36,1);
      }
      .pn-box::before {
        content: '';
        position: absolute; top: 0; left: 0; right: 0; height: 3px;
        background: linear-gradient(90deg, #7c5cfc, #3d6bff, #a78bfa);
        border-radius: 24px 24px 0 0;
      }
      #pn-auth-modal.pn-open .pn-box { transform: scale(1) translateY(0); }

      /* ── Scrollbar ── */
      .pn-box::-webkit-scrollbar { width: 3px; }
      .pn-box::-webkit-scrollbar-thumb { background: rgba(124,92,252,.2); border-radius: 3px; }

      /* ── Close ── */
      .pn-close {
        position: absolute; top: 1.1rem; right: 1.1rem;
        width: 32px; height: 32px; border-radius: 50%;
        border: 1.5px solid #e5e0ff;
        background: #f5f3ff;
        color: #9b7dff;
        font-size: .8rem; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all .2s; font-family: inherit; line-height: 1;
      }
      .pn-close:hover { background: #ede9ff; border-color: #c4b5fd; color: #7c5cfc; transform: scale(1.12) rotate(90deg); }

      /* ── Brand header ── */
      .pn-brand { display: flex; align-items: center; gap: .6rem; margin-bottom: 1.6rem; }
      .pn-brand-logo {
        width: 38px; height: 38px; border-radius: 11px;
        background: linear-gradient(135deg,#7c5cfc,#3d6bff);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 16px rgba(124,92,252,.35); flex-shrink: 0;
      }
      .pn-brand-name {
        font-size: .95rem; font-weight: 800;
        background: linear-gradient(135deg,#4c1d95 0%,#1e40af 100%);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      }
      .pn-badge {
        margin-left: auto; background: rgba(74,222,128,.1);
        border: 1px solid rgba(34,197,94,.3); border-radius: 999px;
        padding: .2rem .6rem; font-size: .65rem; font-weight: 700;
        color: #16a34a; letter-spacing: .04em;
      }

      /* ── Titles ── */
      .pn-title {
        font-size: 1.7rem; font-weight: 900; letter-spacing: -.03em;
        color: #12103a; line-height: 1.15; margin-bottom: .35rem;
      }
      .pn-title span {
        background: linear-gradient(135deg,#7c5cfc,#3d6bff);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      }
      .pn-sub { font-size: .83rem; color: #6b7280; margin-bottom: 1.8rem; line-height: 1.55; }

      /* ── Role cards ── */
      .pn-role-cards { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; margin-bottom: 1.4rem; }
      .pn-role-card {
        background: #faf9ff;
        border: 1.5px solid #e5e0ff;
        border-radius: 16px; padding: 1.4rem 1rem;
        text-align: center; cursor: pointer;
        transition: all .22s cubic-bezier(.4,0,.2,1);
        outline: none; position: relative; overflow: hidden;
      }
      .pn-role-card::after {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(135deg,rgba(124,92,252,.07),transparent);
        opacity: 0; transition: opacity .22s;
      }
      .pn-role-card:hover, .pn-role-card:focus-visible {
        border-color: #7c5cfc;
        transform: translateY(-3px);
        box-shadow: 0 8px 28px rgba(124,92,252,.15);
      }
      .pn-role-card:hover::after { opacity: 1; }
      .pn-role-icon { font-size: 2.1rem; margin-bottom: .5rem; display: block; }
      .pn-role-name { font-size: .88rem; font-weight: 800; color: #12103a; margin-bottom: .2rem; }
      .pn-role-desc { font-size: .7rem; color: #9ca3af; line-height: 1.4; }

      /* ── Google btn ── */
      .pn-google-btn {
        width: 100%; padding: .78rem;
        background: #ffffff;
        border: 1.5px solid #e5e7eb;
        border-radius: 50px; color: #374151;
        font-size: .88rem; font-weight: 600;
        cursor: pointer; display: flex; align-items: center; justify-content: center; gap: .55rem;
        transition: all .22s; font-family: inherit; margin-bottom: .9rem;
        box-shadow: 0 1px 4px rgba(0,0,0,.06);
      }
      .pn-google-btn:hover {
        background: #f9fafb;
        border-color: #d1d5db;
        box-shadow: 0 4px 12px rgba(0,0,0,.1);
        transform: translateY(-1px);
      }
      .pn-google-btn svg { flex-shrink: 0; }

      /* ── Divider ── */
      .pn-divider-text {
        display: flex; align-items: center; gap: .7rem;
        font-size: .7rem; color: #d1d5db; font-weight: 600;
        letter-spacing: .06em; margin: .8rem 0 1rem;
      }
      .pn-divider-text::before, .pn-divider-text::after {
        content: ''; flex: 1; height: 1px; background: #f0f0f8;
      }

      /* ── Back btn ── */
      .pn-back {
        background: none; border: none; color: #9ca3af;
        font-size: .8rem; cursor: pointer; display: flex; align-items: center; gap: .35rem;
        padding: 0; margin-bottom: 1.4rem; transition: color .2s; font-family: inherit;
      }
      .pn-back:hover { color: #7c5cfc; }

      /* ── Field ── */
      .pn-field { margin-bottom: .85rem; }
      .pn-field label {
        display: block; font-size: .72rem; font-weight: 700;
        color: #6b7280; text-transform: uppercase;
        letter-spacing: .07em; margin-bottom: .38rem;
      }
      .pn-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; }
      .pn-field input, .pn-field select {
        width: 100%; padding: .8rem 1rem;
        background: #f9f8ff;
        border: 1.5px solid #e5e0ff;
        border-radius: 12px; color: #12103a;
        font-size: .87rem; font-family: inherit;
        transition: border-color .2s, box-shadow .2s; outline: none;
      }
      .pn-field input:focus, .pn-field select:focus {
        border-color: #7c5cfc;
        background: #fff;
        box-shadow: 0 0 0 3px rgba(124,92,252,.1);
      }
      .pn-field input::placeholder { color: #c4b5fd; }
      .pn-field select option { background: #fff; color: #12103a; }
      .pn-field .pn-pw-wrap { position: relative; }
      .pn-field .pn-pw-wrap input { padding-right: 2.8rem; }
      .pn-pw-toggle {
        position: absolute; right: .85rem; top: 50%; transform: translateY(-50%);
        background: none; border: none; color: #c4b5fd;
        cursor: pointer; font-size: .75rem; padding: 0; transition: color .2s; font-family: inherit;
      }
      .pn-pw-toggle:hover { color: #7c5cfc; }

      /* ── Strength bar ── */
      .pn-strength { height: 3px; border-radius: 3px; margin-top: .4rem; transition: all .3s; background: #f0eeff; }
      .pn-strength-label { font-size: .65rem; color: #9ca3af; margin-top: .25rem; }

      /* ── Password hints ── */
      .pn-pw-hints { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .5rem; }
      .pn-pw-hint {
        font-size: .65rem; padding: .18rem .5rem; border-radius: 999px;
        background: #f5f3ff; border: 1px solid #e5e0ff;
        color: #9ca3af; transition: all .2s;
      }
      .pn-pw-hint.ok { background: rgba(74,222,128,.1); border-color: rgba(34,197,94,.3); color: #16a34a; }

      /* ── Terms ── */
      .pn-terms {
        display: flex; align-items: flex-start; gap: .6rem; margin-bottom: .9rem;
        font-size: .75rem; color: #6b7280; line-height: 1.5; cursor: pointer;
      }
      .pn-terms input[type=checkbox] { margin-top: .15rem; accent-color: #7c5cfc; flex-shrink: 0; }
      .pn-terms a { color: #7c5cfc; text-decoration: none; }
      .pn-terms a:hover { color: #5b3fd4; text-decoration: underline; }

      /* ── Submit btn (animated gradient, light) ── */
      .pn-btn {
        width: 100%; padding: .9rem;
        background: linear-gradient(135deg, #7c5cfc 0%, #3d6bff 50%, #7c5cfc 100%);
        background-size: 200% 100%;
        color: #fff; border: none; border-radius: 50px;
        font-size: .92rem; font-weight: 700; cursor: pointer;
        transition: background-position .4s ease, filter .2s, transform .2s, opacity .2s, box-shadow .2s;
        box-shadow: 0 6px 24px rgba(124,92,252,.35), 0 0 0 0 rgba(124,92,252,.25);
        font-family: inherit; letter-spacing: .01em; position: relative; overflow: hidden;
        animation: pn-btn-pulse 2.6s ease-in-out infinite;
      }
      @keyframes pn-btn-pulse {
        0%,100% { box-shadow: 0 6px 24px rgba(124,92,252,.35), 0 0 0 0 rgba(124,92,252,.25); }
        50%      { box-shadow: 0 8px 28px rgba(124,92,252,.5), 0 0 0 6px rgba(124,92,252,0); }
      }
      .pn-btn::after {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(105deg,transparent 30%,rgba(255,255,255,.18) 50%,transparent 70%);
        transform: translateX(-120%); transition: transform .5s ease;
      }
      .pn-btn:hover::after { transform: translateX(120%); }
      .pn-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-2px); background-position: 100% 0;
        box-shadow: 0 12px 32px rgba(124,92,252,.5); }
      .pn-btn:active:not(:disabled) { transform: translateY(0); }
      .pn-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; filter: none; animation: none; }

      /* ── Alerts ── */
      .pn-err {
        background: #fef2f2; border: 1px solid #fecaca;
        border-radius: 10px; padding: .65rem .9rem;
        font-size: .8rem; color: #dc2626; margin-bottom: .85rem;
        display: none; line-height: 1.5;
      }
      .pn-ok {
        background: #f0fdf4; border: 1px solid #bbf7d0;
        border-radius: 10px; padding: .65rem .9rem;
        font-size: .8rem; color: #16a34a; margin-bottom: .85rem; display: none;
      }

      /* ── Switch link ── */
      .pn-switch {
        text-align: center; font-size: .8rem; color: #9ca3af; margin-top: 1rem;
      }
      .pn-switch a { color: #7c5cfc; font-weight: 700; text-decoration: none; cursor: pointer; transition: color .2s; }
      .pn-switch a:hover { color: #5b3fd4; text-decoration: underline; }

      /* ── Forgot pw ── */
      .pn-forgot {
        text-align: right; font-size: .72rem; margin-top: -.4rem; margin-bottom: .85rem;
        color: #9ca3af;
      }
      .pn-forgot a { color: #7c5cfc; text-decoration: none; cursor: pointer; transition: color .2s; }
      .pn-forgot a:hover { color: #5b3fd4; text-decoration: underline; }

      /* ── OTP inputs ── */
      .pn-otp-wrap { display: flex; gap: .5rem; justify-content: center; margin-bottom: 1.4rem; }
      .pn-otp-input {
        width: 44px; height: 52px; text-align: center; font-size: 1.35rem; font-weight: 800;
        background: #f9f8ff; border: 1.5px solid #e5e0ff;
        border-radius: 12px; color: #12103a; outline: none; font-family: inherit;
        transition: border-color .2s, box-shadow .2s;
      }
      .pn-otp-input:focus { border-color: #7c5cfc; box-shadow: 0 0 0 3px rgba(124,92,252,.12); }
      .pn-otp-resend { text-align: center; font-size: .77rem; color: #9ca3af; margin-top: .75rem; }
      .pn-otp-resend a { color: #7c5cfc; font-weight: 700; cursor: pointer; text-decoration: none; }

      /* ── Success screen ── */
      .pn-success { text-align: center; padding: 1rem 0; }
      .pn-success-icon { font-size: 4rem; margin-bottom: 1rem; animation: pn-pop .5s cubic-bezier(.34,1.56,.64,1); }
      @keyframes pn-pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      .pn-success h3 { font-size: 1.5rem; font-weight: 900; color: #12103a; margin-bottom: .5rem; }
      .pn-success p { font-size: .85rem; color: #6b7280; margin-bottom: 1.5rem; line-height: 1.6; }

      /* ── Mentor info note ── */
      .pn-info-note {
        background: #faf9ff; border: 1px solid #e5e0ff;
        border-radius: 12px; padding: .85rem 1rem; font-size: .78rem;
        color: #6b7280; line-height: 1.6; margin-bottom: 1rem;
      }
      .pn-info-note strong { color: #7c5cfc; }

      /* ── Responsive ── */
      @media (max-width: 480px) {
        .pn-box { padding: 1.8rem 1.3rem; border-radius: 20px; }
        .pn-role-cards { grid-template-columns: 1fr; }
        .pn-title { font-size: 1.4rem; }
        .pn-field-row { grid-template-columns: 1fr; }
      }

      /* ── Profile dropdown extra styles ── */
      .pd-header {
        display: flex; align-items: center; gap: .75rem;
        padding: .75rem 1rem .6rem; pointer-events: none;
      }
      .pd-avatar-sm {
        width: 36px; height: 36px; border-radius: 50%;
        background: linear-gradient(135deg,#7c5cfc,#3d6bff);
        display: flex; align-items: center; justify-content: center;
        font-size: .9rem; font-weight: 800; color: #fff; flex-shrink: 0; overflow: hidden;
      }
      .pd-user-name { font-size: .85rem; font-weight: 700; color: var(--txt); line-height: 1.2; }
      .pd-user-email { font-size: .72rem; color: var(--txt3); }
      .pd-divider { height: 1px; background: var(--border); margin: .3rem 0; }

      /* ── Footer extra styles ── */
      .footer-inner {
        max-width: 1100px; margin: 0 auto;
        display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 2.5rem;
        padding: 3.5rem 1.5rem 3rem; align-items: start;
      }
      .footer-tagline { font-size: .84rem; color: var(--txt4); line-height: 1.75; max-width: 280px; margin-top: .75rem; }
      .footer-contacts { display: flex; flex-direction: column; gap: .45rem; margin-top: 1rem; }
      .footer-ssl-badge {
        display: inline-flex; align-items: center; gap: .4rem;
        font-size: .72rem; color: var(--txt4); font-weight: 500; margin-top: .75rem;
        background: rgba(74,222,128,.06); border: 1px solid rgba(74,222,128,.15);
        border-radius: 999px; padding: .25rem .65rem;
      }
      @media (max-width: 768px) {
        .footer-inner { grid-template-columns: 1fr; gap: 2rem; }
      }

      /* ── Nav scrolled state ── */
      nav.scrolled {
        height: 66px;
        background: rgba(6,4,20,0.92) !important;
        box-shadow: 0 4px 24px rgba(0,0,0,.35);
      }
      :root[data-theme="light"] nav.scrolled {
        background: rgba(255,255,255,0.96) !important;
      }

      /* ── Active nav link indicator ── */
      .nav-link-item.active {
        color: var(--txt) !important;
        font-weight: 700 !important;
      }
      .nav-link-item { color: var(--txt3); font-size: .875rem; font-weight: 500; text-decoration: none; letter-spacing: .02em; position: relative; padding-bottom: 2px; transition: color .25s; }
      .nav-link-item::after { content: ''; position: absolute; bottom: -2px; left: 0; width: 0; height: 1.5px; background: var(--grad); border-radius: 2px; transition: width .3s cubic-bezier(.4,0,.2,1); }
      .nav-link-item:hover { color: var(--txt); }
      .nav-link-item:hover::after, .nav-link-item.active::after { width: 100%; }
    `;
    document.head.appendChild(style);

    /* ── HTML ── */
    const wrap = document.createElement('div');
    wrap.id = 'pn-auth-modal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Sign in to SkillUpNow');

    wrap.innerHTML = `
      <div class="pn-box" role="document">
        <button class="pn-close" id="pn-close-btn" aria-label="Close">✕</button>

        <!-- ═══════════ WELCOME / LOGIN ROLE SELECT ═══════════ -->
        <div id="pn-v-welcome">
          <div class="pn-brand">
            <div class="pn-brand-logo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            <span class="pn-brand-name">SkillUpNow</span>
            <span class="pn-badge">Secure</span>
          </div>
          <div class="pn-title">Welcome <span>Back</span></div>
          <div class="pn-sub">Sign in to continue your learning journey</div>

          <button class="pn-google-btn" onclick="window._pnGoogleAuth()">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <div class="pn-divider-text">OR SIGN IN AS</div>

          <div class="pn-role-cards">
            <div class="pn-role-card" onclick="window._pnView('student-login')" role="button" tabindex="0">
              <span class="pn-role-icon">📚</span>
              <div class="pn-role-name">Student</div>
              <div class="pn-role-desc">Access your learning dashboard</div>
            </div>
            <div class="pn-role-card" onclick="window._pnView('mentor-login')" role="button" tabindex="0">
              <span class="pn-role-icon">🎓</span>
              <div class="pn-role-name">Mentor</div>
              <div class="pn-role-desc">Manage batches &amp; classes</div>
            </div>
          </div>

          <div class="pn-switch">New to SkillUpNow? <a onclick="window._pnView('signup-role')">Create Free Account →</a></div>
        </div>

        <!-- ═══════════ STUDENT LOGIN ═══════════ -->
        <div id="pn-v-student-login" style="display:none">
          <button class="pn-back" onclick="window._pnView('welcome')">← Back</button>
          <div class="pn-title">Student <span>Login</span></div>
          <div class="pn-sub">Access your courses and learning dashboard</div>

          <button class="pn-google-btn" onclick="window._pnGoogleAuth()">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </button>
          <div class="pn-divider-text">OR</div>

          <div class="pn-err" id="pn-sl-err"></div>
          <div class="pn-field"><label>Email Address</label><input type="email" id="pn-sl-email" placeholder="you@example.com" autocomplete="email"></div>
          <div class="pn-field">
            <label>Password</label>
            <div class="pn-pw-wrap">
              <input type="password" id="pn-sl-pw" placeholder="Your password" autocomplete="current-password">
              <button class="pn-pw-toggle" type="button" onclick="window._pnTogglePw('pn-sl-pw',this)">Show</button>
            </div>
          </div>
          <div class="pn-forgot"><a onclick="window._pnForgotPw()">Forgot password?</a></div>
          <button class="pn-btn" id="pn-sl-btn" onclick="window._pnStudentLogin()">Sign In to Dashboard</button>
          <div class="pn-switch">No account? <a onclick="window._pnView('signup-student')">Sign up free →</a></div>
        </div>

        <!-- ═══════════ MENTOR LOGIN ═══════════ -->
        <div id="pn-v-mentor-login" style="display:none">
          <button class="pn-back" onclick="window._pnView('welcome')">← Back</button>
          <div class="pn-title">Mentor <span>Login</span></div>
          <div class="pn-sub">Access your teaching portal and batch management</div>

          <button class="pn-google-btn" onclick="window._pnGoogleAuth()">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </button>
          <div class="pn-divider-text">OR</div>

          <div class="pn-err" id="pn-ml-err"></div>
          <div class="pn-field"><label>Email Address</label><input type="email" id="pn-ml-email" placeholder="you@example.com" autocomplete="email"></div>
          <div class="pn-field">
            <label>Password</label>
            <div class="pn-pw-wrap">
              <input type="password" id="pn-ml-pw" placeholder="Your password" autocomplete="current-password">
              <button class="pn-pw-toggle" type="button" onclick="window._pnTogglePw('pn-ml-pw',this)">Show</button>
            </div>
          </div>
          <div class="pn-forgot"><a onclick="window._pnForgotPw()">Forgot password?</a></div>
          <button class="pn-btn" id="pn-ml-btn" onclick="window._pnMentorLogin()">Sign In to Portal</button>
          <div class="pn-switch">Not a mentor yet? <a href="javascript:void(0)" onclick="window._pnClose();window.location.href=window.profileNav?.pagesPfx+'mentor-signup.html'">Apply to become one →</a></div>
        </div>

        <!-- ═══════════ SIGNUP ROLE SELECT ═══════════ -->
        <div id="pn-v-signup-role" style="display:none">
          <button class="pn-back" onclick="window._pnView('welcome')">← Back</button>
          <div class="pn-title">Join <span>SkillUpNow</span></div>
          <div class="pn-sub">Create your free account — choose your role to get started</div>

          <button class="pn-google-btn" onclick="window._pnGoogleAuth()">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign up with Google
          </button>
          <div class="pn-divider-text">OR CREATE AS</div>

          <div class="pn-role-cards">
            <div class="pn-role-card" onclick="window._pnView('signup-student')" role="button" tabindex="0">
              <span class="pn-role-icon">📚</span>
              <div class="pn-role-name">Student</div>
              <div class="pn-role-desc">Enroll in courses &amp; learn</div>
            </div>
            <div class="pn-role-card" onclick="window._pnClose();window.location.href=(window.profileNav?.pagesPfx||'pages/')+'mentor-signup.html'" role="button" tabindex="0">
              <span class="pn-role-icon">🎓</span>
              <div class="pn-role-name">Mentor</div>
              <div class="pn-role-desc">Teach &amp; earn with SkillUpNow</div>
            </div>
          </div>
          <div class="pn-switch">Already have an account? <a onclick="window._pnView('welcome')">Sign in →</a></div>
        </div>

        <!-- ═══════════ STUDENT SIGNUP ═══════════ -->
        <div id="pn-v-signup-student" style="display:none">
          <button class="pn-back" onclick="window._pnView('signup-role')">← Back</button>
          <div class="pn-title">Student <span>Sign Up</span></div>
          <div class="pn-sub">Start your learning journey — it's free</div>

          <div class="pn-err" id="pn-ss-err"></div>
          <div class="pn-ok"  id="pn-ss-ok"></div>

          <div class="pn-field-row">
            <div class="pn-field"><label>First Name *</label><input type="text" id="pn-ss-fname" placeholder="First name" autocomplete="given-name"></div>
            <div class="pn-field"><label>Last Name *</label><input type="text" id="pn-ss-lname" placeholder="Last name" autocomplete="family-name"></div>
          </div>
          <div class="pn-field"><label>Email Address *</label><input type="email" id="pn-ss-email" placeholder="you@example.com" autocomplete="email"></div>
          <div class="pn-field"><label>Phone Number *</label><input type="tel" id="pn-ss-phone" placeholder="+91 98765 43210" autocomplete="tel"></div>
          <div class="pn-field">
            <label>Password * (min. 8 chars)</label>
            <div class="pn-pw-wrap">
              <input type="password" id="pn-ss-pw" placeholder="Create a strong password" autocomplete="new-password" oninput="window._pnStrength('pn-ss-pw','pn-ss-strength','pn-ss-strength-lbl','pn-ss-hints')">
              <button class="pn-pw-toggle" type="button" onclick="window._pnTogglePw('pn-ss-pw',this)">Show</button>
            </div>
            <div class="pn-strength" id="pn-ss-strength"></div>
            <div class="pn-strength-label" id="pn-ss-strength-lbl"></div>
            <div class="pn-pw-hints" id="pn-ss-hints">
              <span class="pn-pw-hint" data-rule="len">8+ chars</span>
              <span class="pn-pw-hint" data-rule="upper">Uppercase</span>
              <span class="pn-pw-hint" data-rule="num">Number</span>
              <span class="pn-pw-hint" data-rule="special">Special char</span>
            </div>
          </div>
          <div class="pn-field">
            <label>Confirm Password *</label>
            <div class="pn-pw-wrap">
              <input type="password" id="pn-ss-cpw" placeholder="Re-enter your password" autocomplete="new-password">
              <button class="pn-pw-toggle" type="button" onclick="window._pnTogglePw('pn-ss-cpw',this)">Show</button>
            </div>
          </div>
          <label class="pn-terms">
            <input type="checkbox" id="pn-ss-terms">
            I agree to the <a href="#" onclick="return false">Terms of Service</a> and <a href="#" onclick="return false">Privacy Policy</a>
          </label>
          <button class="pn-btn" id="pn-ss-btn" onclick="window._pnStudentRegister()">Create Student Account</button>
          <div class="pn-switch">Already have an account? <a onclick="window._pnView('student-login')">Sign in →</a></div>
        </div>

        <!-- ═══════════ MENTOR SIGNUP (basic) ═══════════ -->
        <div id="pn-v-signup-mentor" style="display:none">
          <button class="pn-back" onclick="window._pnView('signup-role')">← Back</button>
          <div class="pn-title">Mentor <span>Sign Up</span></div>
          <div class="pn-sub">Create your account, then complete your mentor profile</div>

          <div class="pn-info-note">
            <strong>Two-step process:</strong> First create your account below, then you'll be guided to submit your qualifications, PAN card, Aadhaar, certificates, and other documents for admin approval.
          </div>

          <div class="pn-err" id="pn-sm-err"></div>
          <div class="pn-ok"  id="pn-sm-ok"></div>

          <div class="pn-field-row">
            <div class="pn-field"><label>First Name *</label><input type="text" id="pn-sm-fname" placeholder="First name" autocomplete="given-name"></div>
            <div class="pn-field"><label>Last Name *</label><input type="text" id="pn-sm-lname" placeholder="Last name" autocomplete="family-name"></div>
          </div>
          <div class="pn-field"><label>Email Address *</label><input type="email" id="pn-sm-email" placeholder="you@example.com" autocomplete="email"></div>
          <div class="pn-field"><label>Phone Number *</label><input type="tel" id="pn-sm-phone" placeholder="+91 98765 43210" autocomplete="tel"></div>
          <div class="pn-field"><label>Primary Expertise *</label>
            <select id="pn-sm-expertise">
              <option value="">Select your main domain…</option>
              <option>Web Development</option><option>Data Science / ML</option>
              <option>Cloud Computing</option><option>DevOps / SRE</option>
              <option>Cybersecurity</option><option>Mobile Development</option>
              <option>UI/UX Design</option><option>Digital Marketing</option>
              <option>Finance / Accounting</option><option>Other</option>
            </select>
          </div>
          <div class="pn-field">
            <label>Password * (min. 8 chars)</label>
            <div class="pn-pw-wrap">
              <input type="password" id="pn-sm-pw" placeholder="Create a strong password" autocomplete="new-password" oninput="window._pnStrength('pn-sm-pw','pn-sm-strength','pn-sm-strength-lbl',null)">
              <button class="pn-pw-toggle" type="button" onclick="window._pnTogglePw('pn-sm-pw',this)">Show</button>
            </div>
            <div class="pn-strength" id="pn-sm-strength"></div>
            <div class="pn-strength-label" id="pn-sm-strength-lbl"></div>
          </div>
          <label class="pn-terms">
            <input type="checkbox" id="pn-sm-terms">
            I agree to the <a href="#" onclick="return false">Mentor Terms</a> and understand the approval process
          </label>
          <button class="pn-btn" id="pn-sm-btn" onclick="window._pnMentorRegister()">Create & Continue to Application →</button>
          <div class="pn-switch">Already a mentor? <a onclick="window._pnView('mentor-login')">Sign in →</a></div>
        </div>

        <!-- ═══════════ OTP VERIFICATION ═══════════ -->
        <div id="pn-v-otp" style="display:none">
          <button class="pn-back" id="pn-otp-back" onclick="window._pnView('signup-student')">← Back</button>
          <div class="pn-title">Verify <span>Email</span></div>
          <div class="pn-sub" id="pn-otp-sub">Enter the 6-digit code sent to your email</div>
          <div class="pn-err" id="pn-otp-err"></div>
          <div class="pn-otp-wrap">
            <input class="pn-otp-input" id="pn-otp-0" maxlength="1" inputmode="numeric" pattern="[0-9]">
            <input class="pn-otp-input" id="pn-otp-1" maxlength="1" inputmode="numeric" pattern="[0-9]">
            <input class="pn-otp-input" id="pn-otp-2" maxlength="1" inputmode="numeric" pattern="[0-9]">
            <input class="pn-otp-input" id="pn-otp-3" maxlength="1" inputmode="numeric" pattern="[0-9]">
            <input class="pn-otp-input" id="pn-otp-4" maxlength="1" inputmode="numeric" pattern="[0-9]">
            <input class="pn-otp-input" id="pn-otp-5" maxlength="1" inputmode="numeric" pattern="[0-9]">
          </div>
          <button class="pn-btn" id="pn-otp-btn" onclick="window._pnVerifyOtp()">Verify & Create Account</button>
          <div class="pn-otp-resend">Didn't receive it? <a onclick="window._pnResendOtp()">Resend code</a></div>
        </div>

        <!-- ═══════════ SUCCESS SCREEN ═══════════ -->
        <div id="pn-v-success" style="display:none">
          <div class="pn-success">
            <div class="pn-success-icon" id="pn-success-icon">🎉</div>
            <h3 id="pn-success-title">You're In!</h3>
            <p id="pn-success-msg">Your account has been created. Redirecting you now…</p>
            <button class="pn-btn" id="pn-success-btn" onclick="window._pnClose()">Continue →</button>
          </div>
        </div>

      </div><!-- /.pn-box -->
    `;
    document.body.appendChild(wrap);

    /* ── Close button ── */
    document.getElementById('pn-close-btn').addEventListener('click', () => window._pnClose());

    /* ── Close on backdrop click ── */
    wrap.addEventListener('click', e => { if (e.target === wrap) window._pnClose(); });

    /* ── Keyboard ── */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') window._pnClose();
      if (e.key === 'Enter' && e.target.classList.contains('pn-role-card')) e.target.click();
    });

    /* ── OTP auto-advance ── */
    for (let i = 0; i < 6; i++) {
      const inp = document.getElementById('pn-otp-' + i);
      if (!inp) continue;
      inp.addEventListener('input', () => {
        const v = inp.value.replace(/\D/g, '');
        inp.value = v.slice(-1);
        if (v && i < 5) document.getElementById('pn-otp-' + (i+1))?.focus();
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !inp.value && i > 0) document.getElementById('pn-otp-' + (i-1))?.focus();
      });
    }

    /* ── Enter key submit in forms ── */
    wrap.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return;
      const active = ['pn-v-student-login','pn-v-mentor-login','pn-v-signup-student','pn-v-signup-mentor']
        .find(id => document.getElementById(id)?.style.display !== 'none');
      if (!active) return;
      const map = {
        'pn-v-student-login': () => window._pnStudentLogin(),
        'pn-v-mentor-login':  () => window._pnMentorLogin(),
        'pn-v-signup-student':() => window._pnStudentRegister(),
        'pn-v-signup-mentor': () => window._pnMentorRegister(),
      };
      if (map[active]) map[active]();
    });

    /* ══════════════════════════════════════════
       GLOBAL HANDLER FUNCTIONS
       ══════════════════════════════════════════ */
    const self = this;

    const ALL_VIEWS = ['pn-v-welcome','pn-v-student-login','pn-v-mentor-login',
                       'pn-v-signup-role','pn-v-signup-student','pn-v-signup-mentor',
                       'pn-v-otp','pn-v-success'];

    window._pnView = (view) => {
      ALL_VIEWS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === 'pn-v-' + view) ? '' : 'none';
      });
      // Clear alerts when switching
      ['pn-sl-err','pn-ml-err','pn-ss-err','pn-ss-ok','pn-sm-err','pn-sm-ok','pn-otp-err'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.textContent = ''; }
      });
    };

    window._pnClose = () => {
      document.getElementById('pn-auth-modal')?.classList.remove('pn-open');
    };

    window._pnOpen = (startView = 'welcome') => {
      window._pnView(startView);
      document.getElementById('pn-auth-modal')?.classList.add('pn-open');
    };

    window._pnTogglePw = (inputId, btn) => {
      const inp = document.getElementById(inputId);
      if (!inp) return;
      const isText = inp.type === 'text';
      inp.type = isText ? 'password' : 'text';
      btn.textContent = isText ? 'Show' : 'Hide';
    };

    window._pnForgotPw = async () => {
      const emailEl = document.getElementById('pn-sl-email') || document.getElementById('pn-ml-email');
      const email = emailEl?.value?.trim() || prompt('Enter your email address to reset password:');
      if (!email) return;
      if (!window.supabaseConfig) return;
      try {
        const { error } = await window.supabaseConfig.client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/index.html'
        });
        if (error) throw error;
        alert('Password reset link sent to ' + email + '. Check your inbox.');
      } catch (e) {
        alert('Error: ' + e.message);
      }
    };

    /* ── Password strength ── */
    window._pnStrength = (inputId, barId, lblId, hintsId) => {
      const val = document.getElementById(inputId)?.value || '';
      const rules = {
        len:     val.length >= 8,
        upper:   /[A-Z]/.test(val),
        num:     /\d/.test(val),
        special: /[^A-Za-z0-9]/.test(val),
      };
      const score = Object.values(rules).filter(Boolean).length;
      const bar = document.getElementById(barId);
      const lbl = document.getElementById(lblId);
      if (bar) {
        const w = ['0%','30%','55%','80%','100%'][score];
        const c = ['rgba(255,255,255,.06)','#ef4444','#f59e0b','#22c55e','#4ade80'][score];
        bar.style.width = w; bar.style.background = c;
      }
      if (lbl) {
        const labels = ['','Weak','Fair','Good','Strong'];
        lbl.textContent = val ? (labels[score] || '') : '';
        lbl.style.color = ['','#ef4444','#f59e0b','#22c55e','#4ade80'][score];
      }
      if (hintsId) {
        document.querySelectorAll(`#${hintsId} .pn-pw-hint`).forEach(h => {
          h.classList.toggle('ok', !!rules[h.dataset.rule]);
        });
      }
    };

    /* ── Google OAuth ── */
    window._pnGoogleAuth = async () => {
      if (!window.supabaseConfig) return;
      try {
        const redirectTo = window.location.origin + (window.location.pathname.endsWith('index.html') ? window.location.pathname : '/index.html');
        const { error } = await window.supabaseConfig.client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo }
        });
        if (error) throw error;
      } catch (e) {
        alert('Google sign-in failed: ' + e.message);
      }
    };

    /* ── Student Login ── */
    window._pnStudentLogin = async () => {
      const email = document.getElementById('pn-sl-email')?.value?.trim();
      const pw    = document.getElementById('pn-sl-pw')?.value;
      const err   = document.getElementById('pn-sl-err');
      const btn   = document.getElementById('pn-sl-btn');
      if (!email || !pw) { return _pnErr(err, 'Email and password are required.'); }
      btn.disabled = true; btn.textContent = 'Signing in…';
      err.style.display = 'none';
      try {
        if (!window.supabaseConfig) throw new Error('Auth service not ready. Refresh and try again.');
        const r = await window.supabaseConfig.signIn(email, pw);
        if (!r.success) throw new Error(r.error || 'Incorrect email or password.');
        const user = r.data?.user || r.user;
        if (!user) throw new Error('Login failed — no user returned.');
        self.currentUser = user;
        self.showLoggedInUI();
        window._pnClose();
        window.location.reload();
      } catch(e) { _pnErr(err, e.message); btn.disabled = false; btn.textContent = 'Sign In to Dashboard'; }
    };

    /* ── Mentor Login ── */
    window._pnMentorLogin = async () => {
      const email = document.getElementById('pn-ml-email')?.value?.trim();
      const pw    = document.getElementById('pn-ml-pw')?.value;
      const err   = document.getElementById('pn-ml-err');
      const btn   = document.getElementById('pn-ml-btn');
      if (!email || !pw) { return _pnErr(err, 'Email and password are required.'); }
      btn.disabled = true; btn.textContent = 'Signing in…';
      err.style.display = 'none';
      try {
        if (!window.supabaseConfig) throw new Error('Auth service not ready. Refresh and try again.');
        const r = await window.supabaseConfig.signIn(email, pw);
        if (!r.success) throw new Error(r.error || 'Incorrect email or password.');
        const user = r.data?.user || r.user;
        if (!user) throw new Error('Login failed — no user returned.');
        self.currentUser = user;
        self.showLoggedInUI();
        window._pnClose();
        // Route: check mentor record
        const { data: mentor } = await window.supabaseConfig.client
          .from('mentors').select('id,approval_status').eq('user_id', user.id).maybeSingle();
        if (mentor?.approval_status === 'approved') {
          window.location.href = self.pagesPfx + 'mentor-dashboard.html';
        } else if (mentor) {
          alert('Your mentor application is ' + (mentor.approval_status || 'under review') + '. You will be notified once approved.');
          window.location.reload();
        } else {
          // Has account but no mentor record — prompt to apply
          if (confirm('No mentor application found. Would you like to apply as a mentor?')) {
            window.location.href = self.pagesPfx + 'mentor-signup.html';
          } else { window.location.reload(); }
        }
      } catch(e) { _pnErr(err, e.message); btn.disabled = false; btn.textContent = 'Sign In to Portal'; }
    };

    /* ── Student Register (EmailJS OTP flow) ── */
    window._pnStudentRegister = async () => {
      const fname  = document.getElementById('pn-ss-fname')?.value?.trim();
      const lname  = document.getElementById('pn-ss-lname')?.value?.trim();
      const email  = document.getElementById('pn-ss-email')?.value?.trim();
      const phone  = document.getElementById('pn-ss-phone')?.value?.trim();
      const pw     = document.getElementById('pn-ss-pw')?.value;
      const cpw    = document.getElementById('pn-ss-cpw')?.value;
      const terms  = document.getElementById('pn-ss-terms')?.checked;
      const err    = document.getElementById('pn-ss-err');
      const btn    = document.getElementById('pn-ss-btn');

      if (!fname || !lname) return _pnErr(err, 'Please enter your full name.');
      if (!email)           return _pnErr(err, 'Email address is required.');
      if (!phone)           return _pnErr(err, 'Phone number is required.');
      if (pw.length < 8)    return _pnErr(err, 'Password must be at least 8 characters.');
      if (pw !== cpw)       return _pnErr(err, 'Passwords do not match.');
      if (!terms)           return _pnErr(err, 'Please agree to the Terms of Service to continue.');

      btn.disabled = true; btn.textContent = 'Creating account…';
      err.style.display = 'none';

      const fullName = fname + ' ' + lname;

      try {
        if (!window.supabaseConfig) throw new Error('Auth service not ready. Refresh and try again.');

        // Create account in Supabase
        const r = await window.supabaseConfig.signUp(email, pw, {
          full_name: fullName, email, phone, role: 'student'
        });
        if (!r.success) throw new Error(r.error || 'Registration failed. This email may already be registered.');

        // If no email confirmation needed → sign in and redirect
        if (r.data?.session || r.data?.user?.email_confirmed_at) {
          const lr = await window.supabaseConfig.signIn(email, pw);
          if (lr.success) { self.currentUser = lr.data?.user || lr.user; self.showLoggedInUI(); }
          _pnShowSuccess('🎉', "You're In!", 'Your student account is ready. Welcome to SkillUpNow!', () => {
            window._pnClose();
            window.location.href = self.pagesPfx + 'profile.html';
          });
          return;
        }

        // Email confirmation required — store pending data then send OTP
        self._pendingOtpEmail = email;
        self._pendingOtpRole  = 'student';
        self._pendingOtpData  = { full_name: fullName, email, phone, pw };
        document.getElementById('pn-otp-back').onclick = () => window._pnView('signup-student');

        try {
          const otp = window._pnOtpGenerate();
          window._pnOtpStore(email, otp);
          await window._pnOtpSend(email, fullName, otp);
          document.getElementById('pn-otp-sub').textContent = 'We sent a 6-digit code to ' + email + '. Check your inbox.';
        } catch (_emailErr) {
          // EmailJS not configured yet — Supabase already sent its own confirmation email
          document.getElementById('pn-otp-sub').textContent = 'A confirmation link/code was sent to ' + email + '. Check your inbox.';
        }
        window._pnView('otp');
      } catch(e) {
        _pnErr(err, e.message);
      }
      btn.disabled = false; btn.textContent = 'Create Student Account';
    };

    /* ── Mentor Register (basic — then redirect to full signup) ── */
    window._pnMentorRegister = async () => {
      const fname     = document.getElementById('pn-sm-fname')?.value?.trim();
      const lname     = document.getElementById('pn-sm-lname')?.value?.trim();
      const email     = document.getElementById('pn-sm-email')?.value?.trim();
      const phone     = document.getElementById('pn-sm-phone')?.value?.trim();
      const expertise = document.getElementById('pn-sm-expertise')?.value;
      const pw        = document.getElementById('pn-sm-pw')?.value;
      const terms     = document.getElementById('pn-sm-terms')?.checked;
      const err       = document.getElementById('pn-sm-err');
      const btn       = document.getElementById('pn-sm-btn');

      if (!fname || !lname)  return _pnErr(err, 'Please enter your full name.');
      if (!email)            return _pnErr(err, 'Email address is required.');
      if (!phone)            return _pnErr(err, 'Phone number is required.');
      if (!expertise)        return _pnErr(err, 'Please select your primary expertise area.');
      if (pw.length < 8)     return _pnErr(err, 'Password must be at least 8 characters.');
      if (!terms)            return _pnErr(err, 'Please agree to the Mentor Terms to continue.');

      btn.disabled = true; btn.textContent = 'Creating account…';
      err.style.display = 'none';
      try {
        if (!window.supabaseConfig) throw new Error('Auth service not ready. Refresh and try again.');
        const r = await window.supabaseConfig.signUp(email, pw, {
          full_name: fname + ' ' + lname, email, phone, role: 'mentor',
          expertise_area: expertise,
        });
        if (!r.success) throw new Error(r.error || 'Registration failed.');

        // Auto sign-in if possible
        try {
          const lr = await window.supabaseConfig.signIn(email, pw);
          if (lr.success) { const u = lr.data?.user || lr.user; self.currentUser = u; self.showLoggedInUI(); }
        } catch(_) {}

        _pnShowSuccess('🎓', 'Account Created!',
          'Now complete your mentor application — upload your qualifications and documents for admin approval.',
          () => { window._pnClose(); window.location.href = self.pagesPfx + 'mentor-signup.html'; }
        );
      } catch(e) { _pnErr(err, e.message); btn.disabled = false; btn.textContent = 'Create & Continue to Application →'; }
    };

    /* ── OTP Verify (EmailJS custom OTP) ── */
    window._pnVerifyOtp = async () => {
      const entered = [0,1,2,3,4,5].map(i => document.getElementById('pn-otp-'+i)?.value || '').join('');
      const err     = document.getElementById('pn-otp-err');
      const btn     = document.getElementById('pn-otp-btn');
      if (entered.length < 6) return _pnErr(err, 'Please enter the complete 6-digit code.');
      if (!self._pendingOtpEmail) return _pnErr(err, 'Session expired. Please start again.');
      btn.disabled = true; btn.textContent = 'Verifying…';
      err.style.display = 'none';
      try {
        // Verify our custom OTP
        if (!window._pnOtpVerify(self._pendingOtpEmail, entered)) {
          throw new Error('Invalid or expired code. Please try again or resend.');
        }
        sessionStorage.removeItem('pn_otp');

        if (!window.supabaseConfig) throw new Error('Auth service not ready.');
        const d = self._pendingOtpData || {};

        // Create the Supabase account now (email confirm OFF in Supabase)
        const r = await window.supabaseConfig.signUp(d.email, d.pw, {
          full_name: d.full_name, email: d.email, phone: d.phone, role: 'student'
        });
        if (!r.success) throw new Error(r.error || 'Account creation failed.');

        // Sign in immediately
        const lr = await window.supabaseConfig.signIn(d.email, d.pw);
        if (lr.success) {
          const user = lr.data?.user || lr.user;
          self.currentUser = user;
          self.showLoggedInUI();
        }

        _pnShowSuccess('🎉', "You're Verified!", 'Account confirmed! Taking you to your dashboard.', () => {
          window._pnClose();
          window.location.href = self.pagesPfx + 'profile.html';
        });
      } catch(e) { _pnErr(err, e.message); btn.disabled = false; btn.textContent = 'Verify & Create Account'; }
    };

    /* ── OTP Resend (regenerate + re-send via EmailJS) ── */
    window._pnResendOtp = async () => {
      if (!self._pendingOtpEmail) return;
      try {
        const d = self._pendingOtpData || {};
        const otp = window._pnOtpGenerate();
        window._pnOtpStore(self._pendingOtpEmail, otp);
        await window._pnOtpSend(self._pendingOtpEmail, d.full_name || 'User', otp);
        alert('✅ A new code has been sent to ' + self._pendingOtpEmail);
      } catch(e) { alert('Failed to resend: ' + e.message); }
    };

    /* ── Helpers ── */
    function _pnErr(el, msg) {
      if (el) { el.textContent = msg; el.style.display = ''; }
    }
    function _pnShowSuccess(icon, title, msg, cb) {
      document.getElementById('pn-success-icon').textContent = icon;
      document.getElementById('pn-success-title').textContent = title;
      document.getElementById('pn-success-msg').textContent = msg;
      const btn = document.getElementById('pn-success-btn');
      if (cb) btn.onclick = cb;
      window._pnView('success');
      setTimeout(cb, 2200);
    }
  }

  /* ── Auth session ── */
  async checkUserSession() {
    // If supabase not ready yet, poll briefly then give up (show logged-out state)
    if (!window.supabaseConfig) {
      let tries = 0;
      await new Promise(resolve => {
        const t = setInterval(() => {
          if (window.supabaseConfig || ++tries > 15) { clearInterval(t); resolve(); }
        }, 200);
      });
    }
    try {
      if (!window.supabaseConfig) { this.showLoggedOutUI(); return; }
      const user = await window.supabaseConfig.getCurrentUser();
      if (user) { this.currentUser = user; this.showLoggedInUI(); }
      else       { this.showLoggedOutUI(); }
    } catch(e) {
      console.error('Session check error:', e);
      this.showLoggedOutUI();
    }
  }

  showLoggedInUI() {
    const ps  = document.getElementById('profile-section');
    const lw  = document.getElementById('login-wrapper');
    if (ps) { ps.style.display = 'flex'; ps.style.alignItems = 'center'; }
    if (lw)   lw.style.display = 'none';

    const btn = document.getElementById('profile-btn');
    const pdName  = document.getElementById('pd-name');
    const pdEmail = document.getElementById('pd-email');
    const pdAvatar = document.getElementById('pd-avatar-sm');
    if (btn && this.currentUser) {
      const email = this.currentUser.email || '';
      const namePart = email.split('@')[0] || 'U';
      const initial = namePart.charAt(0).toUpperCase();
      btn.textContent = initial;
      btn.title = 'Signed in as ' + email;
      if (pdEmail) pdEmail.textContent = email;

      // Load profile picture + display name
      if (window.supabaseConfig) {
        window.supabaseConfig.getUserProfile(this.currentUser.id).then(pr => {
          const pic  = pr?.data?.profile_picture_url;
          const name = pr?.data?.full_name || namePart;
          if (pdName)  pdName.textContent  = name;
          if (pdAvatar) pdAvatar.textContent = name.charAt(0).toUpperCase();
          if (pic) {
            // Avatar button
            btn.textContent = '';
            btn.style.padding = '0'; btn.style.overflow = 'hidden';
            const img = document.createElement('img');
            img.src = pic;
            img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
            img.onerror = () => { btn.textContent = initial; btn.style.padding = ''; btn.style.overflow = ''; };
            btn.appendChild(img);
            // Avatar in dropdown
            if (pdAvatar) {
              pdAvatar.textContent = '';
              const img2 = document.createElement('img');
              img2.src = pic;
              img2.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
              img2.onerror = () => { pdAvatar.textContent = initial; };
              pdAvatar.appendChild(img2);
            }
          }
        }).catch(() => {});
      }
    }
    this.checkMentorStatus();
    this.checkAdminStatus();
  }

  showLoggedOutUI() {
    const ps = document.getElementById('profile-section');
    const lw = document.getElementById('login-wrapper');
    if (ps) ps.style.display = 'none';
    if (lw) { lw.style.display = 'flex'; lw.style.alignItems = 'center'; }
  }

  checkAdminStatus() {
    if (!window.supabaseConfig || !this.currentUser) return;
    window.supabaseConfig.checkAdminAccess(this.currentUser.id)
      .then(r => {
        if (r?.isAdmin) {
          const al = document.getElementById('dd-admin-link');
          if (al) al.style.display = 'flex';
        }
      }).catch(() => {});
  }

  checkMentorStatus() {
    if (!window.supabaseConfig || !this.currentUser) return;
    window.supabaseConfig.client
      .from('mentors').select('id,approval_status').eq('user_id', this.currentUser.id).maybeSingle()
      .then(({ data }) => {
        if (data?.approval_status === 'approved') {
          const ml = document.getElementById('dd-mentor-link');
          if (ml) ml.style.display = 'flex';
        }
      }).catch(() => {});
  }

  /* ── Public API ── */
  openLoginModal() {
    if (typeof window._pnOpen === 'function') { window._pnOpen('welcome'); return; }
    this.injectAuthModal();
    setTimeout(() => window._pnOpen?.('welcome'), 50);
  }

  openRegister() {
    if (typeof window._pnOpen === 'function') { window._pnOpen('signup-role'); return; }
    this.injectAuthModal();
    setTimeout(() => window._pnOpen?.('signup-role'), 50);
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
  setupLoginDropdown() {}
}

document.addEventListener('DOMContentLoaded', () => {
  window.profileNav = new ProfileNavigationManager();
});
