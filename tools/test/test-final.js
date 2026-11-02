const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8765/';
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });

  const shot = async (n, full) => page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: !!full });
  const log = (...a) => console.log('[t]', ...a);

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  log('bank:', await page.evaluate(() => window.Bank.questions.length));
  log('modules:', await page.evaluate(() => JSON.stringify(window.Bank.modules.map((m) => [m.label, window.Bank.byModule(m.key).length]))));
  await shot('f01-home');

  // 资料分析
  await page.goto(BASE + '#/practice/zl', { waitUntil: 'networkidle' });
  await page.click('[data-start]');
  await page.waitForTimeout(500);
  log('material:', !!(await page.$('.q-material')));
  log('material img:', await page.evaluate(() => document.querySelectorAll('.q-material img').length));
  await shot('f02-ziliao');

  // 图形推理
  await page.goto(BASE + '#/practice/pd', { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  const chip = await page.$('[data-cat="图形推理"]');
  if (chip) {
    await chip.click();
    await page.click('[data-start]');
    await page.waitForTimeout(500);
    log('figure img:', await page.evaluate(() => document.querySelectorAll('.q-stem img, .opt img').length));
    await shot('f03-tuxing');
  } else {
    log('no 图形推理 chip');
  }

  // 答错看解析 + AI（本地）
  await page.goto(BASE + '#/practice/yy', { waitUntil: 'networkidle' });
  await page.click('[data-start]');
  await page.waitForTimeout(300);
  await page.click('.opt[data-opt="A"]');
  await page.click('[data-submit]');
  await page.waitForTimeout(900);
  log('feedback:', !!(await page.$('[data-feedback]')), 'ai:', !!(await page.$('[data-ai] .ai-panel')));
  log('explanation lines:', await page.evaluate(() => document.querySelectorAll('.q-explanation .exp-line').length));
  await page.locator('[data-feedback]').scrollIntoViewIfNeeded();
  await shot('f04-feedback');

  // 键盘操作
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  log('index:', (await page.textContent('.q-index')).trim());

  // 模考
  await page.goto(BASE + '#/exam', { waitUntil: 'networkidle' });
  await page.click('[data-total] button[data-v="20"]');
  await page.click('[data-limit] button[data-v="1"]');
  await page.click('[data-start]');
  await page.waitForTimeout(400);
  log('exam total:', (await page.textContent('.runner-top .foot-count')).trim());
  for (let i = 0; i < 8; i++) {
    const opt = await page.$('.opt[data-opt="B"]');
    if (!opt) break;
    await opt.click();
    await page.waitForTimeout(70);
    await page.click('[data-submit]');
    await page.waitForTimeout(120);
  }
  await page.click('[data-sheet]');
  await page.waitForTimeout(250);
  await shot('f05-sheet');
  await page.click('.modal-mask [data-do-finish]');
  await page.waitForTimeout(800);
  log('report total:', (await page.textContent('.report-score')).replace(/\s+/g, ' ').trim());
  await shot('f06-report');
  await page.waitForTimeout(1200);
  await shot('f07-report-ai');

  // 错题本 / 统计
  await page.goto(BASE + '#/wrong', { waitUntil: 'networkidle' });
  await shot('f08-wrong');
  await page.goto(BASE + '#/stats', { waitUntil: 'networkidle' });
  await shot('f09-stats');

  // 题库导入
  await page.goto(BASE + '#/bank', { waitUntil: 'networkidle' });
  const before = await page.evaluate(() => window.Bank.questions.length);
  await page.fill('[data-json]', JSON.stringify([{
    module: 'cs', category: '测试导入', stem: '这是一道导入测试题，以下说法正确的是？',
    options: ['甲', '乙', '丙', '丁'], answer: ['B'], explanation: '导入解析：乙是正确答案。',
  }]));
  await page.click('[data-import]');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.Bank.questions.length);
  log('import:', before, '->', after);
  await shot('f10-bank');

  // 错题详情
  await page.goto(BASE + '#/wrong', { waitUntil: 'networkidle' });
  const view = await page.$('[data-view]');
  if (view) { await view.click(); await page.waitForTimeout(300); await shot('f11-review'); await page.keyboard.press('Escape'); }

  // 移动端
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(BASE + '#/home', { waitUntil: 'networkidle' });
  await m.waitForTimeout(300);
  await m.screenshot({ path: path.join(SHOTS, 'f12-mobile-home.png') });
  await m.goto(BASE + '#/practice/zl', { waitUntil: 'networkidle' });
  await m.click('[data-start]');
  await m.waitForTimeout(400);
  await m.screenshot({ path: path.join(SHOTS, 'f13-mobile-run.png') });

  console.log('\n=== errors ===');
  console.log(errors.length ? errors.join('\n') : '(none)');
  console.log('=== failed ===');
  console.log(failed.length ? failed.slice(0, 15).join('\n') : '(none)');
  await browser.close();
})();
