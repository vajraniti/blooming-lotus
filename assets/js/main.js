/* Waits for the WebAssembly cipher, then brings the interactive sections to life. */
(function () {
  'use strict';

  window.IDEA.ready
    .then(wasm => {
      window.Anatomy.init(wasm);
      window.Lab.init(wasm);
    })
    .catch(e => {
      // Silent when it works; one plain line when it does not. The real reason goes to the console.
      const note = document.getElementById('wasm-status');
      const say = () => {
        note.textContent = window.I18N.L(
          'The cipher (WebAssembly) failed to load, so the demos below are off. Details are in the browser console.',
          'Шифр (WebAssembly) не загрузился, поэтому демо ниже не работают. Подробности в консоли браузера.',
        );
      };
      say();
      window.I18N.onChange(say);
      note.hidden = false;
      console.error('IDEA: could not start the WebAssembly cipher:', e);
    });
})();
