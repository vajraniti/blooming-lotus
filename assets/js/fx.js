/* Page furniture: a still grain with an off switch, the "you are here" mark
   in the menu, and the digit scramble the hero and the round diagram use. */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GRAIN_KEY = 'idea-grain';

  /* grain: one noise tile drawn here, so nothing extra has to load; it does not move */
  function grain() {
    const layer = document.querySelector('.grain');
    const btn = document.getElementById('grain-toggle');
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
    layer.style.backgroundImage = `url(${c.toDataURL('image/png')})`;

    let on = true;
    try {
      on = localStorage.getItem(GRAIN_KEY) !== 'off';
    } catch (_) { /* storage blocked (private window, file:// policy): keep the default */ }
    function apply() {
      layer.hidden = !on;
      btn.textContent = `grain: ${on ? 'on' : 'off'}`;
      btn.setAttribute('aria-pressed', String(on));
    }
    btn.addEventListener('click', () => {
      on = !on;
      apply();
      try {
        localStorage.setItem(GRAIN_KEY, on ? 'on' : 'off');
      } catch (_) { /* not remembered across visits, the switch still works for this one */ }
    });
    apply();
  }

  /* scramble: digits run through hex before settling; used by the hero and the round diagram */
  const GLYPHS = '0123456789ABCDEF';
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

  /* menu: underline the section that holds the middle of the screen */
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

  window.FX = { scramble, reduced };

  document.addEventListener('DOMContentLoaded', () => {
    grain();
    railSpy();
  });
})();
