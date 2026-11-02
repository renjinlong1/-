const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errs = [];

  // 1) 本地诊断 + 自述
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#/practice/yy', { waitUntil: 'networkidle' });
  await p.click('[data-start]');
  await p.waitForTimeout(300);
  await p.click('.opt[data-opt="A"]');
  await p.click('[data-submit]');
  await p.waitForTimeout(700);
  console.log('reason box:', !!(await p.$('[data-reason]')));
  await p.fill('[data-reason]', '我其实是把同比看成环比了，后面算的时候也把基期弄错了');
  await p.click('[data-reason-chip="时间不够，最后蒙的"]');
  console.log('after chip:', await p.inputValue('[data-reason]'));
  await p.click('[data-reanalyze-self]');
  await p.waitForTimeout(900);
  const t1 = (await p.textContent('[data-ai]')).replace(/\s+/g, ' ');
  console.log('local has self:', t1.includes('你补充说'));
  console.log('local type:', t1.includes('计算失误') ? '计算失误' : t1.slice(0, 60));
  await p.locator('.reason-box').scrollIntoViewIfNeeded();
  await p.screenshot({ path: 'shots/reason-local.png' });

  // 2) 在线模型 + 自述（mock）
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errs.push(e.message));
  await p2.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await p2.evaluate(() => {
    Store.state.settings.apiBase = 'http://127.0.0.1:8899/v1';
    Store.state.settings.apiKey = 'sk-test';
    Store.state.settings.apiModel = 'mock-model';
    Store.save(true);
  });
  await p2.goto('http://127.0.0.1:8765/#/practice/yy', { waitUntil: 'networkidle' });
  await p2.click('[data-start]');
  await p2.waitForTimeout(300);
  await p2.click('.opt[data-opt="A"]');
  await p2.click('[data-submit]');
  await p2.waitForTimeout(600);
  await p2.fill('[data-reason]', '我当时两个选项纠结了很久，最后凭语感选的');
  await p2.click('[data-reanalyze-self]');
  await p2.waitForTimeout(1200);
  const t2 = (await p2.textContent('[data-ai]')).replace(/\s+/g, ' ');
  console.log('online self echo:', t2.includes('你的补充：'));
  console.log('online mock used note:', t2.includes('已参考你的补充'));
  console.log('online tag:', t2.includes('模型诊断'));
  await p2.locator('.reason-box').scrollIntoViewIfNeeded();
  await p2.screenshot({ path: 'shots/reason-online.png' });

  // 3) 移动端
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const p3 = await m.newPage();
  await p3.goto('http://127.0.0.1:8765/#/practice/yy', { waitUntil: 'networkidle' });
  await p3.click('[data-start]');
  await p3.waitForTimeout(300);
  await p3.click('.opt[data-opt="A"]');
  await p3.click('[data-submit]');
  await p3.waitForTimeout(700);
  await p3.locator('.reason-box').scrollIntoViewIfNeeded();
  await p3.waitForTimeout(200);
  await p3.screenshot({ path: 'shots/reason-mobile.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
