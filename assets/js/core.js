/* ==========================================================
   core.js — 工具、图标、存储、弹窗
   ========================================================== */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  const dateKey = (d) => {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  };
  const addDays = (key, n) => {
    const p = key.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  };
  const fmtDuration = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(sec) : pad2(m) + ':' + pad2(sec);
  };
  const fmtTime = (ts) => {
    const d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  };
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const plain = (html) => {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  };

  /* ------------------ 图标 ------------------ */
  const P = {
    home: '<path d="M3.5 10.6 12 3.4l8.5 7.2V20a1 1 0 0 1-1 1h-4.8v-6.6H9.3V21H4.5a1 1 0 0 1-1-1z"/>',
    practice: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M8 8.5h8M8 12h6M8 15.5h4"/>',
    wrong: '<circle cx="12" cy="12" r="8.6"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.4"/><circle cx="10" cy="17" r="2.4"/>',
    star: '<path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    arrowRight: '<path d="M4.5 12h15M13 5.5l6.5 6.5L13 18.5"/>',
    arrowLeft: '<path d="M19.5 12h-15M11 18.5L4.5 12 11 5.5"/>',
    clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.5V12l3 2"/>',
    sparkles: '<path d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6L5.7 9.8l4.6-1.7z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V16"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V16"/>',
    trash: '<path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.8 13.2h9.4L17.5 7"/><path d="M10.5 11v5.5M13.5 11v5.5"/>',
    flame: '<path d="M12 3.2c3.2 3.4 5.6 6 5.6 9.4A5.6 5.6 0 0 1 12 18.2a5.6 5.6 0 0 1-5.6-5.6c0-2 .9-3.6 2.2-4.9.3 1.6 1.2 2.4 2.2 2.4 1.2 0 1.9-1 1.9-2.6 0-1.6-.4-2.8-.7-4.3z"/>',
    target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1"/>',
    book: '<path d="M4 4.8A1.8 1.8 0 0 1 5.8 3H19v15.5H5.8A1.8 1.8 0 0 0 4 20.3z"/><path d="M4 20.3A1.8 1.8 0 0 1 5.8 18.5H19V21H5.8"/>',
    layers: '<path d="M12 3.5l8.5 4.6L12 12.7 3.5 8.1z"/><path d="M3.5 12.6L12 17.2l8.5-4.6M3.5 16.8L12 21.4l8.5-4.6"/>',
    grid: '<rect x="3.8" y="3.8" width="7" height="7" rx="1.6"/><rect x="13.2" y="3.8" width="7" height="7" rx="1.6"/><rect x="3.8" y="13.2" width="7" height="7" rx="1.6"/><rect x="13.2" y="13.2" width="7" height="7" rx="1.6"/>',
    flag: '<path d="M6 21V4.5h12l-2.4 4.4L18 13H6"/>',
    search: '<circle cx="11" cy="11" r="6.6"/><path d="M16 16l4.2 4.2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevron: '<path d="M6 9.5l6 6 6-6"/>',
    rotate: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4.5V11h-6.5"/>',
    note: '<path d="M5 4.5h14v15H5z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="M8 5.5l10 6.5-10 6.5z"/>',
    shield: '<path d="M12 3.4l7 2.8v5.5c0 4.2-2.8 7.4-7 8.9-4.2-1.5-7-4.7-7-8.9V6.2z"/><path d="M9 12l2.2 2.2L15.4 10"/>',
  };

  function icon(name, size) {
    const p = P[name] || P.grid;
    return '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) +
      '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ------------------ HTML 清洗 ------------------ */
  const ALLOWED = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'SUB', 'SUP', 'TABLE', 'THEAD', 'TBODY',
    'TR', 'TD', 'TH', 'UL', 'OL', 'LI', 'SPAN', 'IMG', 'DIV', 'H3', 'H4', 'BLOCKQUOTE']);

  function clean(html) {
    if (!html) return '';
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html);
    const walk = (node) => {
      Array.prototype.slice.call(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) return;
        if (child.nodeType !== 1) { child.remove(); return; }
        if (!ALLOWED.has(child.tagName)) {
          const frag = document.createDocumentFragment();
          while (child.firstChild) frag.appendChild(child.firstChild);
          child.replaceWith(frag);
          return;
        }
        Array.prototype.slice.call(child.attributes).forEach((attr) => {
          const n = attr.name.toLowerCase();
          if (child.tagName === 'IMG' && n === 'src') {
            if (!/^(assets\/|https?:\/\/|data:image\/)/i.test(attr.value)) child.removeAttribute('src');
            return;
          }
          if (child.tagName === 'IMG' && (n === 'alt' || n === 'loading')) return;
          if ((child.tagName === 'TD' || child.tagName === 'TH') && (n === 'colspan' || n === 'rowspan')) return;
          child.removeAttribute(attr.name);
        });
        if (child.tagName === 'IMG' && !child.getAttribute('src')) { child.remove(); return; }
        walk(child);
      });
    };
    walk(tpl.content);
    return tpl.innerHTML;
  }

  /** 官方解析常见「一坨」文本，按选项/结论切段，提升可读性 */
  function formatExp(html) {
    if (!html) return '';
    const d = document.createElement('div');
    d.innerHTML = html;
    const walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.nodeValue || '';
      if (text.length < 24) return;
      if (node.parentNode && node.parentNode.closest && node.parentNode.closest('table')) return;
      const parts = [];
      text.split(/\n+/).forEach((line) => {
        line.split(/(?<=[。；])(?=\s*(?:[A-D]项|故正确答案|【文段出处】))/).forEach((seg) => {
          const t = seg.trim();
          if (t) parts.push(t);
        });
      });
      if (parts.length < 2) return;
      const frag = document.createDocumentFragment();
      parts.forEach((p) => {
        const span = document.createElement('span');
        span.className = 'exp-line';
        span.textContent = p;
        frag.appendChild(span);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return d.innerHTML;
  }

  /** 把材料/题干里的小公式图改为内联，避免独占一行 */
  function texify(root) {
    if (!root) return;
    Array.prototype.slice.call(root.querySelectorAll('img')).forEach((img) => {
      const apply = () => {
        if (img.naturalHeight && img.naturalHeight <= 48) img.classList.add('tex-img');
      };
      if (img.complete) apply();
      else img.addEventListener('load', apply, { once: true });
    });
  }

  /* ------------------ 存储 ------------------ */
  const KEY = 'shangan_tiku_v1';

  const defaultState = () => ({
    v: 1,
    createdAt: Date.now(),
    settings: {
      apiProvider: 'deepseek',
      apiBase: 'https://api.deepseek.com/v1',
      apiKey: '',
      apiModel: 'deepseek-chat',
      autoAnalyze: true,
      autoNext: false,
      dailyGoal: 30,
      showTimer: true,
      instantFeedback: true,
    },
    records: {},
    favs: [],
    notes: {},
    sessions: [],
    days: {},
    current: null,
  });

  const Store = {
    key: KEY,
    state: defaultState(),
    _timer: null,

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data && typeof data === 'object') {
            const base = defaultState();
            this.state = Object.assign(base, data, {
              settings: Object.assign(base.settings, data.settings || {}),
            });
          }
        }
      } catch (e) {
        console.warn('读取本地数据失败，将使用临时数据', e);
      }
      return this.state;
    },

    save(now) {
      clearTimeout(this._timer);
      const write = () => {
        try { localStorage.setItem(KEY, JSON.stringify(this.state)); }
        catch (e) { console.warn('保存失败', e); }
      };
      if (now) write(); else this._timer = setTimeout(write, 220);
    },

    today() {
      const k = dateKey();
      if (!this.state.days[k]) this.state.days[k] = { n: 0, c: 0, ms: 0 };
      return this.state.days[k];
    },

    record(qid, ok, picked, ms) {
      const recs = this.state.records;
      const r = recs[qid] || (recs[qid] = { a: 0, c: 0, w: 0, streak: 0 });
      r.a += 1;
      if (ok) { r.c += 1; r.streak = (r.streak || 0) + 1; } else { r.w += 1; r.streak = 0; }
      r.lastOk = !!ok;
      r.lastPick = picked || [];
      r.ts = Date.now();
      r.ms = ms || 0;
      if (r.w > 0 && r.streak >= 2) r.cleared = true;
      if (r.w > 0 && r.streak === 0) r.cleared = false;
      const d = this.today();
      d.n += 1;
      if (ok) d.c += 1;
      d.ms += ms || 0;
      this.save();
      return r;
    },

    isFav(qid) { return this.state.favs.indexOf(qid) >= 0; },
    toggleFav(qid) {
      const i = this.state.favs.indexOf(qid);
      if (i >= 0) this.state.favs.splice(i, 1); else this.state.favs.push(qid);
      this.save(true);
      return i < 0;
    },

    wrongIds() {
      return Object.keys(this.state.records).filter((id) => {
        const r = this.state.records[id];
        return r && r.w > 0 && !r.cleared;
      });
    },

    totals() {
      let n = 0, c = 0, ms = 0, seen = 0;
      Object.keys(this.state.records).forEach((id) => {
        const r = this.state.records[id];
        n += r.a; c += r.c; ms += r.ms || 0; seen += 1;
      });
      return { attempts: n, correct: c, ms, seen, rate: pct(c, n) };
    },

    streak() {
      const days = this.state.days;
      let k = dateKey();
      if (!days[k] || days[k].n === 0) k = addDays(k, -1);
      let n = 0;
      while (days[k] && days[k].n > 0) { n += 1; k = addDays(k, -1); }
      return n;
    },

    addSession(s) {
      this.state.sessions.unshift(s);
      if (this.state.sessions.length > 200) this.state.sessions.length = 200;
      this.save();
    },

    resetProgress() {
      this.state.records = {};
      this.state.sessions = [];
      this.state.days = {};
      this.state.favs = [];
      this.state.notes = {};
      this.state.current = null;
      this.save(true);
    },
  };

  /* ------------------ 提示 / 弹窗 ------------------ */
  function toast(msg, type) {
    let root = $('#toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      root.className = 'toast-root';
      document.body.appendChild(root);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = (type === 'ok' ? icon('check', 15) : type === 'no' ? icon('close', 15) : '') + '<span>' + esc(msg) + '</span>';
    root.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .2s, transform .2s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(() => el.remove(), 220);
    }, 2200);
  }

  function modal(opt) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal' + (opt.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><div><div class="modal-title">' + esc(opt.title || '') + '</div>' +
          (opt.sub ? '<div class="modal-sub">' + esc(opt.sub) + '</div>' : '') +
        '</div><button class="icon-btn" data-close aria-label="关闭">' + icon('close', 18) + '</button></div>' +
        '<div class="modal-body">' + (opt.body || '') + '</div>' +
        (opt.footer ? '<div class="modal-foot">' + opt.footer + '</div>' : '') +
      '</div>';
    document.body.appendChild(mask);
    const close = () => {
      mask.style.opacity = '0';
      setTimeout(() => mask.remove(), 160);
    };
    mask.addEventListener('click', (e) => {
      if (e.target === mask || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });
    if (opt.onMount) opt.onMount(mask, close);
    return { el: mask, close };
  }

  function confirmDialog(title, desc, okText, danger) {
    return new Promise((resolve) => {
      const m = modal({
        title: title,
        body: '<p style="font-size:13px;color:var(--ink-2);line-height:1.7">' + esc(desc) + '</p>',
        footer: '<button class="btn" data-close>取消</button><button class="btn ' +
          (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(okText || '确定') + '</button>',
        onMount(el, close) {
          el.querySelector('[data-ok]').addEventListener('click', () => { close(); resolve(true); });
          el.addEventListener('click', (e) => {
            if (e.target.closest('[data-close]')) resolve(false);
          });
        },
      });
      m.el.addEventListener('click', (e) => { if (e.target === m.el) resolve(false); });
    });
  }

  window.UI = {
    $, $$, esc, icon, clean, formatExp, texify, toast, modal, confirmDialog,
    dateKey, addDays, fmtDuration, fmtTime, pct, clamp, shuffle, plain, pad2,
  };
  window.Store = Store;
})();
