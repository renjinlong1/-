const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#/practice/yy', { waitUntil: 'networkidle' });
  await p.click('[data-cat="片段阅读"]');
  await p.click('[data-order] button[data-v="seq"]');
  await p.click('[data-start]');
  await p.waitForTimeout(400);
  const len = async () => p.evaluate(() => {
    const m = document.querySelector('.q-material');
    return m ? m.innerText.replace(/\s+/g, ' ').trim().length : 0;
  });
  console.log('Q1 material chars:', await len(), 'stem:', (await p.textContent('.q-stem')).slice(0, 30));
  await p.screenshot({ path: 'shots/g01-passage-q1.png' });

  // 答一题进入下一题
  await p.click('.opt[data-opt="A"]');
  await p.click('[data-submit]');
  await p.waitForTimeout(500);
  await p.click('[data-next]');
  await p.waitForTimeout(400);
  console.log('Q2 material chars:', await len(), 'stem:', (await p.textContent('.q-stem')).slice(0, 40));
  await p.screenshot({ path: 'shots/g02-passage-q2.png' });
  await p.click('[data-skip]');
  await p.waitForTimeout(300);
  await p.click('[data-next]');
  await p.waitForTimeout(400);
  console.log('Q3 material chars:', await len());
  await p.screenshot({ path: 'shots/g03-passage-q3.png' });

  // 病句题（无材料）
  await p.goto('http://127.0.0.1:8765/#/practice/yy', { waitUntil: 'networkidle' });
  await p.click('[data-cat="语句表达"]');
  await p.click('[data-start]');
  await p.waitForTimeout(400);
  console.log('语句表达 Q1 material chars:', await len());
  console.log('errors:', errs);
  await b.close();
})();
