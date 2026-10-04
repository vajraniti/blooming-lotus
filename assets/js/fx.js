/* Atmosphere: grain, cursor, glitches, scramble, reveal, rail scroll-spy, hero parallax. */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  /* grain: one noise tile, generated here so nothing extra has to load */
  function grain() {
    const c = document.createElement('canvas');
    c.width = c.height = 220;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(220, 220);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    document.querySelector('.grain').style.backgroundImage = `url(${c.toDataURL('image/png')})`;
  }

  /* cursor */
  function cursor() {
    if (!finePointer) { document.body.classList.add('no-cursor'); return; }
    const el = document.querySelector('.cursor');
    const cross = el.querySelector('.cursor-cross');
    const ring = el.querySelector('.cursor-ring');
    let x = -100, y = -100, rx = x, ry = y;
    const hotSel = 'a, button, .rd-node, .sk, .drop, .round-tabs button, .relic';
    window.addEventListener('mousemove', e => {
      x = e.clientX; y = e.clientY;
      cross.style.left = x + 'px'; cross.style.top = y + 'px';
      const t = e.target;
      el.classList.toggle('text', !!t.closest('input, textarea'));
      el.classList.toggle('hot', !!t.closest(hotSel));
    }, { passive: true });
    document.addEventListener('mouseleave', () => { x = y = -100; });
    (function loop() {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      requestAnimationFrame(loop);
    })();
  }

  /* glitch on titles: when they enter the view, on hover, and now and then */
  function glitches() {
    const els = Array.from(document.querySelectorAll('[data-glitch]'));
    els.forEach(el => {
      el.dataset.text = el.innerText;
      el.addEventListener('animationend', e => { if (e.target === el) el.classList.remove('glitch'); });
      el.addEventListener('mouseenter', () => fire(el));
    });
    function fire(el) {
      if (reduced) return;
      el.classList.remove('glitch');
      void el.offsetWidth; // restart the animation
      el.classList.add('glitch');
    }
    const seen = new Set();
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { seen.add(en.target); fire(en.target); } else seen.delete(en.target);
      });
    }, { threshold: 0.6 });
    els.forEach(el => io.observe(el));
    setInterval(() => {
      const vis = Array.from(seen);
      if (vis.length && Math.random() < 0.5) fire(vis[(Math.random() * vis.length) | 0]);
    }, 4200);
  }

  /* scramble: letters fall through hex digits before settling */
  const GLYPHS = '0123456789ABCDEF⊕⊞⊙';
  function scramble(el, finalText, ms) {
    if (reduced) { el.textContent = finalText; return; }
    const dur = ms || 420;
    const start = performance.now();
    if (el._scr) cancelAnimationFrame(el._scr);
    (function step(now) {
      const p = Math.min(1, (now - start) / dur);
      let s = '';
      for (let i = 0; i < finalText.length; i++) {
        const ch = finalText[i];
        s += (ch === ' ' || i < p * finalText.length) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = s;
      if (p < 1) el._scr = requestAnimationFrame(step);
    })(start);
  }
  function scrambles() {
    document.querySelectorAll('[data-scramble]').forEach(el => {
      const text = el.textContent;
      el.closest('a').addEventListener('mouseenter', () => scramble(el, text, 380));
    });
  }

  /* reveal on scroll */
  function reveals() {
    const sel = '.sec .prose, .sec .lede, .ops, .chain, .relic:not(.hero-relic), .round-fig, .bits, .sched, .inv-table, .wounds li, .angels, .lab, .reli, .colophon';
    const els = Array.from(document.querySelectorAll(sel));
    if (reduced) return;
    els.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => io.observe(el));
  }

  /* rail: mark the section that holds the middle of the screen */
  function railSpy() {
    const links = Array.from(document.querySelectorAll('.rail-list a'));
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const secs = Array.from(document.querySelectorAll('main > section'));
    function update() {
      const mid = window.innerHeight * 0.45;
      let cur = null;
      for (const s of secs) {
        const r = s.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) { cur = s.id; break; }
      }
      links.forEach(a => a.classList.toggle('on', map.get(cur) === a));
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* hero: relics drift against the pointer and the scroll */
  function parallax() {
    if (reduced) return;
    const relics = Array.from(document.querySelectorAll('.hero-relic'));
    let mx = 0, my = 0, cx = 0, cy = 0;
    window.addEventListener('mousemove', e => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
    (function loop() {
      cx += (mx - cx) * 0.05; cy += (my - cy) * 0.05;
      const sy = window.scrollY;
      if (sy < window.innerHeight * 1.2) {
        relics.forEach(r => {
          const d = parseFloat(r.dataset.depth || '1');
          r.style.transform = `translate3d(${(-cx * 26 * d).toFixed(2)}px, ${(-cy * 20 * d - sy * 0.12 * d).toFixed(2)}px, 0)`;
        });
      }
      requestAnimationFrame(loop);
    })();
  }

  /* relics tear for a moment when touched */
  function relicTears() {
    document.querySelectorAll('.relic').forEach(r => {
      r.addEventListener('mouseenter', () => {
        if (reduced) return;
        r.classList.remove('glitching'); void r.offsetWidth; r.classList.add('glitching');
      });
      r.addEventListener('animationend', () => r.classList.remove('glitching'));
    });
  }

  window.FX = { scramble, reduced };

  document.addEventListener('DOMContentLoaded', () => {
    grain();
    cursor();
    glitches();
    scrambles();
    reveals();
    railSpy();
    parallax();
    relicTears();
  });
})();
