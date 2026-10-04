/* Core: boots the Rust/WebAssembly cipher and holds small byte helpers.
   Classic script on purpose: module scripts do not load from file://. */
(function () {
  'use strict';

  const utf8 = new TextEncoder();
  const utf8Strict = new TextDecoder('utf-8', { fatal: true });

  function b64ToBytes(b64) {
    let bin;
    try {
      bin = atob(b64.replace(/\s+/g, ''));
    } catch (_) {
      throw new Error('not valid base64');
    }
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToB64(bytes) {
    let s = '';
    // Chunked: String.fromCharCode.apply overflows the stack on large arrays.
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function toHex(bytes, groupBytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) {
      if (groupBytes && i && i % groupBytes === 0) s += ' ';
      s += bytes[i].toString(16).padStart(2, '0');
    }
    return s.toUpperCase();
  }

  function fromHex(str, what) {
    const clean = str.replace(/\s+/g, '');
    const label = what || 'hex';
    if (!/^[0-9a-fA-F]*$/.test(clean)) {
      const bad = clean.match(/[^0-9a-fA-F]/)[0];
      throw new Error(`${label}: “${bad}” is not a hex digit`);
    }
    if (clean.length % 2) throw new Error(`${label}: odd number of hex digits (${clean.length})`);
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }

  function word(n) {
    return n.toString(16).toUpperCase().padStart(4, '0');
  }

  function wordsOf(bytes) {
    const w = [];
    for (let i = 0; i + 1 < bytes.length; i += 2) w.push((bytes[i] << 8) | bytes[i + 1]);
    return w;
  }

  function randomBytes(n) {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return b;
  }

  /** A 128-bit key from user input; throws an Error that says what is wrong. */
  function parseKey(fmt, value) {
    if (fmt === 'hex') {
      const b = fromHex(value, 'key');
      if (b.length !== 16) throw new Error(`key: need 32 hex digits (128 bits), got ${b.length * 2}`);
      return b;
    }
    const b = utf8.encode(value);
    if (b.length !== 16) {
      const wide = b.length !== Array.from(value).length ? ' — letters outside ASCII take 2–4 bytes' : '';
      throw new Error(`key: need exactly 16 bytes, got ${b.length}${wide}`);
    }
    return b;
  }

  /** Wires a .seg button group; returns { get(), set(v), disable(bool) }. */
  function seg(el, onChange) {
    const buttons = Array.from(el.querySelectorAll('button'));
    let value = (buttons.find(b => b.classList.contains('on')) || buttons[0]).dataset.v;
    function set(v, silent) {
      value = v;
      buttons.forEach(b => {
        const on = b.dataset.v === v;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      });
      if (!silent && onChange) onChange(v);
    }
    buttons.forEach(b => {
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => { if (!b.disabled) set(b.dataset.v); });
    });
    set(value, true);
    return {
      get: () => value,
      set,
      disable(flag) { buttons.forEach(b => { b.disabled = flag; }); },
    };
  }

  const ready = (async () => {
    if (typeof wasm_bindgen === 'undefined' || !window.IDEA_WASM_BASE64) {
      throw new Error('cipher module missing (assets/wasm)');
    }
    await wasm_bindgen({ module_or_path: b64ToBytes(window.IDEA_WASM_BASE64) });
    return wasm_bindgen;
  })();

  window.IDEA = {
    ready, utf8, utf8Strict, b64ToBytes, bytesToB64, toHex, fromHex, word, wordsOf, randomBytes, parseKey, seg,
  };
})();
