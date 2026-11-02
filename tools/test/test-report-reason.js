const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errs = [];

  async function runExam(p) {
    await p.goto('http://127.0.0.1:8765/#/exam', { waitUntil: 'networkidle' });
    await p.click('[data-total] button[data-v="20"]');
    await p.click('[data-limit] button[data-v="0"]');
    await p.click('[data-start]');
    await p.waitForTimeout(300);
    for (let i = 0; i < 8; i++) {
      const opt = await p.$('.opt[data-opt="C"]');
      if (!opt) break;
      await opt.click();
      await p.waitForTimeout(60);
      await p.click('[data-submit]');
      await p.waitForTimeout(90);
    }
    await p.click('[data-finish]');
    await p.waitForTimeout(700);
  }

  // 1) 本地
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await runExam(p);
  const rows = await p.$$('.wrong-reason');
  console.log('local wrong rows with reason:', rows.length);
  await p.screenshot({ path: 'shots/report-reason-list.png' });
  await p.locator('.wrong-reason').first().scrollIntoViewIfNeeded();
  await p.screenshot({ path: 'shots/report-reason-list2.png' });
  await p.click('[data-view]');
  await p.waitForTimeout(900);
  const modalText = (await p.textContent('.modal')).replace(/\s+/g, ' ');
  console.log('modal has analysis:', modalText.includes('错因分析'));
  console.log('modal has reason box:', !!(await p.$('.modal [data-reason]')));
  console.log('modal title:', (await p.textContent('.modal-title')).trim());
  await p.screenshot({ path: 'shots/report-reason-modal.png' });

  // 2) 在线（mock）
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
  await runExam(p2);
  await p2.click('[data-view]');
  await p2.waitForTimeout(1200);
  const t2 = (await p2.textContent('.modal')).replace(/\s+/g, ' ');
  console.log('online modal tag:', t2.includes('模型诊断'), '| analysis:', t2.includes('错因分析'));
  await p2.screenshot({ path: 'shots/report-reason-modal-ai.png' });

  // 3) 手机
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const p3 = await m.newPage();
  await runExam(p3);
  await p3.click('[data-view]');
  await p3.waitForTimeout(900);
  const box = await p3.evaluate(() => {
    const el = document.querySelector('.modal');
    return el ? { w: Math.round(el.getBoundingClientRect().width), sw: document.documentElement.scrollWidth, iw: window.innerWidth } : null;
  });
  console.log('mobile modal:', box);
  await p3.screenshot({ path: 'shots/report-reason-mobile.png' });

  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
