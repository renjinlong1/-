# 上岸 · 行测刷题

一个纯前端的国考 / 省考行测刷题工具。内置 **564 道**近年真题（国考 + 多省省考），分类刷题、即时对答案、AI 分析错因、错题本与学习报告，数据全部留在本地浏览器。

## 快速开始

**方式一：直接打开**

双击 `index.html` 即可。所有题库、图片都在本地，断网也能刷题。

**方式二：本地服务器（推荐，兼容性最好）**

```bash
python -m http.server 8765
# 打开 http://127.0.0.1:8765
```

Windows 下也可以双击 `start.bat`，会自动起服务并打开浏览器。

## 已实现的功能

| 模块 | 说明 |
| --- | --- |
| 分类刷题 | 政治理论 / 常识判断 / 言语理解 / 数量关系 / 判断推理 / 资料分析，可按子题型筛选 |
| 练习模式 | 顺序、随机、优先未做、只做错题；10/20/30/全部 题量可选 |
| 即时解析 | 作答后立刻显示正确答案、你的答案、官方解析、用时 |
| AI 错因分析 | 结合题干、选项、你选的答案和官方解析，指出具体思维断点，而不是复述解析 |
| 本地诊断引擎 | 没有配置 API 也能用：按题型、选项特征、官方解析定位错因 |
| 模拟考试 | 按真实行测比例组卷，限时、答题卡、交卷统一判分、整卷诊断 |
| 错题本 | 自动收录，连续答对两次自动移出；支持重做、搜索、按模块筛选、导出 CSV |
| 收藏与笔记 | 收藏重点题，给题目写自己的易错点 |
| 学习报告 | 累计题量、正确率、连续打卡、14 天趋势、模块正确率、薄弱考点 |
| 题库管理 | 导入自己的 JSON / Markdown 题库，导出备份、恢复数据 |

## 关于 AI 错因分析

进入「设置 → AI 错因分析」，选择一个服务商，填入 API Key 即可。支持任意 OpenAI 兼容接口：

| 服务商 | Base URL | 常用模型 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |

Key 只保存在本机 `localStorage`，不会上传到任何服务器。

> DeepSeek、通义千问、Kimi 已验证支持浏览器直连；智谱与 OpenAI 可能被浏览器跨域策略拦截。没有 Key 时会自动使用内置的本地诊断引擎，功能不受影响。

## 题库

内置题目来自 GitHub 开源项目 [ERRRC/xingcezhenti](https://github.com/ERRRC/xingcezhenti)（2016—2026 国考 + 省考行测真题，含官方解析）。当前版本共 557 题：政治理论 72、常识判断 91、言语理解 153、数量关系 65、判断推理 123、资料分析 60，按 2022—2026 年、国考与不同省份交替抽样。抓取脚本只保留配图可本地化、能完整作答的题目，图片全部下载到 `assets/img/`，离线可用。

| 模块 | 题量 | 模块 | 题量 |
| --- | --- | --- | --- |
| 政治理论 | 72 | 判断推理 | 123 |
| 常识判断 | 91 | 资料分析 | 60 |
| 言语理解与表达 | 153 | 数量关系 | 65 |

重新抓取 / 扩充题库：

```bash
python tools/fetch_bank.py          # 重新生成 assets/data/*.js
python tools/fetch_bank.py --stat   # 只看各模块能抓到多少题
```

脚本会按年份从新到旧扫描，优先国考卷；想调整各模块题量，改 `MODULES` 里的 quota 即可。

### 导入自己的题库

在「题库管理」页可以粘贴 JSON 或上传文件。JSON 格式：

```json
[
  {
    "module": "yy",
    "category": "逻辑填空",
    "stem": "题干，支持 <b>HTML</b> 与 <img src=\"assets/img/xxx.png\">",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "answer": ["C"],
    "explanation": "解析内容",
    "source": "2026 国考"
  }
]
```

- `module`：`zzll` 政治理论 / `cs` 常识判断 / `yy` 言语理解 / `sl` 数量关系 / `pd` 判断推理 / `zl` 资料分析
- `answer`：字母数组，多选题填多个，如 `["A","C"]`
- 也支持简化 Markdown：`## 第 1 题 · 逻辑填空` + 选项 + `答案：C` + `解析：…`

## 数据与隐私

- 做题记录、错题、收藏、笔记、API Key 全部存在浏览器 `localStorage`（键名 `shangan_tiku_v1`）。
- 换浏览器 / 清缓存会丢失，建议在「题库管理 → 完整备份」定期导出 JSON。
- 不上传任何数据，没有账号体系。

## 部署到线上（可选）

```bash
python tools/build_dist.py     # 生成 dist/ 纯净副本（约 8 MB）
```

`dist/` 只包含运行必需的文件，可直接上传到 GitHub Pages、Vercel、Netlify、对象存储等任意静态托管。因为是纯静态站点，不需要 Node 服务或数据库。

## 目录结构

```
index.html              页面入口
assets/css/app.css      样式
assets/js/core.js       工具、图标、本地存储
assets/js/bank.js       题库索引与组卷
assets/js/ai.js         在线模型调用 + 本地错因引擎
assets/js/views.js      首页 / 设置 / 错题本 / 统计等页面
assets/js/practice.js   答题器、模拟考试、成绩报告
assets/js/app.js        路由与初始化
assets/data/*.js        题库数据（脚本生成）
assets/img/             题目配图（脚本下载）
tools/fetch_bank.py     题库抓取与转换脚本
```

## 免责声明

题库版权归原命题机构所有，本项目仅作个人学习使用，请勿用于商业分发。AI 分析结果由模型生成，仅供参考，请以官方解析为准。
