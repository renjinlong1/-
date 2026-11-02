/* ==========================================================
   bank.js — 题库注册、筛选、组卷
   ========================================================== */
(function () {
  'use strict';

  const MODULES = [
    { key: 'zzll', label: '政治理论', short: '政治', icon: 'flag', fg: '#b45309', bg: '#fff6e6',
      desc: '创新理论 · 时政 · 党史', weight: 8 },
    { key: 'cs', label: '常识判断', short: '常识', icon: 'layers', fg: '#0f766e', bg: '#e7f7f5',
      desc: '法律 · 科技 · 人文 · 地理', weight: 12 },
    { key: 'yy', label: '言语理解与表达', short: '言语', icon: 'book', fg: '#1f47c7', bg: '#eef2ff',
      desc: '逻辑填空 · 片段阅读 · 语句表达', weight: 26 },
    { key: 'sl', label: '数量关系', short: '数量', icon: 'target', fg: '#6d3bd4', bg: '#f3edff',
      desc: '数学运算 · 数字推理', weight: 10 },
    { key: 'pd', label: '判断推理', short: '判断', icon: 'grid', fg: '#be123c', bg: '#fff1f3',
      desc: '图形 · 定义 · 类比 · 逻辑', weight: 26 },
    { key: 'zl', label: '资料分析', short: '资料', icon: 'chart', fg: '#0b7a4b', bg: '#e9f8f0',
      desc: '增长率 · 比重 · 平均数', weight: 18 },
  ];

  const map = {};
  MODULES.forEach((m) => { map[m.key] = m; });

  const Bank = {
    modules: MODULES,
    map: map,
    questions: [],
    byId: {},
    materials: {},
    _index: 0,

    push(payload) {
      if (!payload || !payload.questions) return;
      (payload.questions || []).forEach((q) => {
        if (!q || !q.id) return;
        if (this.byId[q.id]) return;
        q.__i = this._index++;
        q.module = q.module || payload.module;
        this.questions.push(q);
        this.byId[q.id] = q;
      });
      const mats = payload.materials || {};
      Object.keys(mats).forEach((k) => { this.materials[k] = mats[k]; });
    },

    addCustom(payload) {
      const list = Array.isArray(payload) ? payload : (payload.questions || []);
      const mats = (!Array.isArray(payload) && payload.materials) || {};
      let n = 0;
      list.forEach((q) => {
        if (!q || !q.stem || !Array.isArray(q.options) || !q.options.length) return;
        const id = q.id || ('imp-' + Math.random().toString(36).slice(2, 9));
        if (this.byId[id]) return;
        const item = {
          id: id,
          module: map[q.module] ? q.module : 'cs',
          category: q.category || '导入题目',
          stem: String(q.stem),
          options: q.options.map((o, i) => ({
            k: typeof o === 'string' ? String.fromCharCode(65 + i) : (o.k || String.fromCharCode(65 + i)),
            text: typeof o === 'string' ? o : String(o.text || ''),
          })),
          answer: (q.answer || []).map((a) => String(a).toUpperCase()),
          explanation: q.explanation || '',
          source: q.source || '我的题库',
          paper: q.paper || '', year: q.year || '', region: q.region || '',
          materialId: q.materialId || null,
          custom: true,
        };
        if (!item.answer.length) return;
        item.__i = this._index++;
        this.questions.push(item);
        this.byId[item.id] = item;
        n += 1;
      });
      Object.keys(mats).forEach((k) => { this.materials[k] = mats[k]; });
      return n;
    },

    get(id) { return this.byId[id]; },
    material(q) { return q && q.materialId ? (this.materials[q.materialId] || '') : ''; },

    byModule(key) { return this.questions.filter((q) => q.module === key); },

    categories(key) {
      const out = [];
      const idx = {};
      this.byModule(key).forEach((q) => {
        const c = q.category || '未分类';
        if (!idx[c]) { idx[c] = { name: c, count: 0 }; out.push(idx[c]); }
        idx[c].count += 1;
      });
      return out.sort((a, b) => b.count - a.count);
    },

    moduleStats(key) {
      const list = this.byModule(key);
      let done = 0, right = 0, wrong = 0;
      list.forEach((q) => {
        const r = Store.state.records[q.id];
        if (r && r.a > 0) { done += 1; right += r.c; wrong += r.w; }
      });
      return { total: list.length, done: done, right: right, wrong: wrong, rate: UI.pct(right, right + wrong) };
    },

    pick(opt) {
      opt = opt || {};
      let list = opt.module ? this.byModule(opt.module) : this.questions.slice();
      if (opt.category && opt.category !== 'all') {
        list = list.filter((q) => q.category === opt.category);
      }
      if (opt.order === 'wrong') {
        list = list.filter((q) => {
          const r = Store.state.records[q.id];
          return r && r.w > 0 && !r.cleared;
        });
      }
      if (opt.order === 'new') {
        list = list.slice().sort((a, b) => {
          const ra = Store.state.records[a.id] || { a: 0 };
          const rb = Store.state.records[b.id] || { a: 0 };
          if (ra.a !== rb.a) return ra.a - rb.a;
          return a.__i - b.__i;
        });
      } else if (opt.order === 'random' || opt.order === 'wrong') {
        list = UI.shuffle(list);
      } else {
        list = list.slice().sort((a, b) => a.__i - b.__i);
      }
      const n = opt.count && opt.count > 0 ? Math.min(opt.count, list.length) : list.length;
      return list.slice(0, n).map((q) => q.id);
    },

    /** 按真实行测比例组一套模拟卷 */
    examPaper(total) {
      total = total || 40;
      const weights = MODULES.map((m) => m.weight);
      const sum = weights.reduce((a, b) => a + b, 0);
      const plan = MODULES.map((m) => ({ key: m.key, n: Math.max(1, Math.round(total * m.weight / sum)) }));
      let diff = total - plan.reduce((a, b) => a + b.n, 0);
      let i = 0;
      while (diff !== 0 && i < 60) {
        const p = plan[i % plan.length];
        if (diff > 0) { p.n += 1; diff -= 1; }
        else if (p.n > 1) { p.n -= 1; diff += 1; }
        i += 1;
      }
      const ids = [];
      plan.forEach((p) => {
        const pool = UI.shuffle(this.byModule(p.key)).slice(0, p.n);
        pool.forEach((q) => ids.push(q.id));
      });
      return UI.shuffle(ids);
    },

    /** 所有题目按考点的正确率，用于薄弱点分析 */
    weakTopics(limit) {
      const idx = {};
      this.questions.forEach((q) => {
        const r = Store.state.records[q.id];
        if (!r || !r.a) return;
        const key = q.category || '未分类';
        if (!idx[key]) idx[key] = { name: key, module: q.module, n: 0, c: 0 };
        idx[key].n += r.a;
        idx[key].c += r.c;
      });
      return Object.keys(idx).map((k) => {
        const t = idx[k];
        t.rate = UI.pct(t.c, t.n);
        t.wrong = t.n - t.c;
        return t;
      }).filter((t) => t.n >= 2 && t.wrong > 0)
        .sort((a, b) => (a.rate - b.rate) || (b.wrong - a.wrong))
        .slice(0, limit || 5);
    },
  };

  window.__BANK_PUSH = function (payload) { Bank.push(payload); };
  window.Bank = Bank;
})();
