/* § VIII text lab and § IX sealed files. */
(function () {
  'use strict';

  const { utf8, utf8Strict, toHex, fromHex, b64ToBytes, bytesToB64, randomBytes, parseKey, seg, word, wordsOf } = window.IDEA;
  const CHUNK = 1 << 20;            // 1 MiB per step keeps the page responsive
  const MAX_FILE = 2 * 1024 ** 3;   // the whole result is held in memory as a Blob
  let W = null;

  const $ = id => document.getElementById(id);
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

  function fmtSize(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KiB`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MiB`;
    return `${(n / 1024 ** 3).toFixed(2)} GiB`;
  }

  /** Live validation of a key input; returns a getter that throws on bad input. */
  function keyField(input, fmtSeg, hint, onChange) {
    function check() {
      try {
        const k = parseKey(fmtSeg.get(), input.value);
        input.classList.remove('bad');
        hint.classList.remove('bad');
        hint.textContent = `128 bits · ${wordsOf(k).map(word).join(' ')}`;
        return k;
      } catch (e) {
        input.classList.toggle('bad', input.value.length > 0);
        hint.classList.toggle('bad', input.value.length > 0);
        hint.textContent = input.value.length ? e.message : '';
        return null;
      }
    }
    input.addEventListener('input', () => { check(); if (onChange) onChange(); });
    return {
      check,
      get() { return parseKey(fmtSeg.get(), input.value); },
    };
  }

  /* ── VIII. lab ──────────────────────────────────────────────────────────── */

  function lab() {
    const keyIn = $('lab-key'), ivIn = $('lab-iv'), plain = $('lab-plain'), cipher = $('lab-cipher');
    const err = $('lab-err'), stat = $('lab-stat');
    let key;
    const keyFmt = seg($('lab-keyfmt'), v => {
      // Carry the key across formats when it is valid, so switching shows the same key.
      try {
        const k = parseKey(v === 'hex' ? 'text' : 'hex', keyIn.value);
        keyIn.value = v === 'hex' ? toHex(k) : utf8Strict.decode(k);
      } catch (_) { /* not valid in the old format, or not text: leave the input as typed */ }
      keyIn.maxLength = v === 'hex' ? 32 : 64;
      key.check();
    });
    key = keyField(keyIn, keyFmt, $('lab-keyhint'));
    const mode = seg($('lab-mode'), sync);
    const pad = seg($('lab-pad'));
    const fmt = seg($('lab-fmt'), v => {
      // Re-encode what is in the ciphertext box rather than leaving the wrong format behind.
      try {
        const bytes = readCipher(v === 'hex' ? 'b64' : 'hex');
        cipher.value = writeCipher(bytes, v);
      } catch (_) { /* box empty or not parsable in the old format: leave it */ }
    });

    function sync() {
      const m = mode.get();
      $('lab-iv-field').style.opacity = m === '0' ? '.35' : '';
      ivIn.disabled = m === '0';
      $('lab-iv-new').disabled = m === '0';
      pad.disable(m === '2');
    }

    function readCipher(f) {
      const v = cipher.value.trim();
      return (f || fmt.get()) === 'hex' ? fromHex(v, 'ciphertext') : b64ToBytes(v);
    }
    function writeCipher(bytes, f) {
      return (f || fmt.get()) === 'hex' ? toHex(bytes, 8) : bytesToB64(bytes);
    }

    function inputs() {
      const k = key.get();
      const m = Number(mode.get());
      let iv = new Uint8Array(0);
      if (m !== 0) {
        iv = fromHex(ivIn.value, 'iv');
        if (iv.length !== 8) throw new Error(`iv: need 16 hex digits (64 bits), got ${iv.length * 2}`);
      }
      return { k, m, iv, p: pad.get() === '1' };
    }

    function run(dir) {
      err.textContent = '';
      try {
        const { k, m, iv, p } = inputs();
        const t0 = performance.now();
        if (dir === 'enc') {
          const out = W.encrypt(k, m, iv, p, utf8.encode(plain.value));
          cipher.value = writeCipher(out);
          stat.textContent = `${out.length} bytes · ${Math.ceil(out.length / 8)} blocks · ${(performance.now() - t0).toFixed(2)} ms`;
        } else {
          const out = W.decrypt(k, m, iv, p, readCipher());
          let text;
          try {
            text = utf8Strict.decode(out);
          } catch (_) {
            throw new Error(`decrypted ${out.length} bytes are not UTF-8 text — wrong key, IV or mode? hex: ${toHex(out.subarray(0, 24), 8)}${out.length > 24 ? '…' : ''}`);
          }
          plain.value = text;
          stat.textContent = `${out.length} bytes · ${(performance.now() - t0).toFixed(2)} ms`;
        }
      } catch (e) {
        err.textContent = e.message || String(e);
      }
    }

    /** The first block IDEA actually sees: P1 for ECB, P1 ⊕ IV for CBC, the counter for CTR. */
    function traceFirst() {
      err.textContent = '';
      try {
        const { k, m, iv, p } = inputs();
        const data = utf8.encode(plain.value);
        let block = new Uint8Array(8);
        if (m === 2) block = iv;
        else {
          if (data.length < 8 && !p) throw new Error('plaintext is shorter than one block and padding is off');
          block.set(data.subarray(0, 8));
          if (data.length < 8) block.fill(8 - data.length, data.length);
          if (m === 1) block = block.map((b, i) => b ^ iv[i]);
        }
        window.Anatomy.specimen.load(toHex(k), toHex(block), 'enc');
        $('round').scrollIntoView({ behavior: 'smooth' });
      } catch (e) {
        err.textContent = e.message || String(e);
      }
    }

    $('lab-iv-new').addEventListener('click', () => { ivIn.value = toHex(randomBytes(8)); });
    $('lab-enc').addEventListener('click', () => run('enc'));
    $('lab-dec').addEventListener('click', () => run('dec'));
    $('lab-trace').addEventListener('click', traceFirst);
    ivIn.value = toHex(randomBytes(8));
    key.check();
    sync();
    run('enc');
  }

  /* ── IX. reliquary ──────────────────────────────────────────────────────── */

  function reliquary() {
    const drop = $('drop'), fileIn = $('file-in');
    const sealBtn = $('reli-seal'), openBtn = $('reli-open');
    const bar = $('reli-bar'), err = $('reli-err'), out = $('reli-out');
    const keyIn = $('reli-key');
    const keyFmt = seg($('reli-keyfmt'), v => {
      keyIn.placeholder = v === 'hex' ? '32 hex digits' : 'exactly 16 characters';
      keyIn.maxLength = v === 'hex' ? 32 : 64;
      key.check(); refresh();
    });
    const key = keyField(keyIn, keyFmt, $('reli-keyhint'), refresh);
    const mode = seg($('reli-mode'));
    let file = null, sealedHeader = false, busy = false, url = null;

    function refresh() {
      const keyOk = key.check() !== null;
      sealBtn.disabled = busy || !file || !keyOk;
      openBtn.disabled = busy || !file || !keyOk || !sealedHeader;
    }

    async function choose(f) {
      if (!f) return;
      file = f;
      err.textContent = ''; out.innerHTML = ''; bar.style.width = '0';
      const head = new Uint8Array(await f.slice(0, 6).arrayBuffer());
      sealedHeader = head.length === 6 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x45 && head[3] === 0x41 && head[4] === 1;
      $('drop-main').textContent = f.name;
      $('drop-sub').textContent = `${fmtSize(f.size)} · ${sealedHeader ? `sealed, ${head[5] === 2 ? 'CTR' : 'CBC'} — unseal it` : 'not sealed — seal it'}`;
      refresh();
    }

    drop.addEventListener('click', () => fileIn.click());
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
    fileIn.addEventListener('change', () => choose(fileIn.files[0]));
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => choose(e.dataTransfer.files[0]));

    function offer(blob, name, rows) {
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      const lines = rows.map(([k, v]) => `<span class="k">${k}</span>${v}`).join('<br>');
      out.innerHTML = `${lines}<br><span class="k">result</span><a download></a>`;
      const a = out.querySelector('a');
      a.href = url; a.download = name; a.textContent = `↓ ${name}`;
    }

    async function stream(from, to, step) {
      for (let o = from; o < to; o += CHUNK) {
        const end = Math.min(o + CHUNK, to);
        step(new Uint8Array(await file.slice(o, end).arrayBuffer()));
        bar.style.width = `${(((end - from) / Math.max(1, to - from)) * 100).toFixed(1)}%`;
        await nextFrame();
      }
    }

    async function seal() {
      const k = key.get();
      const ctr = mode.get() === 'ctr';
      const iv = randomBytes(8);
      const t0 = performance.now();
      const writer = new W.SealWriter(k, ctr, iv, file.name);
      const parts = [];
      let finished = false;
      try {
        await stream(0, file.size, chunk => parts.push(writer.update(chunk)));
        const last = writer.finish(); // consumes the writer
        finished = true;
        parts.push(last);
        const tag = last.subarray(last.length - 32);
        const blob = new Blob(parts, { type: 'application/octet-stream' });
        bar.style.width = '100%';
        offer(blob, `${file.name}.idea`, [
          ['mode', ctr ? 'IDEA-CTR + HMAC-SHA256' : 'IDEA-CBC + HMAC-SHA256'],
          ['iv', toHex(iv)],
          ['tag', toHex(tag, 4)],
          ['size', `${fmtSize(file.size)} → ${fmtSize(blob.size)}`],
          ['time', `${(performance.now() - t0).toFixed(0)} ms`],
        ]);
      } finally {
        if (!finished) writer.free();
      }
    }

    async function unseal() {
      const k = key.get();
      const H = W.sealHeaderLen(), T = W.sealTagLen();
      if (file.size < H + T) throw new Error('sealed file is truncated');
      const t0 = performance.now();
      const header = new Uint8Array(await file.slice(0, H).arrayBuffer());
      const reader = new W.SealReader(k, header);
      const parts = [];
      let finished = false;
      try {
        await stream(H, file.size - T, chunk => parts.push(reader.update(chunk)));
        const tag = new Uint8Array(await file.slice(file.size - T).arrayBuffer());
        finished = true; // finish consumes the reader even when it throws
        const opened = reader.finish(tag);
        parts.push(opened.tail);
        const name = opened.name || 'unsealed.bin';
        opened.free();
        const blob = new Blob(parts, { type: 'application/octet-stream' });
        bar.style.width = '100%';
        offer(blob, name, [
          ['verified', 'HMAC-SHA256 tag matches'],
          ['mode', header[5] === 2 ? 'IDEA-CTR' : 'IDEA-CBC'],
          ['iv', toHex(header.subarray(8, 16))],
          ['size', `${fmtSize(file.size)} → ${fmtSize(blob.size)}`],
          ['time', `${(performance.now() - t0).toFixed(0)} ms`],
        ]);
      } catch (e) {
        parts.length = 0; // unauthenticated plaintext is thrown away
        throw e;
      } finally {
        if (!finished) reader.free();
      }
    }

    async function guarded(fn) {
      if (busy || !file) return;
      if (file.size > MAX_FILE) { err.textContent = `file is ${fmtSize(file.size)}; this page holds results in memory, so the limit is ${fmtSize(MAX_FILE)}`; return; }
      busy = true; refresh();
      err.textContent = ''; out.innerHTML = ''; bar.style.width = '0';
      try {
        await fn();
      } catch (e) {
        bar.style.width = '0';
        err.textContent = e.message || String(e);
      } finally {
        busy = false; refresh();
      }
    }

    sealBtn.addEventListener('click', () => guarded(seal));
    openBtn.addEventListener('click', () => guarded(unseal));
    refresh();
  }

  window.Lab = {
    init(wasm) {
      W = wasm;
      lab();
      reliquary();
    },
  };
})();
