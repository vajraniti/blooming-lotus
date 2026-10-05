/* Sections that explain the cipher: hero echo, operations, the round,
   key schedule, inversion, and the ECB angel. Every number comes from Rust. */
(function () {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'out'];
  const ROUND_WORDS = 24;   // input 4, subkeys 6, steps 14 (layout of wasm `trace`)
  const OUT_BASE = 8 * ROUND_WORDS;

  let W = null;             // wasm exports, set in init()
  const { word, toHex, fromHex } = window.IDEA;
  const { L: tr, plural } = window.I18N;
  const roman = i => (i < 8 ? ROMAN[i] : tr('out', 'вых.'));

  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* hero: the sentence after rounds 0, 2, 5 and 8½ */

  function latin1(bytes) {
    let s = '';
    for (const b of bytes) {
      if (b === 0x20) s += ' ';
      else if ((b > 0x20 && b < 0x7F) || (b > 0xA0 && b !== 0xAD)) s += String.fromCharCode(b);
      else s += '·';
    }
    return s;
  }

  function wordsToBytes(ws) {
    const out = [];
    ws.forEach(w => out.push(w >> 8, w & 0xFF));
    return out;
  }

  function heroEcho() {
    const key = window.IDEA.utf8.encode('seen this angel?');
    const plain = window.IDEA.utf8.encode('can you read me?');
    const lines = [[], [], [], []];
    for (let b = 0; b < plain.length; b += 8) {
      const t = W.trace(key, plain.subarray(b, b + 8), false);
      const after = r => Array.from(t.subarray(r * ROUND_WORDS + 20, r * ROUND_WORDS + 24));
      lines[0].push(...plain.subarray(b, b + 8));
      lines[1].push(...wordsToBytes(after(1)));
      lines[2].push(...wordsToBytes(after(4)));
      lines[3].push(...wordsToBytes(Array.from(t.subarray(OUT_BASE + 8, OUT_BASE + 12))));
    }
    const ps = document.querySelectorAll('#echo p');
    lines.forEach((bytes, i) => {
      const text = latin1(bytes);
      setTimeout(() => window.FX.scramble(ps[i], text, 900), 500 + i * 380);
    });
  }

  /* II. operations */

  function operations() {
    const calcs = {};
    document.querySelectorAll('.op-calc').forEach(c => {
      const [a, b] = c.querySelectorAll('input');
      calcs[c.dataset.op] = { a, b, out: c.querySelector('output') };
    });
    const parse = input => {
      const v = input.value.trim();
      const ok = /^[0-9a-fA-F]{1,4}$/.test(v);
      input.classList.toggle('bad', !ok);
      return ok ? parseInt(v, 16) : null;
    };
    const fns = {
      xor: (a, b) => a ^ b,
      add: (a, b) => (a + b) & 0xFFFF,
      mul: (a, b) => W.mul(a, b),
    };
    const heresy = document.getElementById('heresy');
    function update() {
      const v = {};
      for (const op in calcs) {
        const c = calcs[op];
        const a = parse(c.a), b = parse(c.b);
        v[op] = [a, b];
        c.out.textContent = a === null || b === null ? '····' : word(fns[op](a, b));
      }
      const A = v.mul[0], B = v.add[0], C = v.add[1];
      if (A === null || B === null || C === null) { heresy.textContent = '…'; return; }
      const left = W.mul(A, (B + C) & 0xFFFF);
      const right = (W.mul(A, B) + W.mul(A, C)) & 0xFFFF;
      const rel = left === right ? '=' : '≠';
      heresy.innerHTML =
        `A ⊙ (B ⊞ C) = ${word(left)} <span class="${left === right ? '' : 'no'}">${rel}</span> ${word(right)} = (A ⊙ B) ⊞ (A ⊙ C)` +
        `<br><span class="mono-dim">${tr(`A = ${word(A)} from ⊙, B = ${word(B)} and C = ${word(C)} from ⊞`, `A = ${word(A)} из ⊙, B = ${word(B)} и C = ${word(C)} из ⊞`)}</span>`;
    }
    Object.values(calcs).forEach(c => { c.a.addEventListener('input', update); c.b.addEventListener('input', update); });
    window.I18N.onChange(update);
    update();
  }

  /* III. the round diagram */

  const L = [130, 290, 450, 610];
  const FORMULA = [
    'X1 ⊙ Z1', 'X2 ⊞ Z2', 'X3 ⊞ Z3', 'X4 ⊙ Z4',
    '(1) ⊕ (3)', '(2) ⊕ (4)', '(5) ⊙ Z5', '(6) ⊞ (7)', '(8) ⊙ Z6', '(7) ⊞ (9)',
    '(1) ⊕ (9)', '(3) ⊕ (9)', '(2) ⊕ (10)', '(4) ⊕ (10)',
  ];
  // node: [step, kind, x, y, key index or null]
  const NODES = [
    [1, 'mul', L[0], 130, 0], [2, 'add', L[1], 130, 1], [3, 'add', L[2], 130, 2], [4, 'mul', L[3], 130, 3],
    [5, 'xor', 370, 215, null], [6, 'xor', 530, 255, null],
    [7, 'mul', 370, 320, 4], [8, 'add', 530, 380, null], [9, 'mul', 530, 450, 5], [10, 'add', 370, 520, null],
    [11, 'xor', L[0], 600, null], [12, 'xor', L[2], 600, null], [13, 'xor', L[1], 650, null], [14, 'xor', L[3], 650, null],
  ];
  // value label positions for steps 1..14
  const VAL = {
    1: [L[0] + 10, 180], 2: [L[1] + 10, 180], 3: [L[2] + 10, 180], 4: [L[3] + 10, 180],
    5: [380, 262], 6: [540, 300], 7: [380, 356], 8: [540, 420], 9: [540, 494], 10: [380, 564],
    11: [L[0] + 10, 636], 12: [L[2] + 10, 636], 13: [L[1] + 10, 688], 14: [L[3] + 10, 688],
  };
  // wires: [path d, nodes it touches]
  const WIRES = [
    [`M${L[0]} 58 V114`, [1]], [`M${L[1]} 58 V116`, [2]], [`M${L[2]} 58 V116`, [3]], [`M${L[3]} 58 V114`, [4]],
    [`M${L[0]} 146 V584`, [1, 5, 11]], [`M${L[1]} 144 V636`, [2, 6, 13]],
    [`M${L[2]} 144 V584`, [3, 5, 12]], [`M${L[3]} 146 V636`, [4, 6, 14]],
    [`M${L[0]} 215 H354`, [1, 5]], [`M${L[2]} 215 H386`, [3, 5]],
    [`M${L[1]} 255 H514`, [2, 6]], [`M${L[3]} 255 H546`, [4, 6]],
    ['M370 231 V304', [5, 7]], ['M530 271 V366', [6, 8]],
    ['M370 336 V506', [7, 10]], ['M370 380 H516', [7, 8]],
    ['M530 394 V434', [8, 9]],
    ['M530 466 V600 H146', [9, 11, 12]], ['M530 520 H384', [9, 10]],
    ['M370 534 V650 H306', [10, 13]], ['M370 650 H594', [10, 14]],
    [`M${L[0]} 616 V770`, [11]], [`M${L[3]} 666 V770`, [14]],
    [`M${L[2]} 616 V690 L${L[1]} 750 V770`, [12]], [`M${L[1]} 666 V690 L${L[2]} 750 V770`, [13]],
  ];

  function nodeShape(g, kind, x, y) {
    if (kind === 'add') {
      el('rect', { x: x - 14, y: y - 14, width: 28, height: 28 }, g);
      el('path', { d: `M${x - 8} ${y}H${x + 8}M${x} ${y - 8}V${y + 8}` }, g);
    } else {
      el('circle', { cx: x, cy: y, r: 16 }, g);
      if (kind === 'xor') el('path', { d: `M${x - 16} ${y}H${x + 16}M${x} ${y - 16}V${y + 16}` }, g);
      else el('circle', { cx: x, cy: y, r: 3.2, class: 'dot' }, g);
    }
  }

  function text(parent, x, y, cls, str, anchor) {
    const t = el('text', { x, y, class: cls, 'text-anchor': anchor || 'start' }, parent);
    t.textContent = str;
    return t;
  }

  function buildRoundSvg(host) {
    const svg = el('svg', { viewBox: '40 0 680 830', role: 'img', 'aria-label': 'Diagram of one IDEA round' });
    const wires = WIRES.map(([d, ns]) => {
      const p = el('path', { d, class: 'rd-wire' }, svg);
      p.dataset.n = ns.join(' ');
      return p;
    });
    el('rect', { x: 300, y: 285, width: 290, height: 268, class: 'rd-ma' }, svg);
    text(svg, 584, 546, 'rd-ma-lbl', 'MA', 'end');

    const ins = L.map((x, i) => { text(svg, x, 18, 'rd-lane', `X${i + 1}`, 'middle'); return text(svg, x, 44, 'rd-io', '0000', 'middle'); });
    const outs = L.map((x, i) => { text(svg, x, 818, 'rd-lane', `X${i + 1}′`, 'middle'); return text(svg, x, 794, 'rd-io', '0000', 'middle'); });

    const keys = [];
    const vals = {};
    const nodes = NODES.map(([step, kind, x, y, k]) => {
      const g = el('g', { class: 'rd-node', tabindex: 0 }, svg);
      g.dataset.step = step;
      nodeShape(g, kind, x, y);
      if (k !== null) {
        const right = k === 5;
        const kx = right ? x + 26 : x - 26;
        el('path', { d: right ? `M${x + 16} ${y}H${x + 22}` : `M${x - 22} ${y}H${x - 16}`, class: 'rd-wire' }, svg);
        text(svg, kx, y - 3, 'rd-key', `Z${k + 1}`, right ? 'start' : 'end');
        keys[k] = text(svg, kx, y + 12, 'rd-keyv', '0000', right ? 'start' : 'end');
      }
      vals[step] = text(svg, VAL[step][0], VAL[step][1], 'rd-val', '0000');
      return g;
    });
    host.appendChild(svg);
    return { svg, wires, nodes, ins, outs, keys, vals };
  }

  function buildOutputSvg(host) {
    const svg = el('svg', { viewBox: '40 0 680 420', role: 'img', 'aria-label': 'Diagram of the output transformation' });
    const wires = [
      [`M${L[0]} 58 V214`, [1]], [`M${L[3]} 58 V214`, [4]],
      [`M${L[1]} 58 V90 L${L[2]} 160 V216`, [3]], [`M${L[2]} 58 V90 L${L[1]} 160 V216`, [2]],
      [`M${L[0]} 246 V340`, [1]], [`M${L[1]} 244 V340`, [2]], [`M${L[2]} 244 V340`, [3]], [`M${L[3]} 246 V340`, [4]],
    ].map(([d, ns]) => { const p = el('path', { d, class: 'rd-wire' }, svg); p.dataset.n = ns.join(' '); return p; });
    const ins = L.map((x, i) => { text(svg, x, 18, 'rd-lane', `X${i + 1}`, 'middle'); return text(svg, x, 44, 'rd-io', '0000', 'middle'); });
    const outs = L.map((x, i) => { text(svg, x, 392, 'rd-lane', `Y${i + 1}`, 'middle'); return text(svg, x, 368, 'rd-io', '0000', 'middle'); });
    const keys = [];
    const kinds = ['mul', 'add', 'add', 'mul'];
    const nodes = L.map((x, i) => {
      const g = el('g', { class: 'rd-node', tabindex: 0 }, svg);
      g.dataset.step = i + 1;
      nodeShape(g, kinds[i], x, 230);
      el('path', { d: `M${x - 22} 230H${x - 16}`, class: 'rd-wire' }, svg);
      text(svg, x - 26, 227, 'rd-key', `Z${49 + i}`, 'end');
      keys[i] = text(svg, x - 26, 242, 'rd-keyv', '0000', 'end');
      return g;
    });
    host.appendChild(svg);
    return { svg, wires, nodes, ins, outs, keys };
  }

  const outLabels = [];
  window.I18N.onChange(() => outLabels.forEach(el => { el.textContent = roman(8); }));

  const specimen = { key: null, block: null, dir: 'enc', round: 0, trace: null, listeners: [] };

  function roundSection() {
    const host = document.getElementById('round-svg');
    const full = buildRoundSvg(host);
    const half = buildOutputSvg(host);
    const tabs = document.getElementById('round-tabs');
    const tip = document.getElementById('round-tip');
    const cap = document.getElementById('round-cap');
    const keyIn = document.getElementById('sp-key');
    const blockIn = document.getElementById('sp-block');
    const out = document.getElementById('sp-out');
    const err = document.getElementById('sp-err');

    ROMAN.forEach((r, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab');
      b.addEventListener('click', () => { specimen.round = i; paint(true); });
      tabs.appendChild(b);
    });

    const dirSeg = window.IDEA.seg(document.getElementById('sp-dir'), v => { specimen.dir = v; recompute(); });

    function setVal(t, v, animate) {
      const s = word(v);
      if (t.textContent === s) return;
      if (animate) window.FX.scramble(t, s, 260); else t.textContent = s;
    }

    function hover(view, step, formulaFn) {
      view.nodes.forEach(n => n.classList.toggle('hot', n.dataset.step === String(step)));
      view.wires.forEach(w => w.classList.toggle('hot', step !== null && w.dataset.n.split(' ').includes(String(step))));
      tip.textContent = step === null ? '' : formulaFn(step);
    }

    function bindHover(view, formulaFn) {
      view.nodes.forEach(n => {
        const s = +n.dataset.step;
        n.addEventListener('mouseenter', () => hover(view, s, formulaFn));
        n.addEventListener('focus', () => hover(view, s, formulaFn));
        n.addEventListener('mouseleave', () => hover(view, null));
        n.addEventListener('blur', () => hover(view, null));
      });
    }

    bindHover(full, step => {
      const t = specimen.trace, base = specimen.round * ROUND_WORDS;
      const st = k => t[base + 10 + k - 1];
      const x = i => t[base + i - 1];
      const z = i => t[base + 4 + i - 1];
      const terms = {
        1: [x(1), '⊙', z(1)], 2: [x(2), '⊞', z(2)], 3: [x(3), '⊞', z(3)], 4: [x(4), '⊙', z(4)],
        5: [st(1), '⊕', st(3)], 6: [st(2), '⊕', st(4)], 7: [st(5), '⊙', z(5)], 8: [st(6), '⊞', st(7)],
        9: [st(8), '⊙', z(6)], 10: [st(7), '⊞', st(9)], 11: [st(1), '⊕', st(9)], 12: [st(3), '⊕', st(9)],
        13: [st(2), '⊕', st(10)], 14: [st(4), '⊕', st(10)],
      }[step];
      return `${tr('step', 'шаг')} ${step}: ${FORMULA[step - 1]} = ${word(terms[0])} ${terms[1]} ${word(terms[2])} = ${word(st(step))}`;
    });
    bindHover(half, i => {
      const t = specimen.trace;
      const xin = [t[OUT_BASE], t[OUT_BASE + 2], t[OUT_BASE + 1], t[OUT_BASE + 3]][i - 1];
      const op = i === 1 || i === 4 ? '⊙' : '⊞';
      const src = ['X1', 'X3', 'X2', 'X4'][i - 1];
      return `Y${i} = ${src} ${op} Z${48 + i} = ${word(xin)} ${op} ${word(t[OUT_BASE + 4 + i - 1])} = ${word(t[OUT_BASE + 8 + i - 1])}`;
    });

    function paint(animate) {
      const t = specimen.trace;
      Array.from(tabs.children).forEach((b, i) => {
        b.classList.toggle('on', i === specimen.round);
        b.setAttribute('aria-selected', String(i === specimen.round));
      });
      const isHalf = specimen.round === 8;
      full.svg.style.display = isHalf ? 'none' : '';
      half.svg.style.display = isHalf ? '' : 'none';
      tip.textContent = '';
      if (!t) return;
      if (isHalf) {
        for (let i = 0; i < 4; i++) {
          setVal(half.ins[i], t[OUT_BASE + i], animate);
          setVal(half.keys[i], t[OUT_BASE + 4 + i], animate);
          setVal(half.outs[i], t[OUT_BASE + 8 + i], animate);
        }
        cap.textContent = tr(
          `output transformation: the middle words cross back, then the last four subkeys${specimen.dir === 'dec' ? ' (decryption keys)' : ''}.`,
          `выходное преобразование: средние слова меняются местами обратно, затем идут последние четыре подключа${specimen.dir === 'dec' ? ' (ключи расшифровки)' : ''}.`,
        );
        return;
      }
      const base = specimen.round * ROUND_WORDS;
      for (let i = 0; i < 4; i++) setVal(full.ins[i], t[base + i], animate);
      for (let k = 0; k < 6; k++) setVal(full.keys[k], t[base + 4 + k], animate);
      for (let s = 1; s <= 14; s++) setVal(full.vals[s], t[base + 10 + s - 1], animate);
      const o = [t[base + 20], t[base + 21], t[base + 22], t[base + 23]];
      o.forEach((v, i) => setVal(full.outs[i], v, animate));
      const z0 = specimen.round * 6 + 1;
      cap.textContent = tr(
        `round ${ROMAN[specimen.round]}, subkeys Z${z0}–Z${z0 + 5}${specimen.dir === 'dec' ? ' of the decryption schedule' : ''}. Hover a node.`,
        `раунд ${ROMAN[specimen.round]}, подключи Z${z0}–Z${z0 + 5}${specimen.dir === 'dec' ? ' из расписания для расшифровки' : ''}. Наведите курсор на узел.`,
      );
    }

    function recompute() {
      let key, block;
      try {
        key = fromHex(keyIn.value, 'key');
        if (key.length !== 16) throw new Error(tr(`key: need 32 hex digits, got ${key.length * 2}`, `ключ: нужно 32 hex-цифры, получено ${key.length * 2}`));
        keyIn.classList.remove('bad');
      } catch (e) { keyIn.classList.add('bad'); err.textContent = window.I18N.err(e); return; }
      try {
        block = fromHex(blockIn.value, 'block');
        if (block.length !== 8) throw new Error(tr(`block: need 16 hex digits, got ${block.length * 2}`, `блок: нужно 16 hex-цифр, получено ${block.length * 2}`));
        blockIn.classList.remove('bad');
      } catch (e) { blockIn.classList.add('bad'); err.textContent = window.I18N.err(e); return; }
      err.textContent = '';
      specimen.key = key; specimen.block = block;
      specimen.trace = W.trace(key, block, specimen.dir === 'dec');
      const t = specimen.trace;
      out.textContent = [t[OUT_BASE + 8], t[OUT_BASE + 9], t[OUT_BASE + 10], t[OUT_BASE + 11]].map(word).join(' ');
      paint(false);
      specimen.listeners.forEach(fn => fn());
    }

    keyIn.addEventListener('input', recompute);
    blockIn.addEventListener('input', recompute);
    specimen.load = (keyHex, blockHex, dir) => {
      keyIn.value = keyHex; blockIn.value = blockHex;
      if (dir) { dirSeg.set(dir, true); specimen.dir = dir; }
      specimen.round = 0;
      recompute();
    };
    function relabel() {
      Array.from(tabs.children).forEach((b, i) => {
        b.textContent = roman(i);
        b.setAttribute('aria-label', i < 8 ? tr(`round ${i + 1}`, `раунд ${i + 1}`) : tr('output transformation', 'выходное преобразование'));
      });
    }
    relabel();
    window.I18N.onChange(() => { relabel(); recompute(); });
    recompute();
  }

  /* IV. key schedule */

  function schedule() {
    const bitsHost = document.getElementById('key-bits');
    const bits = [];
    for (let i = 0; i < 128; i++) {
      const s = document.createElement('span');
      if (i && i % 16 === 0) s.classList.add('word-edge');
      bitsHost.appendChild(s);
      bits.push(s);
    }
    const grid = document.getElementById('sched');
    const cells = [];
    const titled = [];
    const head = ['', 'Z1 ⊙', 'Z2 ⊞', 'Z3 ⊞', 'Z4 ⊙', 'Z5 ⊙ MA', 'Z6 ⊙ MA'];
    head.forEach(h => { const d = document.createElement('div'); d.className = 'hd'; d.textContent = h; grid.appendChild(d); });
    for (let r = 0; r < 9; r++) {
      const lab = document.createElement('div');
      lab.className = 'rlab'; lab.textContent = roman(r);
      grid.appendChild(lab);
      if (r === 8) outLabels.push(lab);
      for (let c = 0; c < 6; c++) {
        const i = r * 6 + c;
        const d = document.createElement('div');
        if (i >= 52) { d.className = 'blank'; grid.appendChild(d); continue; }
        d.className = 'sk';
        d.innerHTML = `<small>Z${i + 1}</small><span>0000</span>`;
        const g = Math.floor(i / 8), slot = i % 8;
        const start = (16 * slot + 25 * g) % 128;
        const light = on => {
          for (let k = 0; k < 16; k++) bits[(start + k) % 128].classList.toggle('lit', on);
          d.classList.toggle('lit', on);
        };
        d.addEventListener('mouseenter', () => light(true));
        d.addEventListener('mouseleave', () => light(false));
        titled.push({ d, i, g, start });
        grid.appendChild(d);
        cells.push(d.querySelector('span'));
      }
    }
    function titles() {
      titled.forEach(({ d, i, g, start }) => {
        const end = (start + 15) % 128, wraps = start + 15 > 127;
        d.title = tr(
          `Z${i + 1}: key bits ${start}–${end}${wraps ? ' (wrapping)' : ''}, after ${g} rotation${g === 1 ? '' : 's'} of 25`,
          `Z${i + 1}: биты ключа ${start}–${end}${wraps ? ' (через конец ключа)' : ''}, после ${g} ${plural(g, 'поворота', 'поворотов', 'поворотов')} на 25`,
        );
      });
    }
    titles();
    window.I18N.onChange(titles);
    function update() {
      const key = specimen.key;
      if (!key) return;
      for (let i = 0; i < 128; i++) bits[i].classList.toggle('one', ((key[i >> 3] >> (7 - (i & 7))) & 1) === 1);
      const z = W.subkeys(key);
      cells.forEach((c, i) => { c.textContent = word(z[i]); });
    }
    specimen.listeners.push(update);
    update();
  }

  /* V. inversion table */

  function inversion() {
    const host = document.getElementById('inv-table');
    const head = ['', 'K1 ⊙', 'K2 ⊞', 'K3 ⊞', 'K4 ⊙', 'K5 MA', 'K6 MA'];
    head.forEach(h => { const d = document.createElement('div'); d.className = 'hd'; d.textContent = h; host.appendChild(d); });
    const cells = [];
    for (let i = 0; i <= 8; i++) {
      const lab = document.createElement('div');
      lab.className = 'rlab'; lab.textContent = roman(i);
      host.appendChild(lab);
      if (i === 8) outLabels.push(lab);
      const j = 8 - i;
      const swap = i !== 0 && i !== 8;
      const labels = [
        `Z${6 * j + 1}<i>⁻¹</i>`,
        `<i>−</i>Z${6 * j + (swap ? 3 : 2)}`,
        `<i>−</i>Z${6 * j + (swap ? 2 : 3)}`,
        `Z${6 * j + 4}<i>⁻¹</i>`,
      ];
      if (i < 8) labels.push(`Z${6 * (j - 1) + 5}`, `Z${6 * (j - 1) + 6}`);
      for (let c = 0; c < 6; c++) {
        const d = document.createElement('div');
        if (c < labels.length) {
          d.innerHTML = `<span class="f">${labels[c]}</span><span class="v">0000</span>`;
          cells.push(d.querySelector('.v'));
        }
        host.appendChild(d);
      }
    }
    function update() {
      if (!specimen.key) return;
      const z = W.subkeys(specimen.key);
      cells.forEach((c, i) => { c.textContent = word(z[52 + i]); });
    }
    specimen.listeners.push(update);
    update();
  }

  /* VII. the angel in ECB */

  function angels() {
    const src = window.ANGEL_PIXELS;
    const px = window.IDEA.b64ToBytes(src.base64);
    const draw = (id, bytes) => {
      const c = document.getElementById(id);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(src.width, src.height);
      for (let i = 0; i < bytes.length; i++) {
        const v = bytes[i];
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    const keyOut = document.getElementById('ang-key');
    let last = null;
    const say = () => { if (last) keyOut.textContent = `${tr('key', 'ключ')} ${toHex(last.key, 2)}, IV ${toHex(last.iv)}`; };
    window.I18N.onChange(say);
    function run() {
      const key = window.IDEA.randomBytes(16);
      const iv = window.IDEA.randomBytes(8);
      last = { key, iv };
      say();
      draw('ang-ecb', W.encrypt(key, W.Mode.Ecb, new Uint8Array(0), false, px));
      draw('ang-cbc', W.encrypt(key, W.Mode.Cbc, iv, false, px));
      draw('ang-ctr', W.encrypt(key, W.Mode.Ctr, iv, false, px));
    }
    draw('ang-plain', px);
    document.getElementById('ang-rekey').addEventListener('click', run);
    run();
  }

  window.Anatomy = {
    specimen,
    init(wasm) {
      W = wasm;
      heroEcho();
      operations();
      roundSection();
      schedule();
      inversion();
      angels();
    },
  };
})();
