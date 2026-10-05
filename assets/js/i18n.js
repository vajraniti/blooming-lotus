/* Language switch (English / Russian).
   English is what the HTML says. Russian lives in i18n-ru.js, keyed by the English
   text itself (the gettext way), so the markup only needs a bare data-i18n.
   Strings built in JavaScript use I18N.L('english', 'русский') where they are made. */
(function () {
  'use strict';

  const KEY = 'idea-lang';
  const RU = window.I18N_RU || { text: {}, attr: {}, meta: {} };
  const ATTRS = ['alt', 'aria-label', 'placeholder', 'title'];
  const norm = s => s.replace(/\s+/g, ' ').trim();

  let lang = null;
  try {
    lang = localStorage.getItem(KEY);
  } catch (_) { /* storage blocked: fall back to the browser language */ }
  if (lang !== 'en' && lang !== 'ru') lang = /^ru\b/i.test(navigator.language || '') ? 'ru' : 'en';
  // Without a Russian dictionary there is nothing to switch to: stay English, hide the switch.
  const hasRu = Object.keys(RU.text).length > 0;
  if (!hasRu) lang = 'en';

  const textEn = new Map();   // element -> its English innerHTML
  const attrEn = new Map();   // element -> { attribute: English value }
  const metaEn = {
    title: document.title,
    description: document.querySelector('meta[name="description"]').getAttribute('content'),
  };
  const subs = [];
  const warned = new Set();

  function ru(table, en) {
    const hit = table[norm(en)];
    if (hit === undefined && !warned.has(en)) {
      warned.add(en);
      // Shows up when the English copy changes and the Russian was not updated with it.
      console.warn('IDEA i18n: no Russian for:', norm(en));
    }
    return hit;
  }

  function apply() {
    const isRu = lang === 'ru';
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (!textEn.has(el)) textEn.set(el, el.innerHTML);
      const en = textEn.get(el);
      el.innerHTML = isRu ? (ru(RU.text, en) ?? en) : en;
      // the menu scramble settles on whatever this says now
      if (el.hasAttribute('data-scramble')) el.dataset.final = el.textContent;
    });
    document.querySelectorAll(ATTRS.map(a => `[${a}]`).join(',')).forEach(el => {
      if (!attrEn.has(el)) {
        const orig = {};
        ATTRS.forEach(a => { if (el.hasAttribute(a)) orig[a] = el.getAttribute(a); });
        attrEn.set(el, orig);
      }
      const orig = attrEn.get(el);
      for (const a in orig) {
        // attributes without a Russian entry (names, symbols) stay as they are
        const hit = RU.attr[norm(orig[a])];
        el.setAttribute(a, isRu && hit !== undefined ? hit : orig[a]);
      }
    });
    document.title = isRu ? RU.meta.title : metaEn.title;
    document.querySelector('meta[name="description"]').setAttribute('content', isRu ? RU.meta.description : metaEn.description);
    document.querySelectorAll('[data-lang]').forEach(b => {
      const on = b.dataset.lang === lang;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function set(next) {
    if (next === lang || (next !== 'en' && next !== 'ru')) return;
    lang = next;
    try {
      localStorage.setItem(KEY, lang);
    } catch (_) { /* not remembered across visits, the switch still works for this one */ }
    apply();
    subs.forEach(fn => fn(lang));
  }

  /** Russian plural: plural(5, 'байт', 'байта', 'байт') → 'байт'. */
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }

  // Messages that come from the Rust code (crates/idea, crates/idea-wasm), in English.
  const RUST_ERRORS = [
    [/^key must be 16 bytes \(128 bits\), got (\d+)$/, m => `ключ должен быть 16 байт (128 бит), получено ${m[1]}`],
    [/^IV must be 8 bytes \(64 bits\), got (\d+)$/, m => `IV должен быть 8 байт (64 бита), получено ${m[1]}`],
    [/^ECB\/CBC data must be a whole number of 8-byte blocks, got (\d+) bytes$/,
      m => `в ECB/CBC длина данных должна быть кратна 8 байтам, а здесь ${m[1]} ${plural(+m[1], 'байт', 'байта', 'байт')}`],
    [/^bad PKCS#7 padding after decryption/, () => 'после расшифровки дополнение PKCS#7 не сходится: не тот ключ или IV, либо шифртекст повреждён'],
    [/^not a sealed IDEA file/, () => 'это не запечатанный файл IDEA: в начале нет сигнатуры «IDEA»'],
    [/^sealed file format version (\d+) is not supported$/, m => `версия формата ${m[1]} не поддерживается`],
    [/^sealed file uses unknown cipher mode (\d+)$/, m => `в файле неизвестный режим шифрования: ${m[1]}`],
    [/^sealed file is truncated$/, () => 'запечатанный файл обрезан'],
    [/^authentication failed/, () => 'проверка подлинности не прошла: не тот ключ, или файл изменили'],
    [/^file name is (\d+) bytes in UTF-8, a sealed file holds at most (\d+)$/,
      m => `имя файла занимает ${m[1]} ${plural(+m[1], 'байт', 'байта', 'байт')} в UTF-8, а в запечатанный файл влезает не больше ${m[2]}`],
    [/^embedded file name is not valid UTF-8$/, () => 'имя файла внутри не в UTF-8'],
    [/^a block is 8 bytes, got (\d+)$/, m => `блок — это 8 байт, получено ${m[1]}`],
  ];

  /** An error message for the reader: Rust's English, translated when the page is in Russian. */
  function err(e) {
    const msg = (e && e.message) || String(e);
    if (lang !== 'ru') return msg;
    for (const [re, fn] of RUST_ERRORS) {
      const m = msg.match(re);
      if (m) return fn(m);
    }
    return msg;
  }

  window.I18N = {
    get lang() { return lang; },
    L: (en, ruText) => (lang === 'ru' ? ruText : en),
    plural,
    err,
    set,
    onChange(fn) { subs.push(fn); },
  };

  // Scripts sit at the end of <body>, so the document is already parsed here.
  apply();
  if (!hasRu) document.querySelectorAll('.rail-lang').forEach(el => { el.hidden = true; });
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => set(b.dataset.lang)));
})();
