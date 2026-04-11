/**
 * SkillUpNow — Fast Interaction & Cursor System
 * - System-speed cursor (native, no artificial lag)
 * - Instant click ripple on every interactive element
 * - Keyboard focus ring (visible, branded)
 * - Ultra-fast hover transitions (50 ms)
 */
(function () {
  /* ─── 1. Cursor & interaction CSS ─────────────────────────────── */
  const style = document.createElement('style');
  style.id = 'sn-cursor-style';
  style.textContent = `
    /* ── Reset to system cursor everywhere ── */
    *, *::before, *::after { cursor: default; }

    a, button, [role="button"], [onclick], label[for],
    select, .course-card, .pn-role-card, .filter-tag,
    .pay-option, .emi-month-btn, .nav-item, .nav-link-item,
    .btn-enroll, .btn-pay, .pn-btn, .btn-grad, .btn-outline,
    input[type="submit"], input[type="button"],
    input[type="checkbox"], input[type="radio"],
    .pd-item, .nav-signin, .nav-cta,
    .profile-icon-btn, .pn-close, .em-close, .mcls,
    .mobile-menu-toggle, .pn-back, .pn-switch a, .pn-forgot a,
    [data-section], .stat-card, .table-btn,
    .form-card, .qr-btn, .tab-btn, .action-btn,
    .ahm-item, .ec-btn-primary, .ec-btn-secondary,
    .btn-pay-later, .btn-pay-now, .fc-btn, .nav-logo
    { cursor: pointer !important; }

    input[type="text"], input[type="email"], input[type="password"],
    input[type="tel"], input[type="number"], input[type="search"],
    input[type="url"], input[type="date"],
    textarea, [contenteditable]
    { cursor: text !important; }

    /* ── Ultra-fast hover transitions (50 ms feels instant) ── */
    a, button, [role="button"], .nav-item, .course-card,
    .form-card, .tab-btn, .action-btn, .table-btn,
    .pn-role-card, .fc-btn, .ahm-item
    {
      transition-duration: 50ms !important;
      transition-property: background-color, border-color, color, opacity, box-shadow, transform !important;
    }

    /* ── Keyboard focus ring — branded, high visibility ── */
    :focus-visible {
      outline: 2.5px solid #7c5cfc !important;
      outline-offset: 3px !important;
      border-radius: 6px;
    }
    :focus:not(:focus-visible) { outline: none !important; }

    /* ── Click ripple container ── */
    .sn-ripple-host { position: relative; overflow: hidden; }
    @keyframes sn-ripple {
      0%   { transform: scale(0);   opacity: .45; }
      100% { transform: scale(3.5); opacity: 0;   }
    }
    .sn-ripple-dot {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      width: 80px; height: 80px;
      margin-left: -40px; margin-top: -40px;
      background: rgba(124, 92, 252, 0.35);
      animation: sn-ripple 420ms cubic-bezier(0, 0, 0.2, 1) forwards;
      z-index: 9999;
    }
  `;
  document.head.appendChild(style);

  /* ─── 2. Click ripple on every interactive element ────────────── */
  function spawnRipple(el, clientX, clientY) {
    const rect = el.getBoundingClientRect();
    const dot  = document.createElement('span');
    dot.className = 'sn-ripple-dot';
    dot.style.left = (clientX - rect.left) + 'px';
    dot.style.top  = (clientY - rect.top)  + 'px';

    // Ensure the host can clip the ripple
    const pos = getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';

    el.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
  }

  const RIPPLE_SELECTOR = [
    'button', 'a', '[role="button"]',
    '.nav-item', '.tab-btn', '.action-btn',
    '.table-btn', '.pn-role-card', '.fc-btn',
    '.btn-enroll', '.btn-pay', '.pn-btn',
    '.ahm-item', '.filter-tag',
  ].join(',');

  document.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest(RIPPLE_SELECTOR);
    if (!el) return;
    spawnRipple(el, ev.clientX, ev.clientY);
  }, { passive: true });

  /* ─── 3. Keyboard press visual flash (Enter / Space on focused el) */
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const el = document.activeElement;
    if (!el || el === document.body) return;
    const rect = el.getBoundingClientRect();
    spawnRipple(el, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, { passive: true });

})();
