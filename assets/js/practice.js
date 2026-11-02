/* ==========================================================
   practice.js — 答题器 / 模拟考试 / 成绩报告
   ========================================================== */
(function () {
  'use strict';

  const { $, $$, esc, icon, clean, toast, fmtDuration, pct } = UI;

  let S = null;          // 当前会话
  let timer = null;      // 计时器
  let aiCache = {};      // qid -> analysis
  let lastReport = null; // 报告数据（内存）

  function save() {
    if (!S) return;
    Store.state.current = {
      mode: S.mode, ids: S.ids, idx: S.idx, picks: S.picks, revealed: S.revealed,
      flags: S.flags, startedAt: S.startedAt, limitMs: S.limitMs, module: S.module,
      label: S.label, order: S.order, submitted: S.submitted,
    };
    Store.save();
  }

  function start(opt) {
    S = {
      mode: opt.mode || 'practice',
      ids: opt.ids.slice(),
      idx: 0,
      picks: {},
      revealed: {},
      flags: {},
      startedAt: Date.now(),
      qStartAt: Date.now(),
      limitMs: opt.limitMs || 0,
      module: opt.module || null,
      label: opt.label || (opt.module ? moduleOf(opt.module).label : '综合练习'),
      order: opt.order || 'seq',
      submitted: false,
    };
    Store.state.current = null;
    aiCache = {};
    save();
    location.hash = '#/run';
  }

  function resume() {
    const c = Store.state.current;
    if (!c || !c.ids || !c.ids.length) return false;
    S = {
      mode: c.mode || 'practice',
      ids: c.ids.slice(),
      idx: c.idx || 0,
      picks: c.picks || {},
      revealed: c.revealed || {},
      flags: c.flags || {},
      startedAt: c.startedAt || Date.now(),
      qStartAt: Date.now(),
      limitMs: c.limitMs || 0,
      module: c.module || null,
      label: c.label || '继续练习',
      order: c.order || 'seq',
      submitted: !!c.submitted,
    };
    return true;
  }

  function qAt(i) { return Bank.get(S.ids[i]); }

  function isRevealed(q) { return S.mode === 'practice' && !!S.revealed[q.id]; }

  function isCorrect(q, picked) {
    return (q.answer || []).slice().sort().join('') === (picked || []).slice().sort().join('');
  }

  function answeredCount() {
    return S.ids.filter((id) => (S.picks[id] || []).length).length;
  }

  /* ---------------- 入口路由 ---------------- */
  function routeRun() {
    if (!S && !resume()) {
      location.hash = '#/practice';
      return null;
    }
    document.body.classList.add('focus-mode');
    return {
      title: S.mode === 'exam' ? '模拟考试' : '刷题',
      html: S.mode === 'exam' ? examHtml() : practiceHtml(),
      mount: bindRunner,
      bare: true,
    };
  }

  function routeExamSetup() {
    const total = Bank.questions.length;
    const html =
      '<div class="card setup-hero">' +
        '<div style="display:flex;gap:16px;align-items:center">' +
          '<span class="setup-icon" style="background:#fff1f3;color:#be123c">' + icon('clock', 26) + '</span>' +
          '<div><div class="setup-title">模拟考试</div><div class="setup-sub">按真实行测比例组卷，交卷后统一判分</div></div>' +
        '</div>' +
        '<div style="text-align:right"><div class="ss-num">' + total + '</div><div class="ss-label">题库总量</div></div>' +
      '</div>' +
      '<div class="card card-pad" style="margin-top:14px">' +
        '<div class="field" style="margin-top:0"><div class="field-label">题量</div>' +
          '<div class="seg" data-total>' +
            '<button data-v="20">20 题</button><button class="active" data-v="40">40 题</button><button data-v="60">60 题</button>' +
          '</div>' +
          '<div class="field-hint">按政治理论 8%、常识 12%、言语 26%、数量 10%、判断 26%、资料 18% 的比例抽题</div>' +
        '</div>' +
        '<div class="field"><div class="field-label">时限</div>' +
          '<div class="seg" data-limit>' +
            '<button data-v="0">不限时</button><button class="active" data-v="1">1 分钟/题</button><button data-v="0.8">48 秒/题（提速）</button>' +
          '</div>' +
        '</div>' +
        '<div class="setup-summary">' +
          '<div><div class="ss-num" data-n>40</div><div class="ss-label">题目数量</div></div>' +
          '<div style="height:34px;width:1px;background:var(--line)"></div>' +
          '<div><div class="ss-num" data-t>40</div><div class="ss-label">限时（分钟）</div></div>' +
          '<div style="flex:1"></div>' +
          '<button class="btn btn-primary btn-lg" data-start>' + icon('play', 16) + '开始考试</button>' +
        '</div>' +
        '<div class="field-hint">考试中不显示对错；可以标记题目、随时查看答题卡，交卷后统一给出成绩和错因分析。</div>' +
      '</div>';

    return {
      title: '模拟考试', eyebrow: 'MOCK EXAM', bare: false,
      actions: '<button class="btn btn-sm" data-go="#/home">' + icon('arrowLeft', 15) + '返回</button>',
      html: html,
      mount(root) {
        const st = { total: 40, limit: 1 };
        const nEl = root.querySelector('[data-n]');
        const tEl = root.querySelector('[data-t]');
        const upd = () => {
          nEl.textContent = st.total;
          tEl.textContent = st.limit ? Math.round(st.total * st.limit) : '∞';
        };
        root.addEventListener('click', (e) => {
          const tb = e.target.closest('[data-total] button');
          if (tb) {
            root.querySelectorAll('[data-total] button').forEach((b) => b.classList.remove('active'));
            tb.classList.add('active');
            st.total = Number(tb.getAttribute('data-v'));
            upd();
            return;
          }
          const lb = e.target.closest('[data-limit] button');
          if (lb) {
            root.querySelectorAll('[data-limit] button').forEach((b) => b.classList.remove('active'));
            lb.classList.add('active');
            st.limit = Number(lb.getAttribute('data-v'));
            upd();
            return;
          }
          if (e.target.closest('[data-start]')) {
            const ids = Bank.examPaper(st.total);
            start({
              mode: 'exam', ids: ids, label: st.total + ' 题模考',
              limitMs: st.limit ? Math.round(st.total * st.limit * 60000) : 0,
            });
          }
          const go = e.target.closest('[data-go]');
          if (go) location.hash = go.getAttribute('data-go');
        });
        upd();
      },
    };
  }

  /* ---------------- 刷题界面 ---------------- */
  function runnerTop() {
    const q = qAt(S.idx);
    const total = S.ids.length;
    const done = answeredCount();
    const left = S.limitMs ? Math.max(0, S.limitMs - (Date.now() - S.startedAt)) : 0;
    return '<div class="runner-top">' +
      '<button class="runner-back" data-quit aria-label="退出">' + icon('arrowLeft', 18) + '</button>' +
      '<div class="runner-meta">' +
        '<div class="runner-name"><span class="runner-label">' + esc(S.label) + '</span>' +
          '<span class="pill pill-outline" style="font-weight:500">' + (S.mode === 'exam' ? '模考' : '练习') + '</span></div>' +
        '<div class="runner-sub"><span>' + esc(q.category || '') + '</span>' +
          '<span>已答 ' + done + ' / ' + total + '</span>' +
          (S.mode === 'practice' ? '<span data-live-rate>正确率 ' + liveRate() + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="runner-progress"><div class="progress-track"><i style="width:' + Math.round((done / total) * 100) + '%"></i></div>' +
        '<span class="foot-count">' + (S.idx + 1) + '/' + total + '</span></div>' +
      (Store.state.settings.showTimer ? '<div class="runner-timer" data-timer>' + (S.limitMs ? fmtDuration(left) : '00:00') + '</div>' : '') +
      '<button class="icon-btn" data-sheet aria-label="答题卡">' + icon('grid', 18) + '</button>' +
    '</div>';
  }

  function liveRate() {
    let n = 0, c = 0;
    S.ids.forEach((id) => {
      if (S.revealed[id]) {
        n += 1;
        if (isCorrect(Bank.get(id), S.picks[id])) c += 1;
      }
    });
    return n ? pct(c, n) + '%' : '—';
  }

  function practiceHtml() {
    const q = qAt(S.idx);
    if (!q) return '<div class="empty">题目不存在</div>';
    return runnerTop() + '<div class="card q-card" data-qcard>' + questionBody(q) + '</div>' + footBar();
  }

  function examHtml() {
    const q = qAt(S.idx);
    if (!q) return '<div class="empty">题目不存在</div>';
    return runnerTop() + '<div class="card q-card" data-qcard>' + questionBody(q) + '</div>' + footBar();
  }

  function questionBody(q) {
    const revealed = isRevealed(q);
    const picked = S.picks[q.id] || [];
    const multi = (q.answer || []).length > 1;
    const material = clean(Bank.material(q));

    const opts = q.options.map((o) => {
      let cls = 'opt';
      if (revealed) {
        cls += ' locked';
        if ((q.answer || []).indexOf(o.k) >= 0) cls += ' correct';
        else if (picked.indexOf(o.k) >= 0) cls += ' wrong';
        else cls += ' dim';
      } else if (picked.indexOf(o.k) >= 0) {
        cls += ' selected';
      }
      const plainTxt = UI.plain(o.text).trim().toUpperCase();
      const letterOnly = !plainTxt || plainTxt === o.k;
      return '<button class="' + cls + (letterOnly ? ' letter-only' : '') + '" data-opt="' + o.k + '">' +
        '<span class="k">' + o.k + '</span>' +
        (letterOnly ? '' : '<span class="txt">' + clean(o.text) + '</span>') + '</button>';
    }).join('');

    return '<div class="q-head">' +
        '<span class="q-type">' + esc(q.category || '行测') + '</span>' +
        (multi ? '<span class="pill pill-amber">多选</span>' : '') +
        '<span class="q-index">' + (S.idx + 1) + ' / ' + S.ids.length + '</span>' +
        '<button class="icon-btn ' + (Store.isFav(q.id) ? 'active' : '') + '" data-fav style="margin-left:auto;width:28px;height:28px" aria-label="收藏">' +
          icon('star', 16) + '</button>' +
        '<span class="q-source">' + esc(q.source || q.paper || '') + '</span>' +
      '</div>' +
      (material ? '<div class="q-material">' + material + '</div>' +
        (/<img/.test(material) && UI.plain(material).length < 220
          ? '<div class="zoom-hint">' + icon('search', 12) + '图表可点击放大</div>' : '') : '') +
      '<div class="q-stem">' + clean(q.stem) + '</div>' +
      '<div class="options" data-options>' + opts + '</div>' +
      (revealed ? feedbackHtml(q, picked) + noteActions() : actionsHtml(q, revealed, picked));
  }

  function noteActions() {
    return '<div class="q-actions">' +
      '<button class="btn btn-sm" data-note>' + icon('note', 15) + '记笔记</button>' +
      '<div class="spacer"></div>' +
      '<span class="hint-key"><kbd>Enter</kbd> 下一题</span>' +
    '</div>';
  }

  function actionsHtml(q, revealed, picked) {
    if (revealed) {
      return '<div class="q-actions">' +
        '<button class="btn btn-sm" data-note>' + icon('note', 15) + (Store.state.notes[q.id] ? '编辑笔记' : '记笔记') + '</button>' +
        '<div class="spacer"></div>' +
        '<span class="hint-key"><kbd>Enter</kbd> 下一题</span>' +
        '<button class="btn btn-primary" data-next>' + (S.idx === S.ids.length - 1 ? '查看结果' : '下一题') + icon('arrowRight', 15) + '</button>' +
      '</div>';
    }
    const disabled = picked.length ? '' : ' disabled';
    return '<div class="q-actions">' +
      '<span class="hint-key"><kbd>1</kbd>—<kbd>' + Math.min(5, q.options.length) + '</kbd> 选择 · <kbd>Enter</kbd> 确认</span>' +
      '<div class="spacer"></div>' +
      '<button class="btn" data-skip>跳过</button>' +
      '<button class="btn btn-primary" data-submit' + disabled + '>' +
        (S.mode === 'exam' ? '保存并下一题' : '确认作答') + icon('check', 15) + '</button>' +
    '</div>';
  }

  function feedbackHtml(q, picked) {
    const ok = isCorrect(q, picked);
    const ms = S.cost && S.cost[q.id] ? S.cost[q.id] : 0;
    return '<div class="feedback" data-feedback>' +
      '<div class="fb-banner ' + (ok ? 'ok' : 'no') + '">' +
        '<div class="fb-icon">' + icon(ok ? 'check' : 'close', 18) + '</div>' +
        '<div><div class="fb-title">' + (ok ? '回答正确' : '答错了') + '</div>' +
          '<div class="fb-sub">' + (ms ? '用时 ' + Math.round(ms / 1000) + ' 秒' : '') +
          (Store.state.records[q.id] ? ' · 累计作答 ' + Store.state.records[q.id].a + ' 次' : '') + '</div></div>' +
        '<div class="fb-answer">正确答案 <b>' + (q.answer || []).join('') + '</b>' +
          '<div style="font-size:11px;opacity:.75">你的答案 ' + ((picked || []).join('') || '未作答') + '</div></div>' +
      '</div>' +
      '<div class="exp-block-title">官方解析</div>' +
      '<div class="q-explanation">' + (UI.formatExp(clean(q.explanation)) || '<span class="muted">本题暂无解析</span>') + '</div>' +
      '<div data-ai>' + aiPanelHtml(q, picked) + '</div>' +
      reasonBox(q) +
      noteHtml(q) +
    '</div>';
  }

  function noteHtml(q) {
    const note = Store.state.notes[q.id];
    if (!note) return '';
    return '<div class="field-hint" style="margin-top:14px;background:var(--amber-soft);padding:10px 12px;border-radius:8px;color:#7c4a03">' +
      '<b>我的笔记：</b>' + esc(note) + '</div>';
  }

  function reasonBox(q) {
    const val = Store.state.reasons[q.id] || '';
    const tips = ['粗心看错题', '知识点没记住', '时间不够，最后蒙的', '两个选项纠结很久'];
    return '<div class="reason-box">' +
      '<div class="reason-head">' +
        '<span class="reason-title">' + icon('note', 14) + '分析不准？说说你当时的真实想法</span>' +
        '<span class="reason-sub">' + (AI.hasKey() ? '会随题目一起发给模型' : '本地诊断会参考你的说明') + '</span>' +
      '</div>' +
      '<textarea class="reason-input" data-reason maxlength="300" placeholder="例如：把“同比”看成“环比”了；最后 10 秒蒙的；两个选项纠结很久……">' + esc(val) + '</textarea>' +
      '<div class="reason-chips">' +
        tips.map((t) => '<button class="chip" data-reason-chip="' + t + '">' + t + '</button>').join('') +
      '</div>' +
      '<div class="reason-foot">' +
        '<span class="reason-tip">只保存在本机，不会公开</span>' +
        '<button class="btn btn-sm btn-soft" data-reanalyze-self>' + icon('sparkles', 14) + '结合我的说明重新分析</button>' +
      '</div>' +
    '</div>';
  }

  function aiPanelHtml(q, picked) {
    const a = aiCache[q.id];
    if (!a) {
      const ready = AI.hasKey();
      return '<div class="ai-panel"><div class="ai-head">' +
        '<span class="ai-spark">' + icon('sparkles', 15) + '</span>' +
        '<div><div class="ai-title">AI 错因分析</div><div class="ai-sub">' +
          (ready ? '结合你的选择，诊断思维断点' : '当前使用内置诊断引擎，配置 API 后可获得更细分析') + '</div></div></div>' +
        '<div class="ai-body" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<button class="btn btn-sm btn-soft" data-analyze>' + icon('sparkles', 14) + '分析这道题</button>' +
          (ready ? '' : '<a class="btn btn-sm btn-ghost" href="#/settings">配置 AI 模型</a>') +
        '</div></div>';
    }
    if (a.loading) {
      return '<div class="ai-panel"><div class="ai-head">' +
        '<span class="ai-spark">' + icon('sparkles', 15) + '</span>' +
        '<div><div class="ai-title">AI 正在分析你的作答</div><div class="ai-sub">正在定位思维断点…</div></div></div>' +
        '<div class="ai-body skeleton"><div class="sk-line" style="width:92%"></div><div class="sk-line" style="width:100%"></div>' +
        '<div class="sk-line" style="width:76%"></div><div class="sk-line" style="width:88%"></div></div></div>';
    }
    const tag = a.source === 'ai'
      ? '<span class="pill pill-violet">模型诊断</span>'
      : '<span class="pill pill-outline">本地诊断</span>';
    return '<div class="ai-panel">' +
      '<div class="ai-head"><span class="ai-spark">' + icon('sparkles', 15) + '</span>' +
        '<div style="flex:1"><div class="ai-title">错因分析</div>' +
          '<div class="ai-sub">' + esc(a.errorType || '') + '</div></div>' + tag + '</div>' +
      '<div class="ai-body">' +
        (a.error ? '<div class="field-hint" style="color:var(--amber);margin-bottom:8px">在线分析未成功：' + esc(a.error) + '，以下为本地诊断。</div>' : '') +
        (a.selfReason ? '<div class="ai-self">你的补充：' + esc(a.selfReason) + '</div>' : '') +
        '<p>' + esc(a.diagnosis || '') + '</p>' +
        (a.trap ? '<h4>' + icon('target', 14) + '选项陷阱</h4><p>' + esc(a.trap) + '</p>' : '') +
        (a.method && a.method.length ? '<h4>' + icon('layers', 14) + '下次这样做</h4><ul>' +
          a.method.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
        (a.reminder ? '<div style="margin-top:12px;padding:9px 12px;background:#f7f5ff;border-radius:8px;color:#4c1d95;font-size:12.5px">' +
          '一句话：' + esc(a.reminder) + '</div>' : '') +
        (a.knowledge && a.knowledge.length ? '<div class="ai-tags">' +
          a.knowledge.map((k) => '<span class="ai-tag">' + esc(k) + '</span>').join('') + '</div>' : '') +
      '</div>' +
      '<div class="ai-actions"><button class="btn btn-sm btn-ghost" data-reanalyze>' + icon('rotate', 14) + '重新分析</button>' +
        (AI.hasKey() ? '<span class="muted" style="font-size:11px">由 ' + esc(Store.state.settings.apiModel) + ' 生成，仅供参考</span>'
                     : '<a class="btn btn-sm btn-ghost" href="#/settings">配置 AI</a>') +
      '</div></div>';
  }

  function footBar() {
    const isLast = S.idx === S.ids.length - 1;
    const q = qAt(S.idx);
    const revealed = q && isRevealed(q);
    let right;
    if (S.mode === 'exam') {
      right = '<button class="btn btn-primary" data-finish>' + icon('check', 15) + '交卷</button>';
    } else if (revealed) {
      right = isLast
        ? '<button class="btn btn-primary" data-finish>' + icon('chart', 15) + '完成练习</button>'
        : '<button class="btn btn-primary" data-next>下一题 ' + icon('arrowRight', 15) + '</button>';
    } else {
      right = '<button class="btn" data-skip>跳过 ' + icon('arrowRight', 15) + '</button>';
    }
    return '<div class="runner-foot"><div class="inner">' +
      '<button class="btn" data-prev' + (S.idx === 0 ? ' disabled' : '') + '>' + icon('arrowLeft', 15) + '上一题</button>' +
      '<span class="foot-count">第 ' + (S.idx + 1) + ' / ' + S.ids.length + ' 题</span>' +
      '<div class="spacer"></div>' + right +
    '</div></div>';
  }

  function render() {
    const view = $('#view');
    if (!view) return;
    const app = document.querySelector('.app');
    if (app) app.classList.remove('hidden');
    view.innerHTML = S.mode === 'exam' ? examHtml() : practiceHtml();
    bindRunner(view);
    UI.texify(view);
    startTimer();
  }

  /* ---------------- 交互 ---------------- */
  function bindRunner(root) {
    root.oninput = (e) => {
      const ta = e.target.closest('[data-reason]');
      if (ta && S) Store.setReason(S.ids[S.idx], ta.value);
    };
    root.onclick = (e) => {
      if (!S) return;
      const q = qAt(S.idx);
      if (!q) return;
      const zoom = e.target.closest('.q-material img, .q-stem img, .opt img');
      if (zoom) {
        UI.modal({
          title: '查看大图', sub: '资料图表 / 图形推理配图', wide: true,
          body: '<img src="' + zoom.getAttribute('src') + '" alt="" style="width:100%;border-radius:8px">',
        });
        return;
      }
      const opt = e.target.closest('[data-opt]');
      if (opt) {
        if (isRevealed(q)) return;
        const k = opt.getAttribute('data-opt');
        const cur = (S.picks[q.id] || []).slice();
        const multi = (q.answer || []).length > 1;
        if (S.mode === 'exam' && !multi) {
          S.picks[q.id] = [k];
          save();
          render();
          return;
        }
        if (multi) {
          const i = cur.indexOf(k);
          if (i >= 0) cur.splice(i, 1); else cur.push(k);
          S.picks[q.id] = cur.sort();
        } else {
          S.picks[q.id] = [k];
        }
        save();
        render();
        return;
      }

      if (e.target.closest('[data-submit]')) {
        const picked = S.picks[q.id] || [];
        if (!picked.length) return;
        if (S.mode === 'exam') {
          save();
          if (S.idx < S.ids.length - 1) { S.idx += 1; save(); render(); }
          else openSheet();
          return;
        }
        confirmAnswer(q);
        return;
      }

      if (e.target.closest('[data-next]')) { go(S.idx + 1); return; }
      if (e.target.closest('[data-prev]')) { go(S.idx - 1); return; }
      if (e.target.closest('[data-skip]')) {
        if (S.mode === 'practice') { S.revealed[q.id] = true; save(); render(); }
        else if (S.idx < S.ids.length - 1) go(S.idx + 1);
        return;
      }
      if (e.target.closest('[data-finish]')) { finish(); return; }
      if (e.target.closest('[data-quit]')) {
        UI.confirmDialog('退出本次' + (S.mode === 'exam' ? '考试' : '练习') + '？',
          '已作答的内容会保留在答题卡中，下次可以从首页继续。', '退出', true).then((ok) => {
            if (!ok) return;
          save();
          clearTimer();
          S = null;
          location.hash = '#/home';
        });
        return;
      }
      if (e.target.closest('[data-sheet]')) { openSheet(); return; }
      if (e.target.closest('[data-fav]')) {
        const on = Store.toggleFav(q.id);
        toast(on ? '已收藏' : '已取消收藏', 'ok');
        render();
        return;
      }
      const chip = e.target.closest('[data-reason-chip]');
      if (chip) {
        const ta = root.querySelector('[data-reason]');
        const t = chip.getAttribute('data-reason-chip');
        if (ta) {
          const old = ta.value.trim().replace(/[；;]\s*$/, '');
          ta.value = old ? old + '；' + t : t;
          Store.setReason(q.id, ta.value);
          ta.focus();
        }
        return;
      }
      if (e.target.closest('[data-reanalyze-self]')) {
        const ta = root.querySelector('[data-reason]');
        const v = ta ? ta.value.trim() : '';
        if (!v) { toast('先写下你当时的想法，再重新分析', 'no'); if (ta) ta.focus(); return; }
        Store.setReason(q.id, v);
        aiCache[q.id] = null;
        ensureAI(q, S.picks[q.id] || []);
        rerenderAI(q);
        toast('已结合你的说明重新分析', 'ok');
        return;
      }
      if (e.target.closest('[data-analyze]') || e.target.closest('[data-reanalyze]')) {
        aiCache[q.id] = null;
        ensureAI(q, S.picks[q.id] || []);
        rerenderAI(q);
        return;
      }
      if (e.target.closest('[data-note]')) {
        UI.modal({
          title: '记笔记', sub: '写下这道题的易错点，下次复习用',
          body: '<textarea class="textarea" data-note-text placeholder="例如：看到「同比」先找基期，别用现期直接除">' +
            esc(Store.state.notes[q.id] || '') + '</textarea>',
          footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" data-save-note>保存</button>',
          onMount(el, close) {
            el.querySelector('[data-save-note]').addEventListener('click', () => {
              const v = el.querySelector('[data-note-text]').value.trim();
              if (v) Store.state.notes[q.id] = v; else delete Store.state.notes[q.id];
              Store.save(true);
              close();
              toast('笔记已保存', 'ok');
              render();
            });
          },
        });
        return;
      }
    };
  }

  function confirmAnswer(q) {
    const picked = S.picks[q.id] || [];
    const ok = isCorrect(q, picked);
    const cost = Date.now() - (S.qStartAt || Date.now());
    S.cost = S.cost || {};
    S.cost[q.id] = cost;
    S.revealed[q.id] = true;
    Store.record(q.id, ok, picked, cost);
    save();
    render();
    setTimeout(() => {
      const fb = document.querySelector('[data-feedback]');
      if (fb) fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
    if (Store.state.settings.autoAnalyze) {
      ensureAI(q, picked);
      rerenderAI(q);
    }
    if (ok && Store.state.settings.autoNext && S.idx < S.ids.length - 1) {
      setTimeout(() => { if (S && isRevealed(q)) go(S.idx + 1); }, 700);
    }
  }

  function go(i) {
    if (!S) return;
    if (i < 0) i = 0;
    if (i >= S.ids.length) { finish(); return; }
    S.idx = i;
    S.qStartAt = Date.now();
    save();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function ensureAI(q, picked) {
    if (aiCache[q.id] && !aiCache[q.id].loading) return;
    aiCache[q.id] = { loading: true };
    const ms = S.cost && S.cost[q.id] ? S.cost[q.id] : 0;
    const reason = Store.state.reasons[q.id] || '';
    AI.analyze(q, picked, ms, reason).then((res) => {
      aiCache[q.id] = res;
      if (S && S.ids[S.idx] === q.id) rerenderAI(q);
    }).catch(() => {
      aiCache[q.id] = AI.localAnalyze(q, picked, ms, reason);
      if (S && S.ids[S.idx] === q.id) rerenderAI(q);
    });
  }

  function rerenderAI(q) {
    const box = document.querySelector('[data-ai]');
    if (!box) return;
    box.innerHTML = aiPanelHtml(q, S.picks[q.id] || []);
  }

  /* ---------------- 计时 ---------------- */
  function startTimer() {
    clearTimer();
    if (!Store.state.settings.showTimer) return;
    timer = setInterval(() => {
      if (!S) return;
      if (S.mode === 'exam' && S.limitMs) {
        const left = Math.max(0, S.limitMs - (Date.now() - S.startedAt));
        const el = document.querySelector('[data-timer]');
        if (el) {
          el.textContent = fmtDuration(left);
          el.style.color = left < 60000 ? 'var(--red)' : '';
        }
        if (left <= 0) { clearTimer(); finish(true); }
      } else {
        const el = document.querySelector('[data-timer]');
        if (el) el.textContent = fmtDuration(Date.now() - S.startedAt);
      }
    }, 1000);
  }

  function clearTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  /* ---------------- 答题卡 ---------------- */
  function openSheet() {
    const cells = S.ids.map((id, i) => {
      const q = Bank.get(id);
      const done = (S.picks[id] || []).length > 0;
      const revealed = S.mode === 'practice' && S.revealed[id];
      const ok = revealed && isCorrect(q, S.picks[id]);
      return '<button class="sheet-cell' + (done ? ' done' : '') + (revealed ? (ok ? ' ok' : ' no') : '') +
        (S.flags[id] ? ' flag' : '') + (i === S.idx ? ' cur' : '') +
        '" data-jump="' + i + '">' + (i + 1) + '</button>';
    }).join('');
    const m = UI.modal({
      title: '答题卡', sub: '已答 ' + answeredCount() + ' / ' + S.ids.length + ' 题',
      wide: true,
      body: '<div class="sheet-grid">' + cells + '</div>' +
        '<div class="sheet-legend"><span><i style="background:var(--brand-soft);border:1px solid var(--brand-line)"></i>已作答</span>' +
        '<span><i style="background:#fff;border:1px solid var(--line-strong)"></i>未作答</span>' +
        (S.mode === 'practice' ? '<span><i style="background:var(--green-soft);border:1px solid #9ddcbb"></i>答对</span>' +
          '<span><i style="background:var(--red-soft);border:1px solid #eeb8b8"></i>答错</span>' : '') +
        '<span><i style="background:var(--brand)"></i>当前题</span></div>' +
        (S.mode === 'exam'
          ? '<div class="field-hint">提前交卷后不再显示对错，交卷即出成绩。</div>'
          : '<div class="field-hint">点击题号可以跳转，练习模式支持随时回看解析。</div>'),
      footer: S.mode === 'exam'
        ? '<button class="btn" data-close>继续答题</button><button class="btn btn-primary" data-do-finish>交卷</button>'
        : '<button class="btn" data-close>继续答题</button><button class="btn btn-primary" data-do-finish>结束练习</button>',
      onMount(el, close) {
        el.addEventListener('click', (e) => {
          const j = e.target.closest('[data-jump]');
          if (j) { close(); go(Number(j.getAttribute('data-jump'))); return; }
          if (e.target.closest('[data-do-finish]')) { close(); finish(); }
        });
      },
    });
    return m;
  }

  /* ---------------- 交卷 / 结果 ---------------- */
  function finish(auto) {
    if (!S) return;
    const total = S.ids.length;
    const elapsed = Date.now() - S.startedAt;
    const perQuestion = Math.round(elapsed / Math.max(1, total));
    let correct = 0;
    const wrong = [];
    const mods = {};
    const unanswered = [];

    S.ids.forEach((id) => {
      const q = Bank.get(id);
      if (!q) return;
      const picked = S.picks[id] || [];
      const ok = picked.length ? isCorrect(q, picked) : false;
      if (ok) correct += 1;
      else {
        if (!picked.length) unanswered.push(id);
        else wrong.push({
          id: id, stem: q.stem, category: q.category, module: q.module,
          picked: picked, answer: q.answer,
        });
      }
      const m = mods[q.module] || (mods[q.module] = { key: q.module, total: 0, correct: 0 });
      m.total += 1;
      if (ok) m.correct += 1;
      // 模考：未作答按错计入成绩，但不写入错题本；已作答的题正常记录
      if (picked.length && !S.revealed[id]) {
        Store.record(id, ok, picked, S.mode === 'exam' ? perQuestion : ((S.cost && S.cost[id]) || 0));
      }
    });

    const ms = elapsed;
    const modules = Object.keys(mods).map((k) => {
      const m = mods[k];
      return {
        key: k, label: moduleOf(k).label, total: m.total, correct: m.correct,
        rate: pct(m.correct, m.total),
      };
    }).sort((a, b) => a.rate - b.rate);

    const answers = S.ids.filter((id) => (S.picks[id] || []).length).length;
    const report = {
      mode: S.mode, label: S.label, total: total, correct: correct,
      answered: answers, rate: pct(correct, total), ms: ms,
      modules: modules, wrong: wrong, unanswered: unanswered,
      at: Date.now(), examIds: S.ids.slice(),
    };
    lastReport = report;
    Store.addSession({
      mode: S.mode, label: S.label, total: total, correct: correct,
      rate: report.rate, ms: ms, at: report.at,
    });
    Store.state.current = null;
    Store.save(true);
    clearTimer();
    S = null;
    location.hash = '#/report';
    if (auto) toast('时间到，已自动交卷', 'no');
  }

  /* ---------------- 报告页 ---------------- */
  function reportView() {
    const r = lastReport;
    if (!r) {
      return {
        title: '成绩报告', eyebrow: 'RESULT',
        html: '<div class="empty"><div class="empty-icon">' + icon('chart', 26) + '</div>' +
          '<div class="empty-title">还没有可查看的成绩</div><div class="empty-sub">先完成一次练习或模拟考试</div>' +
          '<button class="btn btn-primary" data-go="#/practice">开始刷题</button></div>',
        mount(root) {
          root.addEventListener('click', (e) => {
            const g = e.target.closest('[data-go]');
            if (g) location.hash = g.getAttribute('data-go');
          });
        },
      };
    }

    const modBars = r.modules.map((m) =>
      '<div class="bar-row"><span class="br-name">' + esc(moduleOf(m.key).short) + '</span>' +
        '<span class="br-track"><i class="' + (m.rate < 55 ? 'low' : '') + '" style="width:' + Math.max(2, m.rate) + '%"></i></span>' +
        '<span class="br-val"><b>' + m.rate + '%</b> · ' + m.correct + '/' + m.total + '</span></div>'
    ).join('');

    const wrongList = r.wrong.length
      ? r.wrong.slice(0, 20).map((w) =>
          '<div class="q-item"><div class="q-item-main">' +
            '<div class="q-item-top">' + modulePillMini(w.module) +
              '<span class="pill pill-outline">' + esc(w.category || '') + '</span>' +
              '<span class="pill pill-red">选 ' + (w.picked || []).join('') + ' · 对 ' + (w.answer || []).join('') + '</span></div>' +
            '<div class="q-item-stem">' + esc(UI.plain(w.stem).slice(0, 100)) + '</div>' +
          '</div><div class="q-item-actions"><button class="btn btn-sm" data-view="' + w.id + '">看解析</button></div></div>'
        ).join('')
      : '<div class="empty" style="padding:34px"><div class="empty-title">全对，没有错题</div>' +
        '<div class="empty-sub">要么题目太简单，要么你真的学会了。</div></div>';

    const minutes = Math.round(r.ms / 60000 * 10) / 10;
    const html =
      '<div class="report-hero">' +
        '<div class="report-score"><div class="num">' + r.rate + '<small>%</small></div>' +
          '<div class="label">正确率</div></div>' +
        '<div class="report-meta">' +
          '<div><div class="rm-label">答对 / 总题数</div><div class="rm-val">' + r.correct + ' / ' + r.total + '</div></div>' +
          '<div><div class="rm-label">用时</div><div class="rm-val">' + (minutes >= 1 ? minutes + ' 分钟' : Math.round(r.ms / 1000) + ' 秒') + '</div></div>' +
          '<div><div class="rm-label">作答率</div><div class="rm-val">' + pct(r.answered, r.total) + '%</div></div>' +
        '</div>' +
      '</div>' +

      '<div class="section grid grid-2" style="align-items:start">' +
        '<div class="card card-pad"><div class="section-title" style="margin-bottom:6px">模块表现</div>' +
          '<div class="section-sub" style="margin-bottom:8px">正确率从低到高排列</div>' + modBars + '</div>' +
        '<div class="card card-pad" style="display:flex;flex-direction:column">' +
          '<div class="chart-head" style="margin-bottom:8px"><div><div class="section-title">AI 学习诊断</div>' +
            '<div class="section-sub">基于本套错题给出下一步计划</div></div>' +
            '<span class="pill pill-violet">' + (AI.hasKey() ? '可用' : '本地') + '</span></div>' +
          '<div data-report-ai style="flex:1">' + reportAIHtml() + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="section card card-pad">' +
        '<div class="chart-head"><div><div class="section-title">错题复盘</div>' +
          '<div class="section-sub">' + (r.wrong.length ? '共 ' + r.wrong.length + ' 道，' + r.unanswered.length + ' 道未作答' : '本套无错题') + '</div></div>' +
          (r.wrong.length ? '<button class="btn btn-sm btn-primary" data-redo-wrong>' + icon('rotate', 15) + '重做错题</button>' : '') +
        '</div>' + wrongList +
      '</div>' +

      '<div class="section" style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" data-go="#/exam">' + icon('clock', 15) + '再来一套</button>' +
        '<button class="btn" data-go="#/stats">' + icon('chart', 15) + '查看学习报告</button>' +
        '<button class="btn btn-ghost" data-go="#/home">返回首页</button>' +
      '</div>';

    return {
      title: '成绩报告', eyebrow: 'RESULT',
      actions: '<span class="pill ' + (r.rate >= 80 ? 'pill-green' : r.rate >= 60 ? 'pill-amber' : 'pill-red') + '">' +
        r.total + ' 题' + (r.mode === 'exam' ? '模考' : '练习') + ' · ' + r.rate + '%</span>',
      html: html,
      mount(root) {
        root.addEventListener('click', (e) => {
          const g = e.target.closest('[data-go]');
          if (g) { location.hash = g.getAttribute('data-go'); return; }
          const v = e.target.closest('[data-view]');
          if (v) { BankUI.review(v.getAttribute('data-view')); return; }
          if (e.target.closest('[data-redo-wrong]')) {
            const ids = r.wrong.map((w) => w.id);
            start({ mode: 'practice', ids: ids, order: 'random', label: '错题重做' });
            return;
          }
          if (e.target.closest('[data-report-analyze]')) {
            runReportAI(r, root);
          }
        });
      },
    };
  }

  function modulePillMini(key) {
    const m = moduleOf(key);
    return '<span class="pill" style="background:' + m.bg + ';color:' + m.fg + '">' + esc(m.short) + '</span>';
  }

  let reportAI = null;
  function reportAIHtml() {
    if (!reportAI) {
      return '<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">' +
        '<div class="field-hint" style="margin:0">会分析本套错题的共性，指出薄弱考点，并给出可执行的下一步计划。</div>' +
        '<button class="btn btn-soft" data-report-analyze>' + icon('sparkles', 15) + '生成诊断报告</button></div>';
    }
    if (reportAI.loading) {
      return '<div class="skeleton"><div class="sk-line" style="width:90%"></div><div class="sk-line"></div>' +
        '<div class="sk-line" style="width:70%"></div><div class="sk-line" style="width:84%"></div></div>';
    }
    const d = reportAI;
    return '<div>' +
      '<p style="font-size:13.5px;line-height:1.8;margin-bottom:10px">' + esc(d.summary) + '</p>' +
      (d.problems && d.problems.length ? '<div class="exp-block-title" style="margin-top:12px">薄弱环节</div>' + d.problems.map((p) =>
        '<div style="margin:8px 0;padding:9px 11px;background:var(--surface-2);border-radius:8px">' +
        '<div style="font-size:12.5px;font-weight:650;color:var(--red)">' + esc(p.topic) +
        (p.count ? ' · ' + p.count + ' 处' : '') + '</div>' +
        '<div style="font-size:12px;color:var(--ink-3);line-height:1.65;margin-top:2px">' + esc(p.advice || '') + '</div></div>').join('') : '') +
      (d.plan && d.plan.length ? '<div class="exp-block-title" style="margin-top:12px">下一步</div><ul style="padding-left:16px;list-style:disc;font-size:12.5px">' +
        d.plan.map((x) => '<li style="margin:4px 0">' + esc(x) + '</li>').join('') + '</ul>' : '') +
      '<div class="field-hint" style="margin-top:12px;color:#4c1d95">' + esc(d.encouragement || '') + '</div>' +
      '</div>';
  }

  function runReportAI(r, root) {
    if (reportAI && (reportAI.loading || reportAI.summary)) return;
    reportAI = { loading: true };
    const box = root.querySelector('[data-report-ai]');
    if (box) box.innerHTML = reportAIHtml();
    AI.report({
      total: r.total, correct: r.correct, minutes: Math.round(r.ms / 60000),
      modules: r.modules, wrong: r.wrong,
    }).then((d) => {
      reportAI = d;
      const b = document.querySelector('[data-report-ai]');
      if (b) b.innerHTML = reportAIHtml();
    });
  }

  window.Practice = {
    start: start,
    routeRun: routeRun,
    routeExamSetup: routeExamSetup,
    reportView: reportView,
    hasSession: () => !!S,
    clear: () => { clearTimer(); S = null; },
  };
  window.modulePillMini = modulePillMini;

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (!S || document.body.classList.contains('focus-mode') === false) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (document.querySelector('.modal-mask')) return;
    const q = qAt(S.idx);
    if (!q) return;
    if (/^[1-5]$/.test(e.key)) {
      const idx = Number(e.key) - 1;
      const o = q.options[idx];
      if (o) {
        e.preventDefault();
        const cur = (S.picks[q.id] || []).slice();
        const multi = (q.answer || []).length > 1;
        if (S.mode === 'exam' && !multi) S.picks[q.id] = [o.k];
        else if (multi) {
          const i = cur.indexOf(o.k);
          if (i >= 0) cur.splice(i, 1); else cur.push(o.k);
          S.picks[q.id] = cur.sort();
        } else S.picks[q.id] = [o.k];
        save();
        render();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isRevealed(q) || (S.mode === 'practice' && S.revealed[q.id])) {
        if (S.idx < S.ids.length - 1) go(S.idx + 1); else finish();
      } else if ((S.picks[q.id] || []).length) {
        if (S.mode === 'exam') {
          if (S.idx < S.ids.length - 1) go(S.idx + 1); else finish();
        } else confirmAnswer(q);
      }
      return;
    }
    if (e.key === 'ArrowRight' && S.idx < S.ids.length - 1) { go(S.idx + 1); }
    if (e.key === 'ArrowLeft' && S.idx > 0) { go(S.idx - 1); }
  });
})();
