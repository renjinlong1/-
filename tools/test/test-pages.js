const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [], bad = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await p.goto('https://renjinlong1.github.io/-/', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(800);
  console.log('title:', await p.title());
  console.log('bank:', await p.evaluate(() => window.Bank && window.Bank.questions.length));
  console.log('h1:', (await p.textContent('.page-title')).trim());
  await p.screenshot({ path: 'shots/pages-home.png' });
  await p.goto('https://renjinlong1.github.io/-/#/practice/zl', { waitUntil: 'networkidle' });
  await p.click('[data-start]');
  await p.waitForTimeout(800);
  const img = await p.evaluate(() => {
    const im = document.querySelector('.q-material img');
    return im ? { w: im.naturalWidth, h: im.naturalHeight, src: im.getAttribute('src') } : null;
  });
  console.log('material img:', img);
  await p.screenshot({ path: 'shots/pages-question.png' });
  console.log('errors:', errs.length ? errs : 'none');
  console.log('bad responses:', bad.length ? bad.slice(0, 8) : 'none');
  await b.close();
})();
