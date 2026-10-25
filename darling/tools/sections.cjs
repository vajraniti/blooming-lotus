// Two screens of every listed section: <prefix>-<id>.png and <prefix>-<id>-2.png.
// usage: node sections.cjs <url> <prefix> <id,id,...> [js-to-eval-before]
//   node sections.cjs file://$PWD/index.html shots/s hero,genesis,operations,round
// Playwright: set PLAYWRIGHT to its path if require('playwright') does not find it.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

(async () => {
  const [url, prefix, ids, js = ''] = process.argv.slice(2);
  if (!url || !prefix || !ids) {
    console.error('usage: node sections.cjs <url> <prefix> <id,id,...> [js]');
    process.exit(2);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const logs = [];
  page.on('console', m => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  if (js) { await page.evaluate(js); await page.waitForTimeout(600); }
  for (const id of ids.split(',')) {
    await page.evaluate(id => {
      document.documentElement.style.scrollBehavior = 'auto';
      document.getElementById(id).scrollIntoView();
    }, id);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${prefix}-${id}.png` });
    await page.evaluate(() => window.scrollBy(0, 820));
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `${prefix}-${id}-2.png` });
  }
  if (logs.length) console.log(logs.join('\n'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
