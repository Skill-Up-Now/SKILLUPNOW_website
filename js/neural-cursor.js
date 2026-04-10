/**
 * Neural Pointer — AI Neural Entity Cursor System
 * Visual Style: Neon + Glassmorphism + AI Neural Energy
 * States: IDLE | HOVER | TEXT | PROCESSING
 * Rendering: Canvas API + requestAnimationFrame (60fps+)
 */
(function () {
  'use strict';

  // ── Mobile/touch: skip entirely ──────────────────────────────
  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

  // ── Color constants ───────────────────────────────────────────
  const C = {
    cyan:   '#00F0FF',
    blue:   '#0A2BE2',
    purple: '#8A55FF',
    pink:   '#CC00EE',
    white:  '#FFFFFF',
  };

  // ── States ────────────────────────────────────────────────────
  const ST = { IDLE: 0, HOVER: 1, TEXT: 2, PROCESSING: 3 };

  // ── Hover selector ────────────────────────────────────────────
  const HOVER_SEL = 'a, button, [role="button"], .course-card, .ftab, ' +
    '.hero-cta, .nav-signin, .nav-cta, label, select, ' +
    '[onclick], [tabindex]:not([tabindex="-1"])';

  // ── DOM setup ─────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = 'nc-canvas';
  Object.assign(canvas.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100vw', height: '100vh',
    pointerEvents: 'none',
    zIndex: '999997',
    willChange: 'transform',
  });

  const style = document.createElement('style');
  style.textContent = `
    *, a, button, input, select, textarea, label {
      cursor: none !important;
    }
    /* Undo cursor:none inside iframes or canvas elements */
    canvas { cursor: default !important; }
    @media (hover: none) and (pointer: coarse) {
      *, a, button, input, select, textarea, label { cursor: auto !important; }
      #nc-canvas { display: none !important; }
    }
  `;

  // ── Particle pool ─────────────────────────────────────────────
  const MAX_PARTICLES = 180;

  // ── Click ripple pool ─────────────────────────────────────────
  const ripples = [];

  // ── Processing node config ────────────────────────────────────
  const PROC_NODES = Array.from({ length: 6 }, (_, i) => ({
    baseAngle: (i / 6) * Math.PI * 2,
    angle: (i / 6) * Math.PI * 2,
    r: 20 + (i % 2) * 5,
    speed: 0.018 + i * 0.003,
    size: 2 + (i % 3) * 0.8,
  }));

  // ═══════════════════════════════════════════════════════════════
  //  MAIN CLASS
  // ═══════════════════════════════════════════════════════════════
  class NeuralCursor {
    constructor() {
      // Raw + lerped mouse coords
      this.mx = -300; this.my = -300;
      this.lx = -300; this.ly = -300;

      // Velocity (smoothed)
      this.dvx = 0; this.dvy = 0;

      // State machine
      this.state = ST.IDLE;
      this.prevState = ST.IDLE;
      this.morphT = 1;        // 0 = start of transition, 1 = settled

      // Oscillation phase (idle breathing)
      this.osc = 0;

      // Processing rotation phase
      this.procAngle = 0;

      // Particles array
      this.particles = [];

      // Time counter
      this.t = 0;

      // Visibility
      this.visible = true;

      // Click state
      this.clicking = false;

      this._bindEvents();
      this._resize();
      this._raf();
    }

    // ── Event wiring ───────────────────────────────────────────
    _bindEvents() {
      window.addEventListener('resize', () => this._resize());

      document.addEventListener('mousemove', e => {
        this.mx = e.clientX;
        this.my = e.clientY;
      });

      // State transitions via delegation
      document.addEventListener('mouseover', e => {
        if (e.target.closest('input, textarea')) {
          this._setState(ST.TEXT);
        } else if (e.target.closest(HOVER_SEL)) {
          this._setState(ST.HOVER);
        }
      });

      document.addEventListener('mouseout', e => {
        const left = e.target.closest('input, textarea')
          ? ST.TEXT
          : e.target.closest(HOVER_SEL)
          ? ST.HOVER
          : null;
        if (left !== null && this.state === left) {
          this._setState(ST.IDLE);
        }
      });

      document.addEventListener('focusin', e => {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
          this._setState(ST.TEXT);
        }
      });

      document.addEventListener('focusout', () => {
        if (this.state === ST.TEXT) this._setState(ST.IDLE);
      });

      document.addEventListener('mousedown', () => {
        this.clicking = true;
        this._spawnClick();
      });
      document.addEventListener('mouseup', () => { this.clicking = false; });

      document.addEventListener('mouseleave', () => { this.visible = false; });
      document.addEventListener('mouseenter', () => { this.visible = true; });
    }

    // ── Resize canvas ─────────────────────────────────────────
    _resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    // ── State machine ─────────────────────────────────────────
    _setState(s) {
      if (this.state === s) return;
      this.prevState = this.state;
      this.state = s;
      this.morphT = 0;
    }

    // ── Public API: set processing mode ───────────────────────
    setProcessing(on) {
      this._setState(on ? ST.PROCESSING : ST.IDLE);
    }

    // ── Click burst ───────────────────────────────────────────
    _spawnClick() {
      ripples.push({ x: this.lx, y: this.ly, r: 0, alpha: 1 });
      for (let i = 0; i < 14; i++) {
        const a  = (i / 14) * Math.PI * 2;
        const sp = 2.5 + Math.random() * 3;
        this._addParticle({
          x: this.lx, y: this.ly,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 1, decay: 0.035 + Math.random() * 0.03,
          size: 2 + Math.random() * 1.5,
          col: [C.cyan, C.purple, C.pink][i % 3],
          type: 'burst',
        });
      }
    }

    // ── Particle factory ──────────────────────────────────────
    _addParticle(p) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      this.particles.push(p);
    }

    // ── Spawn ambient particles per state ─────────────────────
    _spawnAmbient() {
      const s = this.state;
      const rate = s === ST.HOVER ? 0.55 : s === ST.PROCESSING ? 0.45 : 0.28;
      if (Math.random() > rate) return;

      if (s === ST.TEXT) {
        // Binary digit particles drifting vertically
        this._addParticle({
          x: this.lx + (Math.random() - 0.5) * 10,
          y: this.ly + (Math.random() - 0.5) * 24,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 2.5,
          life: 1, decay: 0.022,
          size: 7,
          col: Math.random() > 0.5 ? C.cyan : C.purple,
          type: 'bit',
          char: Math.random() > 0.5 ? '1' : '0',
        });
        return;
      }

      if (s === ST.PROCESSING) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 2.5;
        this._addParticle({
          x: this.lx, y: this.ly,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 1, decay: 0.018,
          size: 1.5,
          col: C.cyan,
          type: 'orb',
        });
        return;
      }

      // Trail particles (IDLE / HOVER)
      const sp = s === ST.HOVER ? 1.6 : 1.0;
      this._addParticle({
        x: this.lx + (Math.random() - 0.5) * 5,
        y: this.ly + (Math.random() - 0.5) * 5,
        vx: -this.dvx * 0.4 + (Math.random() - 0.5) * sp,
        vy: -this.dvy * 0.4 + (Math.random() - 0.5) * sp,
        life: 1, decay: s === ST.HOVER ? 0.028 : 0.038,
        size: s === ST.HOVER ? 2.5 : 2,
        col: [C.cyan, C.purple, C.pink][Math.floor(Math.random() * 3)],
        type: 'trail',
      });
    }

    // ── lerp helper ───────────────────────────────────────────
    _lerp(a, b, t) { return a + (b - a) * t; }

    // ═════════════════════════════════════════════════════════
    //  MAIN ANIMATION LOOP
    // ═════════════════════════════════════════════════════════
    _raf() {
      const ctx = canvas.getContext('2d');
      const loop = () => {
        this.t += 0.016;
        this.osc += 0.04;
        this.procAngle += 0.022;
        if (this.morphT < 1) this.morphT = Math.min(1, this.morphT + 0.07);

        // Smooth cursor position
        const spd = this.state === ST.HOVER ? 0.22 : 0.14;
        const plx = this.lx, ply = this.ly;
        this.lx = this._lerp(this.lx, this.mx, spd);
        this.ly = this._lerp(this.ly, this.my, spd);

        // Smoothed velocity
        const rawVx = this.lx - plx, rawVy = this.ly - ply;
        this.dvx = this._lerp(this.dvx, rawVx, 0.25);
        this.dvy = this._lerp(this.dvy, rawVy, 0.25);

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (this.visible) {
          this._spawnAmbient();
          this._drawParticles(ctx);
          this._drawRipples(ctx);
          this._drawCursor(ctx);
        }

        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    // ── Draw particles ────────────────────────────────────────
    _drawParticles(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }

        ctx.globalAlpha = p.life * 0.85;

        if (p.type === 'bit') {
          ctx.fillStyle = p.col;
          ctx.shadowColor = p.col;
          ctx.shadowBlur = 6;
          ctx.font = `bold ${p.size}px monospace`;
          ctx.fillText(p.char, p.x, p.y);
        } else {
          const s = p.size * p.life;
          ctx.fillStyle = p.col;
          ctx.shadowColor = p.col;
          ctx.shadowBlur = p.type === 'burst' ? 8 : 5;
          ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }
      }
      ctx.restore();
    }

    // ── Click ripples ─────────────────────────────────────────
    _drawRipples(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r  += 3.5;
        rp.alpha -= 0.04;
        if (rp.alpha <= 0) { ripples.splice(i, 1); continue; }
        ctx.globalAlpha = rp.alpha * 0.6;
        ctx.strokeStyle = C.cyan;
        ctx.shadowColor = C.cyan;
        ctx.shadowBlur  = 10;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Route cursor drawing ──────────────────────────────────
    _drawCursor(ctx) {
      const x = this.lx + Math.sin(this.osc * 1.7) * 0.35;
      const y = this.ly + Math.cos(this.osc * 2.0) * 0.35;
      const mt = this.morphT;
      const s  = this.state;
      const ps = this.prevState;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Cross-fade during transition
      if (mt < 1) {
        ctx.globalAlpha = 1 - mt;
        this._drawState(ctx, x, y, ps);
        ctx.globalAlpha = mt;
        this._drawState(ctx, x, y, s);
      } else {
        ctx.globalAlpha = 1;
        this._drawState(ctx, x, y, s);
      }

      ctx.restore();
    }

    _drawState(ctx, x, y, s) {
      switch (s) {
        case ST.IDLE:       this._drawArrow(ctx, x, y, false); break;
        case ST.HOVER:      this._drawArrow(ctx, x, y, true);  break;
        case ST.TEXT:       this._drawIBeam(ctx, x, y);        break;
        case ST.PROCESSING: this._drawProcessing(ctx, x, y);   break;
      }
    }

    // ─────────────────────────────────────────────────────────
    //  CURSOR SHAPES
    // ─────────────────────────────────────────────────────────

    // 1. Arrow (IDLE & HOVER) ───────────────────────────────────
    _drawArrow(ctx, x, y, hover) {
      const sc   = hover ? (1.12 + Math.sin(this.t * 3) * 0.02) : 1;
      const glow = hover ? 22 : 14;
      const breathe = 1 + Math.sin(this.osc * 2) * 0.06;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sc * breathe, sc * breathe);

      // Outer aura
      const aura = ctx.createRadialGradient(5, 9, 1, 5, 9, glow);
      aura.addColorStop(0, `rgba(0,240,255,${hover ? 0.28 : 0.16})`);
      aura.addColorStop(0.5, `rgba(138,85,255,${hover ? 0.14 : 0.08})`);
      aura.addColorStop(1, 'rgba(106,9,145,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(5, 9, glow, 0, Math.PI * 2);
      ctx.fill();

      // Arrow fill gradient
      const ag = ctx.createLinearGradient(0, 0, 13, 21);
      ag.addColorStop(0,   C.cyan);
      ag.addColorStop(0.4, C.purple);
      ag.addColorStop(1,   C.pink);

      ctx.shadowColor = hover ? C.cyan : C.purple;
      ctx.shadowBlur  = hover ? 18 : 10;

      // Classic arrow polygon (hotspot = top-left tip)
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 17);
      ctx.lineTo(4.5, 13);
      ctx.lineTo(7.5, 20);
      ctx.lineTo(10, 19);
      ctx.lineTo(7, 12);
      ctx.lineTo(13, 12);
      ctx.closePath();
      ctx.fill();

      // Glassmorphism inner edge highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth   = 0.7;
      ctx.shadowBlur  = 0;
      ctx.beginPath();
      ctx.moveTo(0.8, 0.8);
      ctx.lineTo(0.8, 14);
      ctx.lineTo(4.8, 10.5);
      ctx.stroke();

      // Top-tip bright pixel
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(0, 0, 2, 2);

      ctx.restore();
    }

    // 2. I-Beam (TEXT) ─────────────────────────────────────────
    _drawIBeam(ctx, x, y) {
      const flicker = 0.75 + Math.sin(this.t * 18) * 0.25;
      const H = 26, W = 11, B = 3;

      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha *= flicker;

      // Outer glow
      const ig = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
      ig.addColorStop(0,   C.cyan);
      ig.addColorStop(0.5, '#ffffff');
      ig.addColorStop(1,   C.cyan);

      ctx.shadowColor = C.purple;
      ctx.shadowBlur  = 14;
      ctx.fillStyle   = ig;

      // Top cap
      ctx.fillRect(-W / 2, -H / 2, W, B);
      // Stem
      ctx.fillRect(-1, -H / 2 + B, 2, H - B * 2);
      // Bottom cap
      ctx.fillRect(-W / 2, H / 2 - B, W, B);

      // Scan line
      const scanY = Math.sin(this.t * 10) * (H / 2 - 5);
      ctx.globalAlpha *= 0.45;
      ctx.strokeStyle = C.cyan;
      ctx.shadowColor = C.cyan;
      ctx.shadowBlur  = 6;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(-W / 2, scanY);
      ctx.lineTo(W / 2, scanY);
      ctx.stroke();

      ctx.restore();
    }

    // 3. Neural Processing ─────────────────────────────────────
    _drawProcessing(ctx, x, y) {
      ctx.save();
      ctx.translate(x, y);

      const pulse = 5 + Math.sin(this.t * 5) * 2.5;

      // Core
      const cg = ctx.createRadialGradient(0, 0, 0.5, 0, 0, pulse);
      cg.addColorStop(0,   '#ffffff');
      cg.addColorStop(0.35, C.cyan);
      cg.addColorStop(1,   'transparent');
      ctx.shadowColor = C.cyan;
      ctx.shadowBlur  = 24;
      ctx.fillStyle   = cg;
      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.fill();

      // Compute node positions
      const nodes = PROC_NODES.map(n => {
        n.angle += n.speed;
        return {
          x: Math.cos(n.angle) * n.r,
          y: Math.sin(n.angle) * n.r,
          size: n.size,
        };
      });

      // Connection lines between adjacent nodes
      ctx.shadowBlur = 4;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i], b = nodes[(i + 1) % nodes.length];
        ctx.globalAlpha = 0.25 + Math.sin(this.t * 3 + i) * 0.15;
        ctx.strokeStyle = C.purple;
        ctx.lineWidth   = 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Energy pulses: core → node
      for (let i = 0; i < nodes.length; i++) {
        const n   = nodes[i];
        const frac = (Math.sin(this.t * 4 + i * 1.1) + 1) / 2;
        ctx.globalAlpha = frac * 0.45;
        ctx.strokeStyle = C.cyan;
        ctx.lineWidth   = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(n.x * frac, n.y * frac);
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        ctx.globalAlpha = 0.92;
        ctx.shadowColor = C.cyan;
        ctx.shadowBlur  = 10;
        ctx.fillStyle   = C.cyan;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outer dashed orbit ring
      ctx.globalAlpha = 0.45;
      ctx.shadowColor = C.purple;
      ctx.shadowBlur  = 12;
      ctx.strokeStyle = C.purple;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([4, 8]);
      ctx.lineDashOffset = -(this.t * 35) % 12;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────
  function boot() {
    document.head.appendChild(style);
    document.body.appendChild(canvas);
    window.neuralCursor = new NeuralCursor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
