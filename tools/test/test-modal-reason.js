const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#/exam', { waitUntil: 'networkidle' });
  await p.click('[data-total] button[data-v="20"]');
  await p.click('[data-limit] button[data-v="0"]');
  await p.click('[data-start]');
  await p.waitForTimeout(300);
  for (let i = 0; i < 6; i++) {
    const opt = await p.$('.opt[data-opt="D"]');
    if (!opt) break;
    await opt.click();
    await p.waitForTimeout(50);
    await p.click('[data-submit]');
    await p.waitForTimeout(80);
  }
  await p.click('[data-finish]');
  await p.waitForTimeout(600);
  await p.click('[data-view]');
  await p.waitForTimeout(800);
  await p.click('[data-jump-analysis]');
  await p.waitForTimeout(600);
  const pos = await p.evaluate(() => {
    const m = document.querySelector('.modal');
    const a = document.querySelector('[data-review-ai]');
    if (!m || !a) return null;
    return { modalTop: Math.round(m.getBoundingClientRect().top), aiTop: Math.round(a.getBoundingClientRect().top), scrollTop: Math.round(m.scrollTop) };
  });
  console.log('jump pos:', pos);
  await p.fill('.modal [data-reason]', '这题我是知识点完全没印象，靠排除猜的');
  await p.click('.modal [data-reanalyze-self]');
  await p.waitForTimeout(900);
  const t = (await p.textContent('.modal [data-ai]')).replace(/\s+/g, ' ');
  console.log('modal analysis type:', t.includes('知识点') ? '知识点' : t.slice(0, 60));
  console.log('modal self echo:', t.includes('你的补充：'));
  await p.screenshot({ path: 'shots/report-modal-analysis.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
