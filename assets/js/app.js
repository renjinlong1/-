/* ==========================================================
   app.js — 路由、导航、初始化
   ========================================================== */
(function () {
  'use strict';

  const { $, esc, icon, toast } = UI;

  const NAV = [
    { group: '学习' },
    { route: 'home', label: '学习看板', icon: 'home', hash: '#/home' },
    { route: 'practice', label: '分类刷题', icon: 'practice', hash: '#/practice' },
    { route: 'exam', label: '模拟考试', icon: 'clock', hash: '#/exam' },
    { group: '复习' },
    { route: 'wrong', label: '错题本', icon: 'wrong', hash: '#/wrong', badge: 'wrong' },
    { route: 'fav', label: '收藏夹', icon: 'star', hash: '#/fav' },
    { group: '数据' },
    { route: 'stats', label: '学习报告', icon: 'chart', hash: '#/stats' },
    { route: 'bank', label: '题库管理', icon: 'book', hash: '#/bank' },
    { route: 'settings', label: '设置', icon: 'settings', hash: '#/settings' },
  ];

  const MOBILE_NAV = ['home', 'practice', 'wrong', 'stats', 'settings'];

  function parseHash() {
    const raw = (location.hash || '#/home').replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    return { name: parts[0] || 'home', param: parts[1] || null };
  }

  function currentRouteName() {
    const r = parseHash();
    if (r.name === 'run') return 'practice';
    if (r.name === 'report') return 'practice';
    return r.name;
  }

  function buildSidebar() {
    const nav = $('#nav');
    const wrongN = Store.wrongIds().length;
    const active = currentRouteName();
    let html = '';
    NAV.forEach((item) => {
      if (item.group) { html += '<div class="nav-label">' + item.group + '</div>'; return; }
      const isActive = item.route === active;
      html += '<a class="nav-item' + (isActive ? ' active' : '') + '" href="' + item.hash + '">' +
        icon(item.icon, 18) + '<span>' + item.label + '</span>' +
        (item.badge === 'wrong' && wrongN ? '<span class="nav-badge">' + wrongN + '</span>' : '') +
        '</a>';
    });
    nav.innerHTML = html;

    const mnav = $('#mnav');
    if (mnav) {
      mnav.innerHTML = MOBILE_NAV.map((name) => {
        const item = NAV.filter((x) => x.route === name)[0];
        const isActive = name === active;
        return '<a class="nav-item' + (isActive ? ' active' : '') + '" href="' + item.hash + '">' +
          icon(item.icon, 20) + '<span>' + (name === 'home' ? '首页' : item.label.replace('分类', '').replace('学习', '')) + '</span>' +
          (name === 'wrong' && wrongN ? '<span class="nav-badge">' + wrongN + '</span>' : '') + '</a>';
      }).join('');
    }

    const foot = $('#side-foot');
    if (foot) {
      const streak = Store.streak();
      const t = Store.totals();
      foot.innerHTML = '<div class="side-card">' +
        '<div class="side-card-top">' + icon('flame', 14) + '连续打卡</div>' +
        '<div class="side-card-num">' + streak + '<small>天</small></div>' +
        '<div class="side-card-top" style="margin-top:8px;font-size:11px">累计 ' + t.attempts + ' 题 · 正确率 ' + (t.attempts ? t.rate + '%' : '—') + '</div>' +
        '</div>';
    }
  }

  function showView(v) {
    // 每次渲染都换一个新的容器，避免旧页面的事件监听残留
    const old = $('#view');
    const view = document.createElement('div');
    view.className = 'view';
    view.id = 'view';
    old.replaceWith(view);
    view.innerHTML = v.html;
    if (v.mount) v.mount(view);
    UI.texify(view);
    if (v.bare) {
      $('#topbar').style.display = 'none';
    } else {
      $('#topbar').style.display = '';
      $('#topbar').innerHTML =
        '<div class="topbar-left">' +
          '<span class="brand-mark mobile-brand" style="width:32px;height:32px;font-size:15px">岸</span>' +
          '<div><div class="page-eyebrow">' + esc(v.eyebrow || '') + '</div>' +
          '<h1 class="page-title">' + esc(v.title || '') + '</h1></div>' +
        '</div>' +
        '<div class="topbar-actions">' + (v.actions || '') + '</div>';
    }
    document.title = (v.title ? v.title + ' · ' : '') + '上岸行测刷题';
  }

  function errorView(msg) {
    return {
      title: '加载出错', eyebrow: 'ERROR',
      html: '<div class="empty"><div class="empty-icon">' + icon('close', 26) + '</div>' +
        '<div class="empty-title">页面渲染失败</div>' +
        '<div class="empty-sub">' + esc(msg) + '</div>' +
        '<button class="btn" onclick="location.reload()">重新加载</button></div>',
      mount: function () {},
    };
  }

  const App = {
    render() {
      const r = parseHash();
      let v;

      if (r.name !== 'run') Practice.clear();

      if (r.name === 'run') {
        v = Practice.routeRun();
        if (!v) return;
      } else {
        document.body.classList.remove('focus-mode');
        switch (r.name) {
          case 'home': v = Views.home(); break;
          case 'practice': v = Views.practiceSetup(r.param); break;
          case 'exam': v = Practice.routeExamSetup(); break;
          case 'report': v = Practice.reportView(); break;
          case 'wrong': v = Views.wrongBook(); break;
          case 'fav': v = Views.favorites(); break;
          case 'stats': v = Views.stats(); break;
          case 'bank': v = Views.bankPage(); break;
          case 'settings': v = Views.settings(); break;
          case 'random': {
            const ids = Bank.pick({ count: 10, order: 'random' });
            if (!ids.length) { location.hash = '#/practice'; return; }
            Practice.start({ mode: 'practice', ids: ids, label: '随机练习', order: 'random' });
            return;
          }
          default:
            v = Views.home();
        }
      }

      try {
        showView(v);
        buildSidebar();
        window.scrollTo({ top: 0 });
      } catch (e) {
        console.error(e);
        showView(errorView(e.message || '未知错误'));
      }
    },

    init() {
      Store.load();

      // 恢复自定义题库
      if (Store.state.custom && Store.state.custom.questions && Store.state.custom.questions.length) {
        Bank.addCustom(Store.state.custom);
        window.__CUSTOM_BANK__ = Store.state.custom;
      }

      if (!Bank.questions.length) {
        $('#view').innerHTML = '<div class="empty" style="margin-top:60px">' +
          '<div class="empty-icon">' + icon('book', 26) + '</div>' +
          '<div class="empty-title">题库还没有生成</div>' +
          '<div class="empty-sub">在项目目录执行 <code>python tools/fetch_bank.py</code> 抓取题库，' +
          '或到「题库管理」导入自己的 JSON 题库。</div>' +
          '<button class="btn btn-primary" id="go-import">去导入题库</button></div>';
        $('#go-import').onclick = () => { location.hash = '#/bank'; };
        return;
      }

      window.addEventListener('hashchange', () => App.render());
      window.addEventListener('beforeunload', () => Store.save(true));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') Store.save(true);
      });
      if (!location.hash) location.replace('#/home');
      App.render();
    },
  };

  window.App = App;
  App.init();
})();
