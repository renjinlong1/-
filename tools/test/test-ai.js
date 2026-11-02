const { chromium } = require('playwright-core');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8765/';
const SHOTS = path.join(__dirname, 'shots');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));

  await page.goto(BASE + '#/settings', { waitUntil: 'networkidle' });
  await page.fill('[data-base]', 'http://127.0.0.1:8899/v1');
  await page.fill('[data-key]', 'sk-test');
  await page.fill('[data-model]', 'mock-model');
  await page.click('[data-test]');
  await page.waitForTimeout(1200);
  console.log('test tip:', await page.textContent('[data-test-tip]'));
  await page.click('[data-save]');
  await page.waitForTimeout(400);
  console.log('saved settings:', await page.evaluate(() => JSON.stringify(window.Store.state.settings).slice(0, 160)));

  await page.goto(BASE + '#/practice/yy', { waitUntil: 'networkidle' });
  await page.click('[data-start]');
  await page.waitForTimeout(400);
  await page.click('.opt[data-opt="A"]');
  await page.click('[data-submit]');
  await page.waitForTimeout(1500);
  const aiText = await page.textContent('[data-ai]');
  console.log('ai tag 模型诊断:', aiText.includes('模型诊断'));
  console.log('ai diagnosis:', aiText.replace(/\s+/g, ' ').slice(0, 180));
  await page.locator('[data-ai]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(SHOTS, '21-ai-online.png') });

  console.log('errors:', errs.length ? errs.join('\n') : '(none)');
  await browser.close();
})();
