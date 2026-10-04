/* Waits for the WebAssembly cipher, then brings the interactive sections to life. */
(function () {
  'use strict';

  const status = document.getElementById('wasm-status');
  const say = (cls, txt) => {
    status.classList.add(cls);
    status.querySelector('.txt').textContent = txt;
  };

  window.IDEA.ready
    .then(wasm => {
      window.Anatomy.init(wasm);
      window.Lab.init(wasm);
      say('ready', 'rust → wasm · alive');
    })
    .catch(e => {
      say('fail', 'cipher failed to wake');
      // Visible in the console with the real reason; the page itself stays readable.
      console.error('IDEA: could not start the WebAssembly cipher:', e);
    });
})();
