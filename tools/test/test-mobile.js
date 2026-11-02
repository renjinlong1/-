const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8765/';
const SHOTS = path.join(__dirname, 'shots', 'mobile');
fs.mkdirSync(SHOTS, { recursive: true });

const pages = [
  ['home', '#/home'],
  ['setup', '#/practice/yy'],
  ['exam-setup', '#/exam'],
  ['wrong', '#/wrong'],
  ['stats', '#/stats'],
  ['bank', '#/bank'],
  ['settings', '#/settings'],
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  for (const width of [360, 390, 430]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const overflow = [];
    for (const [name, hash] of pages) {
      await page.goto(BASE + hash, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        offenders: Array.from(document.querySelectorAll('body *')).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
        }).slice(0, 5).map((el) => el.className || el.tagName),
      }));
      if (m.sw > m.iw + 1) overflow.push([name, m.sw, m.iw, m.offenders]);
      if (width === 390) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false });
    }

    // 答题 + 解析
    await page.goto(BASE + '#/practice/yy', { waitUntil: 'networkidle' });
    await page.click('[data-start]');
    await page.waitForTimeout(350);
    if (width === 390) await page.screenshot({ path: path.join(SHOTS, 'question.png') });
    const m1 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    if (m1.sw > m1.iw + 1) overflow.push(['question', m1.sw, m1.iw]);

    await page.click('.opt[data-opt="A"]');
    await page.click('[data-submit]');
    await page.waitForTimeout(800);
    if (width === 390) {
      await page.locator('[data-feedback]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOTS, 'feedback.png') });
    }

    // 答题卡
    await page.click('[data-sheet]');
    await page.waitForTimeout(300);
    if (width === 390) await page.screenshot({ path: path.join(SHOTS, 'sheet.png') });
    const sheetBox = await page.evaluate(() => {
      const m = document.querySelector('.modal');
      if (!m) return null;
      const r = m.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), vw: window.innerWidth };
    });
    await page.keyboard.press('Escape');

    // 模考结果
    await page.goto(BASE + '#/exam', { waitUntil: 'networkidle' });
    await page.click('[data-total] button[data-v="20"]');
    await page.click('[data-limit] button[data-v="0"]');
    await page.click('[data-start]');
    await page.waitForTimeout(300);
    for (let i = 0; i < 3; i++) {
      const opt = await page.$('.opt[data-opt="B"]');
      if (!opt) break;
      await opt.click();
      await page.waitForTimeout(60);
      await page.click('[data-submit]');
      await page.waitForTimeout(100);
    }
    await page.goto(BASE + '#/report', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    if (width === 390) await page.screenshot({ path: path.join(SHOTS, 'report-empty.png') });

    console.log(`[${width}] overflow:`, overflow.length ? JSON.stringify(overflow) : 'none', '| modal:', JSON.stringify(sheetBox), '| errors:', errs.length ? errs : 'none');
    await ctx.close();
  }
  await browser.close();
})();
