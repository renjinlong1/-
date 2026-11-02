const { chromium } = require('playwright-core');
const path = require('path');
const SHOTS = path.join(__dirname, 'shots', 'mobile');

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const over = async (label) => {
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    if (m.sw > m.iw + 1) console.log('OVERFLOW', label, m);
  };

  await p.goto('http://127.0.0.1:8765/#/exam', { waitUntil: 'networkidle' });
  await p.click('[data-total] button[data-v="20"]');
  await p.click('[data-limit] button[data-v="0"]');
  await p.click('[data-start]');
  await p.waitForTimeout(300);
  for (let i = 0; i < 12; i++) {
    const opt = await p.$('.opt[data-opt="C"]');
    if (!opt) break;
    await opt.click();
    await p.waitForTimeout(50);
    await p.click('[data-submit]');
    await p.waitForTimeout(80);
  }
  await p.click('[data-finish]');
  await p.waitForTimeout(700);
  await over('report');
  await p.screenshot({ path: path.join(SHOTS, 'report.png') });
  await p.locator('.report-hero').scrollIntoViewIfNeeded();
  await p.screenshot({ path: path.join(SHOTS, 'report-top.png') });

  await p.goto('http://127.0.0.1:8765/#/wrong', { waitUntil: 'networkidle' });
  await p.waitForTimeout(200);
  const view = await p.$('[data-view]');
  if (view) {
    await view.click();
    await p.waitForTimeout(350);
    await over('review-modal');
    await p.screenshot({ path: path.join(SHOTS, 'review.png') });
  }
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
