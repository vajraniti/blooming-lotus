// Screenshot of a page, with console errors printed.
// usage: node shot.cjs <url> <out.png> [width] [height] [fullPage 0|1] [js-to-eval-before]
//   node shot.cjs file://$PWD/index.html hero.png
//   node shot.cjs file://$PWD/index.html ru.png 1440 900 0 "I18N.set('ru')"
// Playwright: set PLAYWRIGHT to its path if require('playwright') does not find it.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

(async () => {
  const [url, out, w = '1440', h = '900', full = '0', js = ''] = process.argv.slice(2);
  if (!url || !out) {
    console.error('usage: node shot.cjs <url> <out.png> [width] [height] [fullPage] [js]');
    process.exit(2);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  const logs = [];
  page.on('console', m => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', r => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200); // fonts, wasm init, the hero scramble
  if (js) {
    const r = await page.evaluate(js);
    if (r !== undefined) console.log('eval:', JSON.stringify(r));
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: out, fullPage: full === '1' });
  if (logs.length) console.log(logs.join('\n'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
