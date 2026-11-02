/* ==========================================================
   ai.js — 错因分析：在线大模型 + 本地规则引擎
   ========================================================== */
(function () {
  'use strict';

  const PROVIDERS = [
    { id: 'deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', note: '性价比高 · 可直连', keyUrl: 'https://platform.deepseek.com/api_keys' },
    { id: 'qwen', name: '通义千问', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', note: '阿里云 · 可直连', keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1' },
    { id: 'moonshot', name: 'Kimi', base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', note: '长文本 · 可直连', keyUrl: 'https://platform.moonshot.cn/console/api-keys' },
    { id: 'zhipu', name: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', note: '浏览器直连受限', keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
    { id: 'openai', name: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', note: '浏览器直连受限' },
    { id: 'custom', name: '自定义', base: '', model: '', note: '任意 OpenAI 兼容接口' },
  ];

  const CAT_METHOD = {
    '逻辑填空': ['先读整句，圈出空格前后的提示信息：解释说明、反义并列、搭配对象', '逐项辨析：语义侧重、搭配范围、感情色彩、程度轻重', '把词代回原句通读，检查是否与上下文一致'],
    '片段阅读': ['先看提问方式，确认是主旨、意图、细节还是标题', '回原文定位关键句：首尾句、转折词后、因果词后', '对比选项，排除偷换概念、扩大范围、无中生有'],
    '语句表达': ['先看首句特征，排除指代词、关联词后半开头的选项', '抓指代词、关联词、时间词，把必须相邻的句子捆绑', '代入排序通读，检查语意是否连贯'],
    '语句排序': ['先看首句特征，排除指代词、关联词后半开头的选项', '抓指代词、关联词、时间词，把必须相邻的句子捆绑', '代入排序通读，检查语意是否连贯'],
    '数学运算': ['判断题型：工程、行程、利润、排列组合、容斥、最值', '设未知数或直接代入选项，列出等量关系', '算完回代验证，注意单位、整数限制与边界条件'],
    '数字推理': ['观察相邻项差、比、和、积的变化', '尝试分组、递推、幂次数列', '用选项反推验证规律是否唯一'],
    '资料分析': ['先读题干，圈出时间、指标、问法（增长/比重/平均数）', '回材料定位数据，分清基期与现期、同比与环比', '列式后估算，截位直除，先看量级再看首位'],
    '图形推理': ['看图形组成：元素相同看位置/样式，元素不同看数量/属性', '依次排查对称、曲直、封闭、笔画、交点、面', '选出规律后验证选项是否唯一符合'],
    '定义判断': ['拆解题干定义的要件：主体、对象、方式、目的、结果', '逐项比对要件，缺一即排除', '注意“不属于”这类反向提问'],
    '类比推理': ['先判断题干词项的逻辑关系：种属、组成、功能、对应', '再看词性、顺序、感情色彩是否一致', '用造句法回代验证'],
    '逻辑判断': ['找出论点与论据，明确论证结构', '削弱/加强优先攻击论证过程：另有他因、切断联系', '排除无关项、诉诸权威、偷换概念'],
    '常识判断': ['定位考点所属学科（法律/科技/人文/地理/经济）', '回忆该考点的核心结论，排除绝对化表述', '不确定时用排除法，先去掉明显错误项'],
    '政治理论': ['对应到具体理论、会议或文件表述', '注意表述的准确性与时效性', '排除与官方表述不一致、张冠李戴的选项'],
  };

  const CAT_REMIND = {
    '逻辑填空': '先找语境提示，再辨析词义，别凭语感直接选。',
    '片段阅读': '先看问法再读文，主旨题别被细节项带跑。',
    '语句排序': '首句定方向，指代词定捆绑。',
    '数学运算': '先认题型再动笔，能代入就别硬解方程。',
    '资料分析': '先看时间和单位，基期现期别搞反。',
    '图形推理': '规律要能解释全部图形，不能只看前两个。',
    '定义判断': '要件逐条比对，缺一个就排除。',
    '类比推理': '先定关系，再看词性与顺序。',
    '逻辑判断': '先找论点，再想怎么打断论据到论点的桥。',
    '常识判断': '不确定就用排除法，绝对化表述多半错。',
    '政治理论': '记准原文表述，别被近义替换骗了。',
  };

  const CAT_KNOW = {
    '逻辑填空': ['词语辨析', '语境分析'],
    '片段阅读': ['主旨概括', '意图判断'],
    '语句排序': ['语句衔接', '话题一致'],
    '数学运算': ['等量关系', '代入排除'],
    '数字推理': ['数列规律'],
    '资料分析': ['增长率', '比重', '平均数'],
    '图形推理': ['数量规律', '位置规律'],
    '定义判断': ['要件分析'],
    '类比推理': ['逻辑关系'],
    '逻辑判断': ['论证结构'],
    '常识判断': ['知识记忆'],
    '政治理论': ['时政理论'],
  };

  const ABS_WORDS = ['一定', '必须', '都', '所有', '完全', '唯一', '只有', '必然', '全部', '不可能', '永远'];

  function catOf(q) {
    const c = q.category || '';
    if (CAT_METHOD[c]) return c;
    const keys = Object.keys(CAT_METHOD);
    for (let i = 0; i < keys.length; i++) if (c.indexOf(keys[i]) >= 0) return keys[i];
    if (q.module === 'zl') return '资料分析';
    if (q.module === 'sl') return '数学运算';
    if (q.module === 'pd') return '逻辑判断';
    if (q.module === 'yy') return '片段阅读';
    if (q.module === 'zzll') return '政治理论';
    return '常识判断';
  }

  function optionText(q, letter) {
    const o = (q.options || []).filter((x) => x.k === letter)[0];
    return o ? UI.plain(o.text) : '';
  }

  function officialComment(expText, letter) {
    const re = new RegExp('(?:^|[。；;\\s])' + letter + '\\s*[项、]\\s*[^。；;]{4,140}[。；;]');
    const m = expText.match(re);
    if (!m) return '';
    return m[0].replace(/^[。；;\s]+/, '').replace(/[。；;]$/, '').trim();
  }

  function localAnalyze(q, picked, ms) {
    const cat = catOf(q);
    const correct = (q.answer || []).slice().sort();
    const mine = (picked || []).slice().sort();
    const isRight = correct.join('') === mine.join('');
    const expText = UI.plain(q.explanation || '');
    const mineLetters = mine.length ? mine : [];
    const correctLetters = correct;
    const pickComments = mineLetters.map((l) => officialComment(expText, l)).filter(Boolean);
    const pickAbbr = mineLetters.length ? mineLetters.join('、') : '未作答';
    const correctAbbr = correctLetters.join('、');

    let errorType = '知识点盲区';
    let diagnosis = '';
    let trap = '';

    if (!mineLetters.length) {
      errorType = '未作答 / 放弃';
      diagnosis = '这道题没有留下作答记录，等于直接放掉了得分机会。行测是取舍考试，但基础题型不建议空题。';
      trap = '不会做时先排除 1—2 个明显错误项，再在剩余选项里做选择，蒙对的概率会明显提高。';
    } else if (isRight) {
      errorType = '答对 · 复盘';
      diagnosis = '答案正确。下面按“命题人视角”拆一下这道题的考点和更容易踩的坑，避免下次靠蒙。';
      trap = pickComments.join('；') || '正确项的表述与题干呼应最紧密，其余选项往往在范围、程度或主体上有偏差。';
    } else if (ms > 0 && ms < 7000) {
      errorType = '时间不足 / 抢答';
      diagnosis = '本题只用了 ' + Math.max(1, Math.round(ms / 1000)) + ' 秒。' +
        (cat === '数学运算' || cat === '资料分析'
          ? '计算型题目读题和列式都不止这个时间，很可能是没读完题就选了。'
          : '言语和判断类题目需要回文定位，过快作答容易只看表面语义。');
      trap = pickComments.join('；') || '你选的「' + (optionText(q, mineLetters[0]) || '').slice(0, 40) + '」在字面上与题干有呼应，但偏离了设问要求。';
    } else {
      if (cat === '逻辑填空') errorType = '近义词辨析失误';
      else if (cat === '片段阅读' || cat === '语句表达' || cat === '语句排序') errorType = '语境 / 文意理解偏差';
      else if (cat === '数学运算' || cat === '数字推理') errorType = '等量关系或计算失误';
      else if (cat === '资料分析') errorType = '概念或列式错误';
      else if (cat === '图形推理') errorType = '规律识别偏差';
      else if (cat === '定义判断') errorType = '定义要件比对不全';
      else if (cat === '类比推理') errorType = '逻辑关系判断错误';
      else if (cat === '逻辑判断') errorType = '论证方向误判';
      else if (cat === '政治理论') errorType = '理论表述记忆偏差';
      else if (cat === '常识判断') errorType = '知识点盲区';

      const myText = optionText(q, mineLetters[0]) || '';
      const absHit = ABS_WORDS.filter((w) => myText.indexOf(w) >= 0);
      if (absHit.length && cat !== '数学运算') {
        errorType = '选项陷阱（绝对化表述）';
        diagnosis = '你选了「' + myText.slice(0, 46) + '」，其中“' + absHit[0] + '”属于绝对化表述。' +
          '行测选项里出现这类词，除非题干有明确限定，否则大概率是命题人设的干扰项。';
        trap = '绝对化表述（一定、都、所有、唯一、完全）在言语、判断、常识中通常是错误项的标志。';
      } else if (pickComments.length) {
        diagnosis = '你选了 ' + pickAbbr + '，正确答案是 ' + correctAbbr + '。官方解析对这个选项的判断是：' +
          pickComments.join('；') + '。这说明你的判断停在“读起来像”，没有回到题干的关键限定上。';
        trap = pickComments.join('；');
      } else {
        const expHead = expText.replace(/\s+/g, ' ').slice(0, 130);
        diagnosis = '你选了 ' + pickAbbr + '，正确答案是 ' + correctAbbr + '。这道题的关键在于把题干信息落到具体考点上，而不是凭整体印象比较选项。' +
          (expHead ? '解析的切入点是：' + expHead + '……' : '');
        trap = '干扰项通常只对了一半：主体对但范围错，或者方向对但程度过。逐项核对限定词。';
      }
    }

    const knowledge = (CAT_KNOW[cat] || []).slice();
    if (q.category && knowledge.indexOf(q.category) < 0) knowledge.unshift(q.category);
    const method = (CAT_METHOD[cat] || CAT_METHOD['常识判断']).slice();

    return {
      errorType: errorType,
      diagnosis: diagnosis,
      trap: trap,
      knowledge: knowledge.slice(0, 4),
      method: method,
      reminder: CAT_REMIND[cat] || '慢一点读题，快一点排除。',
      source: 'local',
    };
  }

  /* ---------------- 在线调用 ---------------- */

  function cfg() {
    const s = Store.state.settings;
    return { base: (s.apiBase || '').trim(), key: (s.apiKey || '').trim(), model: (s.apiModel || '').trim() };
  }

  function hasKey() {
    const c = cfg();
    return !!(c.base && c.key && c.model);
  }

  async function chat(messages, opt) {
    opt = opt || {};
    const c = cfg();
    if (!hasKey()) throw new Error('NO_KEY');
    let base = c.base.replace(/\/+$/, '');
    const url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
    const body = {
      model: c.model,
      messages: messages,
      temperature: opt.temperature == null ? 0.3 : opt.temperature,
      max_tokens: opt.maxTokens || 900,
      stream: false,
    };
    if (opt.json) body.response_format = { type: 'json_object' };

    const run = async (payload) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opt.timeout || 45000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.key },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const err = new Error('HTTP_' + res.status);
          err.status = res.status;
          err.detail = text.slice(0, 300);
          throw err;
        }
        const data = await res.json();
        const content = data && data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content : '';
        if (!content) throw new Error('EMPTY');
        return content;
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      return await run(body);
    } catch (e) {
      if (body.response_format && e.status === 400) {
        delete body.response_format;
        return await run(body);
      }
      throw e;
    }
  }

  function parseJson(text) {
    if (!text) return null;
    let t = String(text).trim();
    t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    try { return JSON.parse(t); } catch (e) { return null; }
  }

  function promptFor(q, picked, ms) {
    const opts = (q.options || []).map((o) => o.k + '. ' + UI.plain(o.text)).join('\n');
    const correct = (q.answer || []).join('');
    const mine = (picked || []).join('') || '未作答';
    const exp = UI.plain(q.explanation || '').slice(0, 1500);
    return [
      '你是一位有十年经验的行测辅导老师，擅长诊断学生的思维错误，而不是复述解析。',
      '学生刚做完一道「' + (q.category || '行测') + '」题，请判断他为什么会错（如果答对了，就复盘易错点和更快的解法）。',
      '要求：必须结合本题的具体内容（关键词、数据、选项表述），不要说“加强练习”“注意审题”这类空话；',
      '如果涉及计算，请指出是哪一步算错或列错式；如果选错，请说明他被哪个词或哪层逻辑带偏。',
      '',
      '【题干】' + UI.plain(q.stem || '').slice(0, 1200),
      '【选项】\n' + opts,
      '【正确答案】' + correct,
      '【学生选择】' + mine + (ms ? '（用时 ' + Math.round(ms / 1000) + ' 秒）' : ''),
      '【官方解析】' + exp,
      '',
      '只输出一个 JSON 对象，不要任何多余文字，字段如下：',
      '{"errorType":"从[审题偏差,知识点盲区,近义词辨析失误,语境理解偏差,概念混淆,计算失误,选项陷阱,时间不足/蒙猜,论证方向误判,规律识别偏差]中选最贴切的一个",',
      ' "diagnosis":"2-3句话，具体指出学生的思维在哪一步走偏，必须结合本题内容，不要空话",',
      ' "trap":"错误选项的迷惑点，以及为什么容易被吸引",',
      ' "knowledge":["考点1","考点2"],',
      ' "method":["下次遇到同类题的第1步","第2步","第3步"],',
      ' "reminder":"一句不超过30字的提醒"}',
    ].join('\n');
  }

  async function analyze(q, picked, ms) {
    const fallback = localAnalyze(q, picked, ms);
    if (!hasKey()) return Promise.resolve(fallback);
    try {
      const text = await chat([
        { role: 'system', content: '你是严谨、具体的公考行测老师，只输出合法 JSON。' },
        { role: 'user', content: promptFor(q, picked, ms) },
      ], { json: true, maxTokens: 800 });
      const data = parseJson(text);
      if (!data || !data.diagnosis) {
        return Object.assign(fallback, { source: 'local', raw: text });
      }
      return {
        errorType: data.errorType || fallback.errorType,
        diagnosis: data.diagnosis,
        trap: data.trap || fallback.trap,
        knowledge: Array.isArray(data.knowledge) ? data.knowledge.slice(0, 5) : fallback.knowledge,
        method: Array.isArray(data.method) ? data.method.slice(0, 4) : fallback.method,
        reminder: data.reminder || fallback.reminder,
        source: 'ai',
      };
    } catch (e) {
      const msg = errorText(e);
      return Object.assign(fallback, { source: 'local', error: msg });
    }
  }

  function errorText(e) {
    if (!e) return '未知错误';
    if (e.name === 'AbortError') return '请求超时，请检查网络或换一个模型';
    if (e.message === 'NO_KEY') return '尚未配置 API';
    if (e.message === 'EMPTY') return '接口返回为空';
    if (e.status === 401 || e.status === 403) return 'API Key 无效或没有权限（' + e.status + '）';
    if (e.status === 404) return '接口地址不对，请检查 Base URL（404）';
    if (e.status === 429) return '请求太频繁或额度用尽（429）';
    if (e.status >= 500) return '模型服务暂时不可用（' + e.status + '）';
    if (e instanceof TypeError) return '浏览器跨域被拦截，建议使用已部署版本或本地代理';
    return e.message || '调用失败';
  }

  async function testConnection() {
    const t0 = Date.now();
    const text = await chat([
      { role: 'system', content: '你是一个测试助手，只回复两个字。' },
      { role: 'user', content: '回复：可用' },
    ], { maxTokens: 20, temperature: 0, timeout: 25000 });
    return { ms: Date.now() - t0, text: text.slice(0, 40) };
  }

  /* ---------------- 整卷诊断 ---------------- */
  function localReport(summary) {
    const groups = {};
    (summary.wrong || []).forEach((w) => {
      const k = w.category || '未分类';
      if (!groups[k]) groups[k] = { topic: k, count: 0, advice: (CAT_METHOD[catOf({ category: k })] || [])[0] || '回归基础方法' };
      groups[k].count += 1;
    });
    const problems = Object.keys(groups).map((k) => groups[k]).sort((a, b) => b.count - a.count).slice(0, 4);
    const rate = UI.pct(summary.correct, summary.total);
    let summaryText = '本套共 ' + summary.total + ' 题，答对 ' + summary.correct + ' 题，正确率 ' + rate + '%。';
    if (rate >= 80) summaryText += '整体掌握不错，接下来重点压缩时间，把会做的题做快。';
    else if (rate >= 60) summaryText += '基础题能拿下，但中档题失分明显，建议针对错题考点做专项。';
    else summaryText += '目前主要问题是题型方法不熟，先别追求速度，按题型把方法练顺。';
    return {
      summary: summaryText,
      problems: problems,
      plan: [
        '把本次错题的考点整理成 3—5 个关键词，逐个回看方法',
        '用「错题重做」再刷一遍，连续答对两次才算过关',
        '限时做一组同模块专项，控制在每题 50 秒以内',
      ],
      encouragement: '错题不是失败，是命题人免费给你划的重点。',
      source: 'local',
    };
  }

  async function report(summary) {
    const fallback = localReport(summary);
    if (!hasKey()) return fallback;
    const list = (summary.wrong || []).slice(0, 14).map((w) =>
      '- [' + (w.category || '') + '] ' + UI.plain(w.stem || '').slice(0, 60) + '（选 ' + (w.picked || []).join('') + '，正确 ' + (w.answer || []).join('') + '）'
    ).join('\n');
    try {
      const text = await chat([
        { role: 'system', content: '你是公考行测教研老师，输出简洁、可执行的中文 JSON。' },
        { role: 'user', content: [
          '学生刚做完一套行测模拟卷：共 ' + summary.total + ' 题，答对 ' + summary.correct + ' 题，用时 ' + summary.minutes + ' 分钟。',
          '各模块正确率：' + (summary.modules || []).map((m) => m.label + ' ' + m.rate + '%').join('，'),
          '错题清单：',
          list || '（无）',
          '',
          '请输出 JSON：{"summary":"2-3句话评价本次表现","problems":[{"topic":"考点","count":2,"advice":"针对该考点的具体建议"}],"plan":["下一步1","下一步2","下一步3"],"encouragement":"一句鼓励"}',
        ].join('\n') },
      ], { json: true, maxTokens: 800 });
      const data = parseJson(text);
      if (!data || !data.summary) return fallback;
      return {
        summary: data.summary,
        problems: Array.isArray(data.problems) ? data.problems.slice(0, 5) : fallback.problems,
        plan: Array.isArray(data.plan) ? data.plan.slice(0, 4) : fallback.plan,
        encouragement: data.encouragement || fallback.encouragement,
        source: 'ai',
      };
    } catch (e) {
      return Object.assign(fallback, { error: errorText(e) });
    }
  }

  window.AI = {
    PROVIDERS: PROVIDERS,
    hasKey: hasKey,
    cfg: cfg,
    chat: chat,
    analyze: analyze,
    localAnalyze: localAnalyze,
    report: report,
    localReport: localReport,
    testConnection: testConnection,
    errorText: errorText,
    catOf: catOf,
  };
})();
