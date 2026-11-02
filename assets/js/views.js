/* ==========================================================
   views.js — 首页 / 练习设置 / 错题本 / 收藏 / 统计 / 题库 / 设置
   ========================================================== */
(function () {
  'use strict';

  const { esc, icon, clean, toast, pct, fmtDuration, dateKey, addDays } = UI;

  function moduleOf(key) { return Bank.map[key] || Bank.modules[0]; }

  function modulePill(key) {
    const m = moduleOf(key);
    return '<span class="pill" style="background:' + m.bg + ';color:' + m.fg + '">' + esc(m.short) + '</span>';
  }

  function ringHtml(percent, size, stroke, color, inner) {
    size = size || 84;
    stroke = stroke || 7;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px;flex:0 0 ' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#eef1f6" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (color || '#2a56e0') +
      '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      '</svg><div class="ring-text">' + (inner || (percent + '<small>%</small>')) + '</div></div>';
  }

  function emptyState(iconName, title, sub, action) {
    return '<div class="empty"><div class="empty-icon">' + icon(iconName, 26) + '</div>' +
      '<div class="empty-title">' + esc(title) + '</div>' +
      '<div class="empty-sub">' + esc(sub) + '</div>' + (action || '') + '</div>';
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function todayLabel() {
    const d = new Date();
    const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 周' + w;
  }

  /* ============================ 首页 ============================ */
  function home() {
    const totals = Store.totals();
    const today = Store.today();
    const goal = Store.state.settings.dailyGoal || 30;
    const goalPct = pct(today.n, goal);
    const streak = Store.streak();
    const weak = Bank.weakTopics(4);
    const wrongN = Store.wrongIds().length;
    const cur = Store.state.current;
    const mins = Math.round(totals.ms / 60000);

    const modCards = Bank.modules.map((m) => {
      const st = Bank.moduleStats(m.key);
      const rate = st.rate;
      return '<button class="module-card" data-module="' + m.key + '">' +
        '<div class="module-top">' +
          '<span class="module-icon" style="background:' + m.bg + ';color:' + m.fg + '">' + icon(m.icon, 18) + '</span>' +
          '<div><div class="module-name">' + esc(m.label) + '</div><div class="module-meta">' + esc(m.desc) + '</div></div>' +
          '<span class="module-count">' + st.total + ' 题</span>' +
        '</div>' +
        '<div class="module-bar"><i style="width:' + pct(st.done, st.total) + '%;background:' + m.fg + '"></i></div>' +
        '<div class="module-foot"><span>已做 <b>' + st.done + '</b> / ' + st.total + '</span>' +
          '<span>正确率 <b>' + (st.right + st.wrong > 0 ? rate + '%' : '—') + '</b></span></div>' +
      '</button>';
    }).join('');

    const week = [];
    for (let i = 6; i >= 0; i--) {
      const k = addDays(dateKey(), -i);
      const d = Store.state.days[k] || { n: 0 };
      week.push({ k, n: d.n, today: i === 0 });
    }
    const maxN = Math.max(1, Math.max.apply(null, week.map((w) => w.n)));
    const weekBars = week.map((w) => {
      const h = Math.round((w.n / maxN) * 52);
      const label = ['日', '一', '二', '三', '四', '五', '六'][new Date(w.k.replace(/-/g, '/')).getDay()];
      return '<div class="bar' + (w.today ? ' today' : '') + '"><i style="height:' + Math.max(4, h) + 'px"></i><span>' +
        (w.today ? '今天' : label) + '</span></div>';
    }).join('');

    const weakHtml = weak.length ? weak.map((w, i) =>
      '<div class="weak-item">' +
        '<span class="weak-rank">' + (i + 1) + '</span>' +
        '<div style="min-width:0;flex:0 0 auto;max-width:38%"><div class="weak-name">' + esc(w.name) + '</div>' +
          '<div class="weak-sub">' + esc(moduleOf(w.module).short) + ' · 错了 ' + w.wrong + ' 次</div></div>' +
        '<div class="weak-bar"><i style="width:' + (100 - w.rate) + '%"></i></div>' +
        '<div class="weak-rate">' + w.rate + '%</div>' +
      '</div>'
    ).join('') : '<div style="padding:26px 0;text-align:center;color:var(--ink-3);font-size:12.5px">再做几道题，这里会显示你的薄弱考点</div>';

    const html =
      (!AI.hasKey() && !Store.state.settings.hideAiTip
        ? '<div class="notice"><span class="notice-icon">' + icon('sparkles', 16) + '</span>' +
          '<div class="notice-text"><b>让错题分析更具体</b>' +
          '<span>配置一个大模型 API，答错后会结合题干、你选的选项和官方解析，指出具体是哪一步想偏了。</span></div>' +
          '<a class="btn btn-sm btn-soft" href="#/settings">去配置</a>' +
          '<button class="icon-btn" data-dismiss-tip aria-label="不再提示">' + icon('close', 15) + '</button></div>'
        : '') +
      '<div class="hero">' +
        '<div class="hero-main">' +
          '<div class="hero-date">' + todayLabel() + '</div>' +
          '<div class="hero-title">' + greeting() + '，今天的目标是 ' + goal + ' 题</div>' +
          '<div class="hero-desc">已收录 ' + Bank.questions.length + ' 道国考 / 省考真题。做完题不只是对答案，AI 会告诉你错在哪一步。</div>' +
          '<div class="hero-actions">' +
            (cur ? '<button class="btn btn-white" data-resume>' + icon('play', 16) + '继续上次练习</button>'
                 : '<button class="btn btn-white" data-go="#/practice">' + icon('play', 16) + '开始刷题</button>') +
            '<button class="btn" data-go="#/exam">' + icon('clock', 16) + '模拟考试</button>' +
          '</div>' +
        '</div>' +
        '<div class="card ring-card">' +
          ringHtml(goalPct, 84, 7, '#2a56e0', Math.min(goalPct, 100) + '%<small>今日目标</small>') +
          '<div style="flex:1;min-width:0">' +
            '<div class="rc-title">今日进度</div>' +
            '<div class="rc-sub">' + (today.n >= goal ? '目标已达成，保持节奏' : '还差 ' + (goal - today.n) + ' 题完成目标') + '</div>' +
            '<div class="rc-meta">' +
              '<div class="rc-metric"><b>' + today.n + '</b>题量</div>' +
              '<div class="rc-metric"><b>' + streak + '</b>连续天</div>' +
              '<div class="rc-metric"><b>' + (totals.attempts ? totals.rate + '%' : '—') + '</b>正确率</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="section">' +
        '<div class="section-head"><div><div class="section-title">分类刷题</div>' +
          '<div class="section-sub">按行测六大模块拆解，逐块突破</div></div>' +
          '<a class="section-link" href="#/practice">全部练习 ' + icon('arrowRight', 13) + '</a></div>' +
        '<div class="module-grid">' + modCards + '</div>' +
      '</div>' +

      '<div class="section grid grid-2">' +
        '<div class="card card-pad">' +
          '<div class="chart-head" style="margin-bottom:6px"><div><div class="section-title">最近 7 天</div>' +
            '<div class="section-sub">每天完成的题量</div></div>' +
            '<span class="pill pill-brand">' + totals.attempts + ' 题累计</span></div>' +
          '<div class="chart-mini" style="margin-top:10px">' +
            (totals.attempts ? weekBars : '<div class="chart-empty">还没有练习记录，做完第一题就会出现在这里</div>') + '</div>' +
          '<div class="divider"></div>' +
          '<div style="display:flex;gap:22px">' +
            '<div class="rc-metric"><b>' + mins + '</b>累计分钟</div>' +
            '<div class="rc-metric"><b>' + totals.seen + '</b>做过题目</div>' +
            '<div class="rc-metric"><b>' + wrongN + '</b>待攻克错题</div>' +
          '</div>' +
        '</div>' +
        '<div class="card card-pad">' +
          '<div class="chart-head" style="margin-bottom:0"><div><div class="section-title">薄弱考点</div>' +
            '<div class="section-sub">按正确率排序，优先补这些</div></div>' +
            (wrongN ? '<a class="section-link" href="#/wrong">错题本 ' + icon('arrowRight', 13) + '</a>' : '') + '</div>' +
          '<div class="weak-list">' + weakHtml + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="section grid grid-2">' +
        '<button class="card card-pad" data-go="#/random" style="text-align:left;display:flex;align-items:center;gap:14px">' +
          '<span class="setup-icon" style="width:44px;height:44px;border-radius:12px">' + icon('sparkles', 21) + '</span>' +
          '<span style="flex:1"><span class="setting-name">随机练 10 题</span>' +
          '<span class="setting-desc" style="display:block">六模块混合抽题，快速热身</span></span>' +
          icon('arrowRight', 16) + '</button>' +
        '<button class="card card-pad" data-go="#/wrong" style="text-align:left;display:flex;align-items:center;gap:14px">' +
          '<span class="setup-icon" style="width:44px;height:44px;border-radius:12px;background:var(--red-soft);color:var(--red)">' + icon('wrong', 21) + '</span>' +
          '<span style="flex:1"><span class="setting-name">错题重做</span>' +
          '<span class="setting-desc" style="display:block">' + (wrongN ? wrongN + ' 道题等你重刷' : '暂无错题，继续保持') + '</span></span>' +
          icon('arrowRight', 16) + '</button>' +
      '</div>';

    return {
      title: '学习看板', eyebrow: 'OVERVIEW',
      actions: '<button class="btn btn-sm" data-go="#/stats">' + icon('chart', 15) + '学习报告</button>' +
        '<button class="btn btn-sm btn-primary" data-go="#/practice">' + icon('practice', 15) + '开始刷题</button>',
      html: html,
      mount(root) {
        root.addEventListener('click', (e) => {
          if (e.target.closest('[data-dismiss-tip]')) {
            Store.state.settings.hideAiTip = true;
            Store.save(true);
            const n = root.querySelector('.notice');
            if (n) n.remove();
            return;
          }
          const mc = e.target.closest('[data-module]');
          if (mc) { location.hash = '#/practice/' + mc.getAttribute('data-module'); return; }
          const go = e.target.closest('[data-go]');
          if (go) { location.hash = go.getAttribute('data-go'); return; }
          if (e.target.closest('[data-resume]')) { location.hash = '#/run'; }
        });
      },
    };
  }

  /* ============================ 练习设置 ============================ */
  function practiceSetup(moduleKey) {
    const key = moduleKey && Bank.map[moduleKey] ? moduleKey : null;
    const m = key ? moduleOf(key) : { label: '综合练习', desc: '全部模块混合出题', icon: 'layers', fg: '#1f47c7', bg: '#eef2ff' };
    const cats = key ? Bank.categories(key) : [];
    const pool = key ? Bank.byModule(key) : Bank.questions;
    const wrongN = key ? pool.filter((q) => {
      const r = Store.state.records[q.id];
      return r && r.w > 0 && !r.cleared;
    }).length : Store.wrongIds().length;

    const catChips = cats.length
      ? '<div class="chips" data-cats>' +
          '<button class="chip active" data-cat="all">全部 <small>' + pool.length + '</small></button>' +
          cats.map((c) => '<button class="chip" data-cat="' + esc(c.name) + '">' + esc(c.name) +
            ' <small>' + c.count + '</small></button>').join('') +
        '</div>'
      : '<div class="chips"><button class="chip active">全部模块 <small>' + pool.length + '</small></button></div>';

    const html =
      '<div class="card setup-hero">' +
        '<div style="display:flex;gap:16px;align-items:center">' +
          '<span class="setup-icon" style="background:' + m.bg + ';color:' + m.fg + '">' + icon(m.icon, 26) + '</span>' +
          '<div><div class="setup-title">' + esc(m.label) + '</div>' +
            '<div class="setup-sub">' + esc(m.desc || '') + '</div></div>' +
        '</div>' +
        '<div style="text-align:right"><div class="ss-num">' + pool.length + '</div><div class="ss-label">可用题目</div></div>' +
      '</div>' +

      '<div class="card card-pad" style="margin-top:14px">' +
        '<div class="field" style="margin-top:0"><div class="field-label">选择题型 <span>可多选，默认全部</span></div>' + catChips + '</div>' +
        '<div class="field"><div class="field-label">练习方式</div>' +
          '<div class="seg" data-order>' +
            '<button class="active" data-v="seq">顺序练习</button>' +
            '<button data-v="random">随机抽题</button>' +
            '<button data-v="new">优先未做</button>' +
            '<button data-v="wrong">只做错题' + (wrongN ? '（' + wrongN + '）' : '') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="field"><div class="field-label">题目数量</div>' +
          '<div class="seg" data-count>' +
            '<button data-v="10">10 题</button><button class="active" data-v="20">20 题</button>' +
            '<button data-v="30">30 题</button><button data-v="0">全部</button>' +
          '</div>' +
        '</div>' +
        '<div class="setup-summary">' +
          '<div><div class="ss-num" data-preview>20</div><div class="ss-label">本次题量</div></div>' +
          '<div style="height:34px;width:1px;background:var(--line)"></div>' +
          '<div><div class="ss-num" data-preview-time>20</div><div class="ss-label">预计用时（分钟）</div></div>' +
          '<div style="flex:1"></div>' +
          '<button class="btn btn-primary btn-lg" data-start>' + icon('play', 16) + '开始练习</button>' +
        '</div>' +
        '<div class="field-hint keyboard-hint">提示：练习中答完题立即看解析；按 <kbd>1</kbd>—<kbd>4</kbd> 选择选项，<kbd>Enter</kbd> 确认，<kbd>←</kbd> <kbd>→</kbd> 切题。</div>' +
      '</div>';

    return {
      title: m.label, eyebrow: 'PRACTICE',
      actions: '<button class="btn btn-sm" data-go="#/home">' + icon('arrowLeft', 15) + '返回</button>',
      html: html,
      mount(root) {
        const state = { category: 'all', order: 'seq', count: 20 };
        const previewEl = root.querySelector('[data-preview]');
        const timeEl = root.querySelector('[data-preview-time]');

        function updatePreview() {
          let n = state.count;
          if (state.order === 'wrong') n = Math.min(n || 999, wrongN);
          if (!state.count) n = pool.length;
          previewEl.textContent = n;
          timeEl.textContent = Math.max(1, Math.round(n * 1.1));
        }

        root.addEventListener('click', (e) => {
          const chip = e.target.closest('[data-cat]');
          if (chip) {
            root.querySelectorAll('[data-cat]').forEach((c) => c.classList.remove('active'));
            chip.classList.add('active');
            state.category = chip.getAttribute('data-cat');
            return;
          }
          const ob = e.target.closest('[data-order] button');
          if (ob) {
            root.querySelectorAll('[data-order] button').forEach((b) => b.classList.remove('active'));
            ob.classList.add('active');
            state.order = ob.getAttribute('data-v');
            updatePreview();
            return;
          }
          const cb = e.target.closest('[data-count] button');
          if (cb) {
            root.querySelectorAll('[data-count] button').forEach((b) => b.classList.remove('active'));
            cb.classList.add('active');
            state.count = Number(cb.getAttribute('data-v'));
            updatePreview();
            return;
          }
          if (e.target.closest('[data-start]')) {
            const ids = Bank.pick({
              module: key, category: state.category, count: state.count || 0, order: state.order,
            });
            if (!ids.length) {
              UI.toast(state.order === 'wrong' ? '这个范围里还没有错题' : '没有符合条件的题目', 'no');
              return;
            }
            Practice.start({ mode: 'practice', ids: ids, module: key, order: state.order, category: state.category });
          }
          const go = e.target.closest('[data-go]');
          if (go) location.hash = go.getAttribute('data-go');
        });

        updatePreview();
      },
    };
  }

  /* ============================ 错题本 / 收藏 ============================ */
  function wrongBook() {
    const all = Store.wrongIds().map((id) => Bank.get(id)).filter(Boolean);
    const mods = Bank.modules.filter((m) => all.some((q) => q.module === m.key));

    const html =
      '<div class="toolbar">' +
        '<div class="search">' + icon('search', 16) + '<input type="text" placeholder="搜索题干关键词" data-q></div>' +
        '<div class="chips" data-filter>' +
          '<button class="chip active" data-m="all">全部 <small>' + all.length + '</small></button>' +
          mods.map((m) => '<button class="chip" data-m="' + m.key + '">' + esc(m.short) +
            ' <small>' + all.filter((q) => q.module === m.key).length + '</small></button>').join('') +
        '</div>' +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-sm" data-export>' + icon('download', 15) + '导出错题</button>' +
        '<button class="btn btn-sm btn-primary" data-redo-all>' + icon('rotate', 15) + '全部重做</button>' +
      '</div>' +
      '<div class="field-hint" style="margin:-2px 0 12px">连续答对 2 次，题目会自动移出错题本；也可以随时手动重做。</div>' +
      '<div class="list" data-list></div>';

    return {
      title: '错题本', eyebrow: 'REVIEW',
      actions: '<span class="pill pill-red">' + all.length + ' 道待攻克</span>',
      html: html,
      mount(root) {
        const listEl = root.querySelector('[data-list]');
        let filter = 'all';
        let kw = '';

        function renderList() {
          let list = all.filter((q) => (filter === 'all' || q.module === filter));
          if (kw) list = list.filter((q) => UI.plain(q.stem).indexOf(kw) >= 0);
          if (!list.length) {
            listEl.innerHTML = emptyState('wrong', all.length ? '没有匹配的错题' : '错题本还是空的',
              all.length ? '换个筛选条件试试' : '做错的题会自动收进来，连续答对两次后自动移出',
              all.length ? '' : '<button class="btn btn-primary" data-go="#/practice">去刷题</button>');
            return;
          }
          listEl.innerHTML = list.map((q) => {
            const r = Store.state.records[q.id] || {};
            return '<div class="q-item" data-id="' + q.id + '">' +
              '<div class="q-item-main">' +
                '<div class="q-item-top">' + modulePill(q.module) +
                  '<span class="pill pill-outline">' + esc(q.category || '') + '</span>' +
                  '<span class="wrong-count">错 ' + (r.w || 1) + ' 次</span>' +
                  (r.lastOk ? '<span class="pill pill-green">已答对</span>' : '') +
                '</div>' +
                '<div class="q-item-stem">' + esc(UI.plain(q.stem).slice(0, 120)) + '</div>' +
                '<div class="q-item-foot"><span>' + esc(q.source || q.paper || '') + '</span>' +
                  '<span>上次选 ' + ((r.lastPick || []).join('') || '—') + ' · 正确 ' + ((q.answer || []).join('')) + '</span></div>' +
              '</div>' +
              '<div class="q-item-actions">' +
                '<button class="btn btn-sm btn-primary" data-redo="' + q.id + '">重做</button>' +
                '<button class="btn btn-sm" data-view="' + q.id + '">看解析</button>' +
              '</div>' +
            '</div>';
          }).join('');
        }

        root.addEventListener('click', (e) => {
          const f = e.target.closest('[data-m]');
          if (f) {
            root.querySelectorAll('[data-filter] .chip').forEach((c) => c.classList.remove('active'));
            f.classList.add('active');
            filter = f.getAttribute('data-m');
            renderList();
            return;
          }
          const redo = e.target.closest('[data-redo]');
          if (redo) {
            Practice.start({ mode: 'practice', ids: [redo.getAttribute('data-redo')], order: 'seq' });
            return;
          }
          const view = e.target.closest('[data-view]');
          if (view) { BankUI.review(view.getAttribute('data-view')); return; }
          if (e.target.closest('[data-redo-all]')) {
            const ids = all.filter((q) => (filter === 'all' || q.module === filter))
              .filter((q) => !kw || UI.plain(q.stem).indexOf(kw) >= 0).map((q) => q.id);
            if (!ids.length) return UI.toast('没有可重做的题目');
            Practice.start({ mode: 'practice', ids: ids, order: 'random' });
            return;
          }
          if (e.target.closest('[data-export]')) {
            BankUI.exportWrong();
            return;
          }
          if (e.target.closest('[data-go]')) location.hash = '#/practice';
        });

        root.querySelector('[data-q]').addEventListener('input', (e) => {
          kw = e.target.value.trim();
          renderList();
        });

        renderList();
      },
    };
  }

  function favorites() {
    const ids = Store.state.favs.map((id) => Bank.get(id)).filter(Boolean);
    const html = ids.length
      ? '<div class="list">' + ids.map((q) =>
          '<div class="q-item" data-id="' + q.id + '"><div class="q-item-main">' +
            '<div class="q-item-top">' + modulePill(q.module) + '<span class="pill pill-outline">' + esc(q.category || '') + '</span></div>' +
            '<div class="q-item-stem">' + esc(UI.plain(q.stem).slice(0, 120)) + '</div>' +
            '<div class="q-item-foot"><span>' + esc(q.source || '') + '</span><span>正确 ' + (q.answer || []).join('') + '</span></div>' +
          '</div><div class="q-item-actions">' +
            '<button class="btn btn-sm btn-primary" data-redo="' + q.id + '">练习</button>' +
            '<button class="btn btn-sm" data-view="' + q.id + '">看解析</button>' +
            '<button class="btn btn-sm btn-danger" data-unfav="' + q.id + '">取消</button>' +
          '</div></div>').join('') + '</div>'
      : emptyState('star', '还没有收藏题目', '做题时点右上角的星标，重要题目会收在这里',
          '<button class="btn btn-primary" data-go="#/practice">去刷题</button>');

    return {
      title: '收藏夹', eyebrow: 'SAVED',
      actions: '<span class="pill">' + ids.length + ' 道</span>',
      html: html,
      mount(root) {
        root.addEventListener('click', (e) => {
          const redo = e.target.closest('[data-redo]');
          if (redo) { Practice.start({ mode: 'practice', ids: [redo.getAttribute('data-redo')], order: 'seq' }); return; }
          const view = e.target.closest('[data-view]');
          if (view) { BankUI.review(view.getAttribute('data-view')); return; }
          const unfav = e.target.closest('[data-unfav]');
          if (unfav) {
            Store.toggleFav(unfav.getAttribute('data-unfav'));
            UI.toast('已取消收藏', 'ok');
            App.render();
            return;
          }
          if (e.target.closest('[data-go]')) location.hash = '#/practice';
        });
      },
    };
  }

  /* ============================ 统计 ============================ */
  function stats() {
    const totals = Store.totals();
    const today = Store.today();
    const streak = Store.streak();
    const mins = Math.round(totals.ms / 60000);
    const wrongN = Store.wrongIds().length;

    const range = window.innerWidth < 700 ? 7 : 14;
    const days = [];
    for (let i = range - 1; i >= 0; i--) {
      const k = addDays(dateKey(), -i);
      const d = Store.state.days[k] || { n: 0, c: 0 };
      days.push({ k, n: d.n, c: d.c });
    }
    const maxN = Math.max(1, Math.max.apply(null, days.map((d) => d.n)));
    const barH = 120;
    const barsHtml = days.map((d) => {
      const h = Math.round((d.n / maxN) * barH);
      const hr = d.n ? Math.round((d.c / d.n) * h) : 0;
      const hw = h - hr;
      const dd = new Date(d.k.replace(/-/g, '/'));
      const lbl = (dd.getMonth() + 1) + '/' + dd.getDate();
      return '<div class="col' + (d.k === dateKey() ? ' today' : '') + '">' +
        '<span class="val">' + d.n + ' 题</span>' +
        '<div class="stack">' +
          (h > 0 ? '<div class="seg-right" style="height:' + hr + 'px"></div>' +
            (hw > 0 ? '<div class="seg-wrong" style="height:' + hw + 'px"></div>' : '')
            : '<div class="seg-empty" style="height:3px"></div>') +
        '</div><span class="lbl">' + lbl + '</span></div>';
    }).join('');

    const modRows = Bank.modules.map((m) => {
      const st = Bank.moduleStats(m.key);
      const total = st.right + st.wrong;
      const rate = total ? st.rate : 0;
      return '<div class="bar-row"><span class="br-name">' + esc(m.short) + '</span>' +
        '<span class="br-track"><i class="' + (rate < 55 ? 'low' : '') + '" style="width:' + Math.max(2, rate) + '%"></i></span>' +
        '<span class="br-val"><b>' + (total ? rate + '%' : '—') + '</b> · ' + total + ' 题</span></div>';
    }).join('');

    const weak = Bank.weakTopics(6);
    const weakHtml = weak.length ? weak.map((w, i) =>
      '<div class="weak-item"><span class="weak-rank">' + (i + 1) + '</span>' +
        '<div style="flex:1;min-width:0"><div class="weak-name">' + esc(w.name) + '</div>' +
        '<div class="weak-sub">' + esc(moduleOf(w.module).label) + ' · 共 ' + w.n + ' 次作答</div></div>' +
        '<div class="weak-rate" style="width:auto">' + w.rate + '%</div></div>'
    ).join('') : '<div style="padding:24px;text-align:center;color:var(--ink-3);font-size:12.5px">数据还不够，先积累 20 道题</div>';

    const sessions = Store.state.sessions.slice(0, 8);
    const sessionsHtml = sessions.length ? sessions.map((s) =>
      '<div class="weak-item"><span class="pill ' + (s.rate >= 80 ? 'pill-green' : s.rate >= 60 ? 'pill-amber' : 'pill-red') + '">' +
        (s.mode === 'exam' ? '模考' : '练习') + '</span>' +
        '<div style="flex:1"><div class="weak-name">' + esc(s.label || '综合练习') + '</div>' +
        '<div class="weak-sub">' + UI.fmtTime(s.at) + ' · ' + UI.fmtDuration(s.ms) + '</div></div>' +
        '<div style="text-align:right"><b style="font-size:14px">' + s.correct + '/' + s.total + '</b>' +
        '<div class="weak-sub">' + s.rate + '%</div></div></div>'
    ).join('') : '<div style="padding:24px;text-align:center;color:var(--ink-3);font-size:12.5px">还没有完成的练习记录</div>';

    const html =
      '<div class="stat-hero">' +
        statTile('累计做题', totals.attempts, '题', 'practice', '+' + today.n + ' 题今天') +
        statTile('正确率', totals.attempts ? totals.rate : 0, '%', 'target', totals.correct + ' 题答对') +
        statTile('连续打卡', streak, '天', 'flame', streak > 1 ? '保持住' : '今天开始') +
        statTile('学习时长', mins >= 60 ? (mins / 60).toFixed(1) : mins, mins >= 60 ? '小时' : '分钟', 'clock', wrongN + ' 道错题待复习') +
      '</div>' +

      '<div class="section card chart-card">' +
        '<div class="chart-head"><div><div class="section-title">最近 ' + range + ' 天</div>' +
          '<div class="section-sub">柱高为做题量，深色为答对部分</div></div>' +
          '<div class="chart-legend"><span><i style="background:#2a56e0"></i>答对</span><span><i style="background:#f0c7c7"></i>答错</span></div></div>' +
        (totals.attempts
          ? '<div class="bars">' + barsHtml + '</div>'
          : '<div class="chart-empty" style="height:150px">还没有练习记录，做完第一题就会出现在这里</div>') +
      '</div>' +

      '<div class="section grid grid-2">' +
        '<div class="card card-pad"><div class="section-title" style="margin-bottom:8px">各模块正确率</div>' +
          '<div class="section-sub" style="margin-bottom:12px">正确率低于 55% 的模块标红</div>' + modRows + '</div>' +
        '<div class="card card-pad"><div class="section-title" style="margin-bottom:8px">薄弱考点</div>' +
          '<div class="section-sub" style="margin-bottom:12px">按正确率从低到高</div>' + weakHtml + '</div>' +
      '</div>' +

      '<div class="section card card-pad">' +
        '<div class="section-title" style="margin-bottom:12px">最近练习</div>' + sessionsHtml +
      '</div>';

    return {
      title: '学习报告', eyebrow: 'INSIGHTS',
      actions: '<button class="btn btn-sm" data-go="#/wrong">' + icon('wrong', 15) + '错题本</button>',
      html: html,
      mount(root) {
        root.addEventListener('click', (e) => {
          const go = e.target.closest('[data-go]');
          if (go) location.hash = go.getAttribute('data-go');
        });
      },
    };
  }

  function statTile(label, num, unit, iconName, foot) {
    return '<div class="stat"><div class="stat-top"><span>' + esc(label) + '</span>' + icon(iconName, 16) + '</div>' +
      '<div class="stat-num">' + num + '<span>' + esc(unit) + '</span></div>' +
      '<div class="stat-foot">' + esc(foot) + '</div></div>';
  }

  /* ============================ 题库管理 ============================ */
  function bankPage() {
    const rows = Bank.modules.map((m) => {
      const list = Bank.byModule(m.key);
      return '<div class="weak-item"><span class="module-icon" style="background:' + m.bg + ';color:' + m.fg + ';width:32px;height:32px;border-radius:8px;flex:0 0 32px">' +
        icon(m.icon, 16) + '</span><div style="flex:1;min-width:0">' +
        '<div class="weak-name">' + esc(m.label) +
          '<span class="muted" style="font-weight:400;font-size:11.5px;margin-left:6px">' +
          list.length + ' 题 · ' + Bank.categories(m.key).length + ' 个题型</span></div>' +
        '<div class="weak-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(m.desc) + '</div></div></div>';
    }).join('');

    const html =
      '<div class="grid grid-2">' +
        '<div class="card card-pad"><div class="chart-head" style="margin-bottom:6px">' +
          '<div><div class="section-title">题库总览</div><div class="section-sub">共 ' + Bank.questions.length + ' 道可练习题</div></div>' +
          '<span class="pill pill-brand">历年真题</span></div><div class="weak-list">' + rows + '</div></div>' +
        '<div class="card card-pad">' +
          '<div class="section-title">导入自己的题库</div>' +
          '<div class="section-sub" style="margin:4px 0 12px">支持 JSON 与简化 Markdown，导入后立即参与练习</div>' +
          '<div class="chips" data-tabs style="margin-bottom:12px">' +
            '<button class="chip active" data-tab="json">JSON</button>' +
            '<button class="chip" data-tab="md">Markdown</button>' +
            '<button class="chip" data-tab="file">选择文件</button>' +
          '</div>' +
          '<div data-pane="json">' +
            '<textarea class="textarea" data-json placeholder=\'[{"module":"yy","category":"逻辑填空","stem":"题干","options":["A选项","B选项","C选项","D选项"],"answer":["A"],"explanation":"解析"}]\'></textarea>' +
          '</div>' +
          '<div data-pane="md" class="hidden">' +
            '<textarea class="textarea" data-md placeholder="## 第 1 题 · 逻辑填空&#10;题干内容……&#10;A. 选项一&#10;B. 选项二&#10;C. 选项三&#10;D. 选项四&#10;答案：C&#10;解析：这里是解析。"></textarea>' +
          '</div>' +
          '<div data-pane="file" class="hidden">' +
            '<input type="file" accept=".json,.md,.markdown,.txt" data-file class="input" style="padding:9px 12px;height:auto">' +
            '<div class="field-hint">文件内容会读入上方文本框，确认后再点导入。</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-top:12px;align-items:center">' +
            '<button class="btn btn-primary" data-import>' + icon('upload', 15) + '导入到题库</button>' +
            '<button class="btn btn-sm" data-template>下载模板</button>' +
            '<span class="muted" style="font-size:11.5px" data-import-tip></span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="section grid grid-2">' +
        '<div class="card card-pad"><div class="section-title">导出与备份</div>' +
          '<div class="section-sub" style="margin:4px 0 14px">数据只存在你的浏览器本地，建议定期备份</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button class="btn btn-sm" data-export-wrong>' + icon('download', 15) + '错题 CSV</button>' +
            '<button class="btn btn-sm" data-backup>' + icon('download', 15) + '完整备份</button>' +
            '<button class="btn btn-sm" data-restore>' + icon('upload', 15) + '恢复备份</button>' +
          '</div>' +
          '<div class="field-hint">备份文件包含做题记录、错题、收藏与设置（含 API Key，请妥善保管）。</div>' +
        '</div>' +
        '<div class="card card-pad"><div class="section-title">关于题库</div>' +
          '<div class="field-hint" style="margin-top:6px">' +
            '内置题目抓取自开源仓库 <a href="https://github.com/ERRRC/xingcezhenti" target="_blank" rel="noopener" style="color:var(--brand)"><b>ERRRC/xingcezhenti</b></a>（收录 2016—2026 国考、省考行测真题及官方解析），本工具按年份与国考/省考均衡抽样，仅保留配图完整、可独立作答的题目。<br><br>' +
            '题目版权归原命题机构，本工具仅供个人学习使用，请勿用于商业分发。' +
          '</div>' +
        '</div>' +
      '</div>';

    return {
      title: '题库管理', eyebrow: 'LIBRARY',
      actions: '<span class="pill">' + Bank.questions.length + ' 题</span>',
      html: html,
      mount(root) {
        let tab = 'json';
        root.addEventListener('click', (e) => {
          const tb = e.target.closest('[data-tab]');
          if (tb) {
            tab = tb.getAttribute('data-tab');
            root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === tb));
            root.querySelectorAll('[data-pane]').forEach((p) => {
              p.classList.toggle('hidden', p.getAttribute('data-pane') !== tab);
            });
            return;
          }
          if (e.target.closest('[data-import]')) {
            const text = tab === 'md'
              ? root.querySelector('[data-md]').value
              : root.querySelector('[data-json]').value;
            if (!text.trim()) return toast('先把题库内容粘贴进来', 'no');
            BankUI.importText(text, tab === 'md');
            return;
          }
          if (e.target.closest('[data-template]')) { BankUI.downloadTemplate(); return; }
          if (e.target.closest('[data-export-wrong]')) { BankUI.exportWrong(); return; }
          if (e.target.closest('[data-backup]')) { BankUI.backup(); return; }
          if (e.target.closest('[data-restore]')) { BankUI.restore(); return; }
        });
        root.querySelector('[data-file]').addEventListener('change', (e) => {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            const isMd = /\.(md|markdown|txt)$/i.test(f.name);
            tab = isMd ? 'md' : 'json';
            root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
            root.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.getAttribute('data-pane') !== tab));
            root.querySelector(isMd ? '[data-md]' : '[data-json]').value = reader.result;
            toast('已读入文件，确认后点导入', 'ok');
          };
          reader.readAsText(f, 'utf-8');
        });
      },
    };
  }

  /* ============================ 设置 ============================ */
  function settings() {
    const s = Store.state.settings;
    const has = AI.hasKey();
    const prov = AI.PROVIDERS.filter((p) => p.id === s.apiProvider)[0] || AI.PROVIDERS[0];

    const html =
      '<div class="grid grid-2" style="align-items:start">' +
        '<div class="card card-pad">' +
          '<div class="chart-head" style="margin-bottom:0"><div><div class="section-title">AI 错因分析</div>' +
            '<div class="section-sub">答错后，让大模型指出你具体错在哪一步</div></div>' +
            '<span class="pill ' + (has ? 'pill-green' : 'pill-amber') + '">' + (has ? '已配置' : '未配置') + '</span></div>' +
          '<div class="field"><div class="field-label">服务商</div><div class="provider-grid">' +
            AI.PROVIDERS.map((p) => '<button class="provider' + (p.id === s.apiProvider ? ' active' : '') + '" data-provider="' + p.id + '">' +
              '<b>' + esc(p.name) + '</b><small>' + esc(p.note) + '</small></button>').join('') +
          '</div></div>' +
          '<div class="field"><div class="field-label">Base URL</div>' +
            '<input class="input" data-base value="' + esc(s.apiBase) + '" placeholder="https://api.deepseek.com/v1"></div>' +
          '<div class="field"><div class="field-label">API Key <span>仅保存在本机浏览器</span>' +
            (prov.keyUrl ? '<a href="' + prov.keyUrl + '" target="_blank" rel="noopener" style="margin-left:auto;color:var(--brand);font-size:11px;font-weight:500">获取 Key ↗</a>' : '') + '</div>' +
            '<input class="input" type="password" data-key value="' + esc(s.apiKey) + '" placeholder="sk-..."></div>' +
          '<div class="field"><div class="field-label">模型名称</div>' +
            '<input class="input" data-model value="' + esc(s.apiModel) + '" placeholder="deepseek-chat"></div>' +
          '<div style="display:flex;gap:8px;margin-top:16px;align-items:center">' +
            '<button class="btn btn-primary btn-sm" data-save>' + icon('check', 15) + '保存配置</button>' +
            '<button class="btn btn-sm" data-test>' + icon('sparkles', 15) + '测试连接</button>' +
            '<span class="muted" style="font-size:11.5px" data-test-tip></span>' +
          '</div>' +
          '<div class="field-hint" style="margin-top:12px">' +
            'DeepSeek、通义千问、Kimi 已验证支持浏览器直连；智谱与 OpenAI 可能被跨域策略拦截。<br>' +
            '没有 API 也能用：系统内置本地错因引擎，会根据题型、你选的选项和官方解析给出诊断。' +
          '</div>' +
        '</div>' +

        '<div style="display:grid;gap:14px">' +
          '<div class="card card-pad">' +
            '<div class="section-title" style="margin-bottom:6px">刷题偏好</div>' +
            toggleRow('答错后自动分析', '进入解析时自动请求 AI 诊断，无需手动点击', 'autoAnalyze', s.autoAnalyze) +
            toggleRow('答对后自动下一题', '适合刷题冲量，答对后 0.6 秒自动跳转', 'autoNext', s.autoNext) +
            toggleRow('显示计时器', '练习时显示本题与总用时', 'showTimer', s.showTimer) +
            '<div class="setting-row"><div class="setting-info"><div class="setting-name">每日目标</div>' +
              '<div class="setting-desc">首页进度环按这个目标计算</div></div>' +
              '<div class="setting-ctrl"><input class="input" data-goal type="number" min="5" max="300" step="5" value="' + s.dailyGoal + '" style="width:88px"></div></div>' +
          '</div>' +

          '<div class="card card-pad">' +
            '<div class="section-title" style="margin-bottom:12px">数据</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button class="btn btn-sm" data-backup>' + icon('download', 15) + '备份</button>' +
              '<button class="btn btn-sm" data-restore>' + icon('upload', 15) + '恢复</button>' +
              '<button class="btn btn-sm btn-danger" data-reset>' + icon('trash', 15) + '清空学习记录</button>' +
            '</div>' +
            '<div class="field-hint">清空后做题记录、错题、收藏都会被删除，题库与设置保留。</div>' +
          '</div>' +

          '<div class="card card-pad">' +
            '<div class="section-title" style="margin-bottom:8px">关于</div>' +
            '<div class="field-hint">上岸 · 行测刷题 v1.0<br>题库来源：GitHub 开源项目 ERRRC/xingcezhenti，仅供个人学习。<br>' +
            '所有学习数据保存在浏览器 localStorage，不上传服务器。</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    return {
      title: '设置', eyebrow: 'SETTINGS',
      html: html,
      mount(root) {
        root.addEventListener('click', (e) => {
          const p = e.target.closest('[data-provider]');
          if (p) {
            const id = p.getAttribute('data-provider');
            const item = AI.PROVIDERS.filter((x) => x.id === id)[0];
            s.apiProvider = id;
            if (item && item.id !== 'custom') {
              s.apiBase = item.base;
              s.apiModel = item.model;
              root.querySelector('[data-base]').value = item.base;
              root.querySelector('[data-model]').value = item.model;
            }
            root.querySelectorAll('[data-provider]').forEach((b) => b.classList.toggle('active', b === p));
            return;
          }
          if (e.target.closest('[data-save]')) { saveAI(root, false); return; }
          if (e.target.closest('[data-test]')) {
            saveAI(root, true);
            const tip = root.querySelector('[data-test-tip]');
            tip.textContent = '测试中…';
            tip.style.color = 'inherit';
            AI.testConnection().then((r) => {
              tip.textContent = '连接成功 · ' + r.ms + 'ms';
              tip.style.color = 'var(--green)';
            }).catch((err) => {
              tip.textContent = AI.errorText(err);
              tip.style.color = 'var(--red)';
            });
            return;
          }
          if (e.target.closest('[data-backup]')) { BankUI.backup(); return; }
          if (e.target.closest('[data-restore]')) { BankUI.restore(); return; }
          if (e.target.closest('[data-reset]')) {
            UI.confirmDialog('清空学习记录？', '做题记录、错题本、收藏、练习历史都会被删除，且无法恢复。题库和 API 设置不受影响。', '确认清空', true)
              .then((ok) => {
                if (!ok) return;
                Store.resetProgress();
                UI.toast('已清空学习记录', 'ok');
                App.render();
              });
          }
        });

        root.addEventListener('change', (e) => {
          const t = e.target.closest('[data-toggle]');
          if (t) {
            s[t.getAttribute('data-toggle')] = t.classList.contains('on');
            Store.save(true);
            return;
          }
          if (e.target.matches('[data-goal]')) {
            s.dailyGoal = Math.max(1, Number(e.target.value) || 30);
            Store.save(true);
          }
        });

        root.querySelectorAll('[data-toggle]').forEach((el) => {
          el.addEventListener('click', () => {
            el.classList.toggle('on');
            s[el.getAttribute('data-toggle')] = el.classList.contains('on');
            Store.save(true);
          });
        });
      },
    };

    function saveAI(root, noRender) {
      s.apiBase = root.querySelector('[data-base]').value.trim();
      s.apiKey = root.querySelector('[data-key]').value.trim();
      s.apiModel = root.querySelector('[data-model]').value.trim();
      Store.save(true);
      if (noRender === false) {
        UI.toast('已保存', 'ok');
        App.render();
      }
    }
  }

  function toggleRow(name, desc, key, on) {
    return '<div class="setting-row"><div class="setting-info"><div class="setting-name">' + esc(name) + '</div>' +
      '<div class="setting-desc">' + esc(desc) + '</div></div>' +
      '<div class="setting-ctrl"><button class="switch' + (on ? ' on' : '') + '" data-toggle="' + key + '" aria-label="' + esc(name) + '"></button></div></div>';
  }

  /* ============================ 通用 · 题目详情 ============================ */
  const BankUI = {
    review(id) {
      const q = Bank.get(id);
      if (!q) return;
      const r = Store.state.records[id] || {};
      const material = clean(Bank.material(q));
      const picked = r.lastPick || [];
      const opts = q.options.map((o) => {
        const ok = (q.answer || []).indexOf(o.k) >= 0;
        const bad = !ok && picked.indexOf(o.k) >= 0;
        const plainTxt = UI.plain(o.text).trim().toUpperCase();
        const letterOnly = !plainTxt || plainTxt === o.k;
        return '<div class="opt locked ' + (ok ? 'correct' : bad ? 'wrong' : 'dim') + (letterOnly ? ' letter-only' : '') +
          '"><span class="k">' + o.k + '</span>' +
          (letterOnly ? '' : '<span class="txt">' + clean(o.text) + '</span>') + '</div>';
      }).join('');
      UI.modal({
        title: '题目解析', sub: (q.category || '') + ' · ' + (q.source || ''), wide: true,
        body: (material ? '<div class="q-material">' + material + '</div>' : '') +
          '<div class="q-stem">' + clean(q.stem) + '</div><div class="options" style="margin-top:14px">' + opts + '</div>' +
          '<div class="feedback" style="border-top:0;padding-top:12px"><div class="exp-block-title">官方解析</div>' +
          '<div class="q-explanation">' + (UI.formatExp(clean(q.explanation)) || '<span class="muted">暂无解析</span>') + '</div></div>' +
          (r.lastPick && r.lastPick.length ? '<div class="field-hint">你上次选择：' + r.lastPick.join('') + ' · 累计作答 ' + (r.a || 0) + ' 次，错 ' + (r.w || 0) + ' 次</div>' : ''),
        footer: '<button class="btn" data-close>关闭</button><button class="btn btn-primary" data-practice>练这道题</button>',
        onMount(el, close) {
          UI.texify(el);
          el.querySelector('[data-practice]').addEventListener('click', () => {
            close();
            Practice.start({ mode: 'practice', ids: [id], order: 'seq' });
          });
        },
      });
    },

    download(filename, text, type) {
      const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },

    exportWrong() {
      const ids = Store.wrongIds();
      if (!ids.length) return toast('错题本还是空的', 'no');
      const rows = [['模块', '题型', '题干', '选项', '正确答案', '我的答案', '错误次数', '解析', '来源']];
      ids.forEach((id) => {
        const q = Bank.get(id);
        if (!q) return;
        const r = Store.state.records[id] || {};
        rows.push([
          moduleOf(q.module).label, q.category || '', UI.plain(q.stem),
          q.options.map((o) => o.k + '.' + UI.plain(o.text)).join(' | '),
          (q.answer || []).join(''), (r.lastPick || []).join(''), String(r.w || 1),
          UI.plain(q.explanation), q.source || '',
        ]);
      });
      const csv = rows.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
      BankUI.download('错题本-' + dateKey() + '.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
      toast('已导出 ' + ids.length + ' 道错题', 'ok');
    },

    backup() {
      const data = JSON.stringify({ app: 'shangan', v: 1, at: Date.now(), state: Store.state, custom: window.__CUSTOM_BANK__ || null }, null, 2);
      BankUI.download('上岸备份-' + dateKey() + '.json', data, 'application/json');
      toast('备份已下载', 'ok');
    },

    restore() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            const st = data.state || data;
            if (!st || !st.records) throw new Error('格式不对');
            UI.confirmDialog('恢复备份？', '当前的学习记录会被覆盖。', '确认恢复').then((ok) => {
              if (!ok) return;
              Store.state = Object.assign(Store.state, st);
              Store.state.settings = Object.assign(Store.state.settings || {}, st.settings || {});
              Store.save(true);
              toast('已恢复', 'ok');
              App.render();
            });
          } catch (e) {
            toast('文件解析失败，请确认是本应用的备份', 'no');
          }
        };
        reader.readAsText(f, 'utf-8');
      };
      input.click();
    },

    downloadTemplate() {
      const tpl = [{
        module: 'yy', category: '逻辑填空', stem: '把题干写在这里，可以包含 HTML。',
        options: ['选项A', '选项B', '选项C', '选项D'], answer: ['C'],
        explanation: '解析写在这里。', source: '我的题库',
      }];
      BankUI.download('题库模板.json', JSON.stringify(tpl, null, 2), 'application/json');
    },

    importText(text, isMd) {
      try {
        const payload = isMd ? BankUI.parseMarkdown(text) : JSON.parse(text);
        const n = Bank.addCustom(payload);
        if (!n) throw new Error('没有解析出有效题目');
        window.__CUSTOM_BANK__ = { questions: Bank.questions.filter((q) => q.custom), materials: {} };
        Store.state.custom = window.__CUSTOM_BANK__;
        Store.save(true);
        toast('成功导入 ' + n + ' 道题', 'ok');
        App.render();
      } catch (e) {
        toast('导入失败：' + (e.message || '格式不正确'), 'no');
      }
    },

    parseMarkdown(text) {
      const blocks = String(text).split(/\n(?=#{2,3}\s*(?:第\s*\d+\s*题|题目|\d+[.、]\s))/);
      const out = [];
      blocks.forEach((block) => {
        const lines = block.split(/\r?\n/);
        let category = '导入题目';
        let idx = 0;
        if (/^#{2,3}/.test(lines[0])) {
          const m = lines[0].match(/·\s*([^<>\n]+)/);
          if (m) category = m[1].trim();
          idx = 1;
        }
        const stem = [];
        const options = [];
        let answer = [];
        let explanation = [];
        let mode = 'stem';
        for (; idx < lines.length; idx++) {
          const l = lines[idx].trim();
          if (!l || l === '---') continue;
          let m = l.match(/^-\s*\*\*([A-H])\*\*[.．、]\s*(.*)$/) || l.match(/^([A-H])[.．、]\s+(.*)$/);
          if (m) { options.push({ k: m[1], text: m[2] }); mode = 'opt'; continue; }
          m = l.match(/^\*{0,2}答案\*{0,2}[:：]\s*([A-H,，\s]+)/);
          if (m) { answer = m[1].toUpperCase().match(/[A-H]/g) || []; mode = 'exp'; continue; }
          if (/^\*{0,2}(官方解析|解析)\*{0,2}[:：]?/.test(l)) {
            mode = 'exp';
            const rest = l.replace(/^\*{0,2}(官方解析|解析)\*{0,2}[:：]?\s*/, '');
            if (rest) explanation.push(rest);
            continue;
          }
          if (mode === 'opt' && options.length) options[options.length - 1].text += ' ' + l;
          else if (mode === 'exp') explanation.push(l);
          else stem.push(l);
        }
        if (stem.length && options.length && answer.length) {
          out.push({
            module: 'cs', category: category, stem: stem.join('\n'),
            options: options, answer: answer, explanation: explanation.join('\n'), source: '导入题库',
          });
        }
      });
      return out;
    },
  };

  window.Views = {
    home: home,
    practiceSetup: practiceSetup,
    wrongBook: wrongBook,
    favorites: favorites,
    stats: stats,
    bankPage: bankPage,
    settings: settings,
  };
  window.BankUI = BankUI;
  window.moduleOf = moduleOf;
})();
