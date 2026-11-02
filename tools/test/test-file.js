const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///D:/workbuddy/2026-11-02-20-27-32/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  console.log('bank:', await p.evaluate(() => window.Bank ? window.Bank.questions.length : 'no bank'));
  console.log('view:', (await p.textContent('#view')).slice(0, 40).replace(/\s+/g, ' '));
  console.log('errors:', errs);
  await p.screenshot({ path: 'shots/f14-file-home.png' });
  await b.close();
})();
