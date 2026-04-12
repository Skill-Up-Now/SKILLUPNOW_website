/* ══════════════════════════════════════════
   qr-share.js — Public QR Code Share Widget
   Auto-injects a floating share button on any
   page. No login required.
══════════════════════════════════════════ */

(function () {
  /* ── Inject styles ── */
  const style = document.createElement('style');
  style.textContent = `
    /* Floating share button */
    #qrs-fab {
      position: fixed; bottom: 5.5rem; right: 1.5rem; z-index: 8000;
      width: 48px; height: 48px; border-radius: 50%;
      background: var(--grad, linear-gradient(135deg,#7c5cfc,#3d6bff));
      border: none; cursor: pointer; color: #fff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 20px rgba(124,92,252,.45);
      transition: transform .2s, box-shadow .2s;
    }
    #qrs-fab:hover { transform: scale(1.1); box-shadow: 0 10px 28px rgba(124,92,252,.55); }
    #qrs-fab title { display:none; }

    /* Overlay */
    #qrs-overlay {
      position: fixed; inset: 0; z-index: 8100;
      background: rgba(6,3,18,.72);
      backdrop-filter: blur(18px) saturate(1.5);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
      opacity: 0; visibility: hidden;
      transition: opacity .25s, visibility .25s;
    }
    #qrs-overlay.open { opacity: 1; visibility: visible; }

    /* Modal box */
    #qrs-box {
      background: var(--panel, #fff);
      border: 1.5px solid rgba(124,92,252,.28);
      border-radius: 24px;
      padding: 2rem 2rem 1.6rem;
      max-width: 380px; width: 92vw;
      text-align: center;
      position: relative;
      box-shadow: 0 32px 72px rgba(60,20,160,.22);
      transform: scale(.94) translateY(16px);
      transition: transform .28s cubic-bezier(.22,1,.36,1);
    }
    #qrs-overlay.open #qrs-box { transform: scale(1) translateY(0); }

    .qrs-close {
      position: absolute; top: .85rem; right: .85rem;
      width: 30px; height: 30px; border-radius: 50%;
      border: 1.5px solid rgba(124,92,252,.25);
      background: rgba(124,92,252,.08);
      color: var(--v1, #7c5cfc); font-size: .85rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all .18s; font-family: inherit;
    }
    .qrs-close:hover { background: var(--v1, #7c5cfc); color: #fff; transform: rotate(90deg); }

    .qrs-title { font-size: 1.1rem; font-weight: 800; color: var(--txt, #111); margin-bottom: .2rem; }
    .qrs-sub   { font-size: .78rem; color: var(--txt3, #777); margin-bottom: 1.2rem; }

    #qrs-canvas-wrap {
      display: inline-block; padding: 14px; background: #fff;
      border-radius: 16px; border: 2.5px solid rgba(124,92,252,.18);
      box-shadow: 0 6px 22px rgba(124,92,252,.12);
    }
    #qrs-canvas-wrap img,
    #qrs-canvas-wrap canvas { display: block; border-radius: 6px; }

    .qrs-url {
      margin: .9rem 0 .6rem;
      background: rgba(124,92,252,.06); border: 1px solid rgba(124,92,252,.14);
      border-radius: 10px; padding: .5rem .75rem;
      font-size: .7rem; color: var(--txt3, #777);
      word-break: break-all; text-align: left;
    }
    .qrs-btns { display: flex; gap: .55rem; justify-content: center; flex-wrap: wrap; margin-top: .55rem; }
    .qrs-btn {
      padding: .55rem 1.2rem; border-radius: 50px;
      font-size: .8rem; font-weight: 700;
      border: 1.5px solid var(--border, #e5e7eb);
      background: var(--bg, #f9fafb); color: var(--txt3, #555);
      cursor: pointer; transition: all .18s; font-family: inherit;
    }
    .qrs-btn:hover { background: var(--v1, #7c5cfc); border-color: var(--v1, #7c5cfc); color: #fff; }
    .qrs-btn.primary {
      background: var(--grad, linear-gradient(135deg,#7c5cfc,#3d6bff));
      border-color: transparent; color: #fff;
    }
    .qrs-btn.primary:hover { opacity: .88; }
  `;
  document.head.appendChild(style);

  /* ── Load QRCode library ── */
  function loadQRLib(cb) {
    if (window.QRCode) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  /* ── Build floating button ── */
  const fab = document.createElement('button');
  fab.id = 'qrs-fab';
  fab.title = 'Share this page — Download QR';
  fab.setAttribute('aria-label', 'Share this page QR code');
  fab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="20" y="17" width="4" height="4"/><rect x="14" y="14" width="4" height="4"/><rect x="17" y="20" width="4" height="4"/></svg>`;

  /* ── Build modal ── */
  const overlay = document.createElement('div');
  overlay.id = 'qrs-overlay';
  overlay.innerHTML = `
    <div id="qrs-box">
      <button class="qrs-close" id="qrs-close-btn">✕</button>
      <div class="qrs-title">Share This Page</div>
      <div class="qrs-sub">Scan or download the QR code to share this form</div>
      <div id="qrs-canvas-wrap"></div>
      <div class="qrs-url" id="qrs-url-label"></div>
      <div class="qrs-btns">
        <button class="qrs-btn" id="qrs-copy-btn">📋 Copy Link</button>
        <button class="qrs-btn primary" id="qrs-download-btn">⬇ Download QR</button>
      </div>
    </div>`;

  /* ── Insert into DOM after load ── */
  function mount() {
    document.body.appendChild(fab);
    document.body.appendChild(overlay);

    fab.addEventListener('click', openQR);
    document.getElementById('qrs-close-btn').addEventListener('click', closeQR);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeQR(); });
    document.getElementById('qrs-copy-btn').addEventListener('click', copyLink);
    document.getElementById('qrs-download-btn').addEventListener('click', downloadQR);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeQR(); });
  }

  let _qrImg = null;

  function openQR() {
    const url = window.location.href.replace(/\.html($|\?)/, (_, s) => s === '?' ? '?' : '');
    document.getElementById('qrs-url-label').textContent = url;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    loadQRLib(() => {
      const wrap = document.getElementById('qrs-canvas-wrap');
      wrap.innerHTML = '';
      const div = document.createElement('div');
      wrap.appendChild(div);
      const qr = new QRCode(div, {
        text: url, width: 180, height: 180,
        colorDark: '#1a0a3e', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      // Grab the generated img/canvas for download
      setTimeout(() => {
        _qrImg = wrap.querySelector('img') || wrap.querySelector('canvas');
      }, 100);
    });
  }

  function closeQR() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function copyLink() {
    const url = document.getElementById('qrs-url-label').textContent;
    navigator.clipboard?.writeText(url).then(() => {
      const btn = document.getElementById('qrs-copy-btn');
      const orig = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1800);
    }).catch(() => { prompt('Copy this link:', url); });
  }

  function downloadQR() {
    if (!_qrImg) return;
    const link = document.createElement('a');
    link.download = 'skillupnow-qr.png';
    if (_qrImg.tagName === 'IMG') {
      link.href = _qrImg.src;
    } else {
      link.href = _qrImg.toDataURL('image/png');
    }
    link.click();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
