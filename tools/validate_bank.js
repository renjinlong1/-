/* 题库数据体检：答案合法性、材料完整性、图片存在性、解析一致性 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const modules = ['zzll', 'cs', 'yy', 'sl', 'pd', 'zl'];
let all = [];
let materials = {};
let problems = [];

for (const m of modules) {
  const file = path.join(ROOT, 'assets', 'data', m + '.js');
  if (!fs.existsSync(file)) { problems.push(`缺少数据文件 ${m}.js`); continue; }
  let payload = null;
  global.window = { __BANK_PUSH: (p) => { payload = p; } };
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(file, 'utf8'));
  if (!payload) { problems.push(`${m}.js 未调用 __BANK_PUSH`); continue; }
  all = all.concat(payload.questions.map((q) => Object.assign({ __file: m }, q)));
  Object.assign(materials, payload.materials || {});
}

const ids = new Set();
let imgCount = 0, missingImg = [];
for (const q of all) {
  if (ids.has(q.id)) problems.push(`重复 id: ${q.id}`);
  ids.add(q.id);
  if (!q.stem || !q.stem.trim()) problems.push(`空题干: ${q.id}`);
  if (!q.options || q.options.length < 2) problems.push(`选项不足: ${q.id}`);
  if (!q.answer || !q.answer.length) problems.push(`无答案: ${q.id}`);
  const keys = (q.options || []).map((o) => o.k);
  for (const a of q.answer || []) if (keys.indexOf(a) < 0) problems.push(`答案 ${a} 不在选项: ${q.id}`);
  if (!q.explanation || q.explanation.length < 4) problems.push(`无解析: ${q.id}`);
  const plainExp = q.explanation.replace(/<[^>]+>/g, '');
  const m = plainExp.match(/正确答案为\s*([A-H][A-H、,，和\s]{0,8})/);
  if (m) {
    const got = (m[1].match(/[A-H]/g) || []).join('');
    const mine = (q.answer || []).slice().sort().join('');
    if (got !== mine) problems.push(`答案与解析不一致: ${q.id} 数据=${mine} 解析=${got}`);
  }
  if (q.materialId) {
    const mat = materials[q.materialId];
    if (!mat || !mat.trim()) problems.push(`材料为空: ${q.id} -> ${q.materialId}`);
  }
  const html = (q.stem || '') + (q.options || []).map((o) => o.text).join('') +
    (q.explanation || '') + (q.materialId ? materials[q.materialId] || '' : '');
  const srcs = html.match(/assets\/img\/[A-Za-z0-9._-]+/g) || [];
  for (const s of new Set(srcs)) {
    imgCount++;
    const p = path.join(ROOT, s);
    if (!fs.existsSync(p)) missingImg.push(s);
  }
}

const multi = all.filter((q) => (q.answer || []).length > 1);
const byModule = {};
all.forEach((q) => { byModule[q.module] = (byModule[q.module] || 0) + 1; });
const withMat = all.filter((q) => q.materialId);

console.log('题目总数:', all.length);
console.log('分模块:', byModule);
console.log('多选题:', multi.length, multi.slice(0, 5).map((q) => q.id + ':' + q.answer.join('')).join(' '));
console.log('带材料题:', withMat.length, '材料块:', Object.keys(materials).length);
console.log('引用图片:', imgCount, '缺失:', missingImg.length);
if (missingImg.length) console.log(missingImg.slice(0, 10));
console.log('问题数:', problems.length);
problems.slice(0, 25).forEach((p) => console.log(' -', p));

const avg = Math.round(all.reduce((a, q) => a + (q.explanation || '').length, 0) / all.length);
console.log('平均解析长度:', avg);
