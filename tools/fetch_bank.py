# -*- coding: utf-8 -*-
"""
从开源仓库 ERRRC/xingcezhenti（2016-2026 国考/省考行测真题）抓取并解析题库，
生成本项目可直接使用的 JS 数据文件和本地图片资源。

用法：
    python tools/fetch_bank.py             # 抓取并生成 assets/data/*.js 与 assets/img/*
    python tools/fetch_bank.py --stat      # 只统计各模块可用题量，不写文件
    python tools/fetch_bank.py --papers 6  # 每个模块最多扫描 6 套卷（调试用）

设计：
1. 保留完整题型（含图形推理、图表资料分析），题目配图下载到本地 assets/img。
2. 每模块按年份从新到旧取样，优先国考卷。
3. HTML 白名单清洗，只保留段落/表格/图片等安全标签。
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from html import unescape

API = "https://api.github.com/repos/ERRRC/xingcezhenti/contents/{path}?ref=main"
CDN = "https://cdn.jsdelivr.net/gh/ERRRC/xingcezhenti@main/{path}"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(os.path.dirname(__file__), ".cache")
IMGDIR = os.path.join(ROOT, "assets", "img")

MODULES = [
    ("zzll", "政治理论", "01-政治理论", 60),
    ("cs", "常识判断", "02-常识判断", 80),
    ("yy", "言语理解与表达", "03-言语理解与表达", 120),
    ("sl", "数量关系", "04-数量关系", 60),
    ("pd", "判断推理", "05-判断推理", 100),
    ("zl", "资料分析", "06-资料分析", 55),
]

ALLOWED_TAGS = {"p", "br", "b", "strong", "i", "em", "sub", "sup", "table", "thead", "tbody",
                "tr", "td", "th", "ul", "ol", "li", "span", "img"}

_img_cache = {}
_img_fail = set()


def arg(name, default):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return int(sys.argv[i + 1])
    return default


def fetch(url, retries=2, timeout=25):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa
            last = e
            time.sleep(0.8 * (i + 1))
    raise last


def list_dir(folder):
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.join(CACHE, re.sub(r"[^\w]", "_", folder) + ".json")
    if os.path.exists(key) and time.time() - os.path.getmtime(key) < 86400:
        with open(key, encoding="utf-8") as f:
            return json.load(f)
    data = json.loads(fetch(API.format(path=urllib.parse.quote(folder))).decode("utf-8"))
    with open(key, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return data


def get_file(folder, name):
    folder_key = folder.split("-")[0] if "-" in folder else folder
    cache = os.path.join(CACHE, "md", "%s_%s.md" % (folder_key, re.sub(r"[^\w]", "_", name)[:100]))
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            return f.read()
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    text = fetch(CDN.format(path=urllib.parse.quote(folder + "/" + name))).decode("utf-8", "replace")
    with open(cache, "w", encoding="utf-8") as f:
        f.write(text)
    time.sleep(0.05)
    return text


def local_image(src):
    """把 ../90-图片/xxx.png 下载到 assets/img，返回相对路径。"""
    if src in _img_cache:
        return _img_cache[src]
    if src in _img_fail:
        raise ValueError("image unavailable: " + src)
    clean = src.split("?")[0].replace("../", "").lstrip("/")
    ext = os.path.splitext(clean)[1].lower() or ".png"
    name = hashlib.md5(clean.encode("utf-8")).hexdigest()[:14] + ext
    path = os.path.join(IMGDIR, name)
    os.makedirs(IMGDIR, exist_ok=True)
    if not os.path.exists(path):
        data = fetch(CDN.format(path=urllib.parse.quote(clean)), retries=2, timeout=20)
        if len(data) < 200:
            raise ValueError("empty image " + clean)
        with open(path, "wb") as f:
            f.write(data)
    rel = "assets/img/" + name
    _img_cache[src] = rel
    return rel


def prefetch(htmls):
    """并发预取一段 HTML 中引用的图片。"""
    srcs = set()
    for h in htmls:
        srcs.update(re.findall(r'<img[^>]*src="([^"]+)"', h or ""))
    todo = []
    for s in srcs:
        if s in _img_cache or s in _img_fail:
            continue
        clean = s.split("?")[0].replace("../", "").lstrip("/")
        ext = os.path.splitext(clean)[1].lower() or ".png"
        path = os.path.join(IMGDIR, hashlib.md5(clean.encode("utf-8")).hexdigest()[:14] + ext)
        if not os.path.exists(path):
            todo.append(s)
    if not todo:
        return

    def one(src):
        try:
            local_image(src)
        except Exception:
            _img_fail.add(src)

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(one, todo))


def strip_tags(html):
    html = re.sub(r"<img[^>]*>", "", html)
    html = re.sub(r"<[^>]+>", "", html)
    return unescape(html).strip()


def localize_and_sanitize(html, allow_images=True):
    if not html:
        return ""
    html = re.sub(r"<script[\s\S]*?</script>", "", html, flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", "", html, flags=re.I)

    def img_repl(m):
        mm = re.search(r'src="([^"]+)"', m.group(0))
        if not mm or not allow_images:
            return ""
        try:
            return '<img src="%s" loading="lazy" alt="">' % local_image(mm.group(1))
        except Exception:
            return "@@IMGFAIL@@"

    html = re.sub(r"<img[^>]*>", img_repl, html, flags=re.I)

    def repl(m):
        closing, tag, attrs = m.group(1), m.group(2).lower(), m.group(3)
        if tag not in ALLOWED_TAGS:
            return ""
        if closing:
            return "</%s>" % tag if tag != "img" else ""
        if tag == "img":
            src = re.search(r'src="([^"]+)"', attrs or "")
            if not src:
                return ""
            return '<img src="%s" loading="lazy" alt="">' % src.group(1)
        if tag in ("td", "th"):
            keep = []
            for a in ("colspan", "rowspan"):
                mm = re.search(a + r'=["\']?(\d+)', attrs or "")
                if mm:
                    keep.append('%s="%s"' % (a, mm.group(1)))
            return "<%s%s>" % (tag, (" " + " ".join(keep)) if keep else "")
        return "<%s>" % tag

    html = re.sub(r"<(/?)([a-zA-Z0-9]+)([^>]*)>", repl, html)
    html = re.sub(r"\n{3,}", "\n\n", html)
    return html.strip()


def html_to_text(html):
    html = re.sub(r"<img[^>]*>", "", html)
    html = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    html = re.sub(r"</(p|div|tr|li|h\d)>", "\n", html, flags=re.I)
    html = re.sub(r"</t[dh]>", " ", html, flags=re.I)
    txt = strip_tags(html)
    txt = txt.replace("\u00a0", " ")
    txt = re.sub(r"[ \t]+", " ", txt)
    txt = re.sub(r"\n\s*\n+", "\n", txt)
    return txt.strip()


def bigrams(text):
    t = re.sub(r"<[^>]+>", "", text or "")
    t = re.sub(r"[\s\W_]+", "", t)
    return set(t[i:i + 2] for i in range(len(t) - 1))


def material_overlap(q, material):
    """题目（题干+选项）与共用材料的内容重合度，用于判断这道题是否真的依赖该材料。"""
    mat = bigrams(material)
    if not mat:
        return 0.0, 0.0
    stem_opts = q["stem"] + " " + " ".join(v for _, v in q["options"])
    so = bigrams(stem_opts)
    ex = bigrams(stem_opts + " " + q["explanation"])
    return (len(so & mat) / max(1, len(so)), len(ex & mat) / max(1, len(ex)))


Q_HEAD = re.compile(r"^#{2,3}\s*第\s*(\d+)\s*题[\s　]*<?sub>?\s*qid\s*(\d+)\s*·\s*([^<>\n]+)")
MAT_HEAD = re.compile(r"^#{2,3}\s*材料\s*(\d+)")


def parse_paper(text):
    lines = text.splitlines()
    fm, body = {}, lines
    if lines and lines[0].strip() == "---":
        i = 1
        while i < len(lines) and lines[i].strip() != "---":
            m = re.match(r'^([^:：]+)[:：]\s*"?([^"]*)"?$', lines[i].strip())
            if m:
                fm[m.group(1).strip()] = m.group(2).strip()
            i += 1
        body = lines[i + 1:]

    questions, materials = [], {}
    cur_mat, mat_buf, cur, mode = None, [], None, None

    def flush_mat():
        nonlocal mat_buf
        if cur_mat is not None:
            text = "\n".join(mat_buf).strip()
            if text:
                materials[cur_mat] = text
        mat_buf = []

    def flush_q():
        nonlocal cur
        if cur:
            cur["explanation"] = "\n".join(cur.pop("exp_lines")).strip()
            questions.append(cur)
        cur = None

    for line in body:
        s = line.strip()
        mq, mm = Q_HEAD.match(s), MAT_HEAD.match(s)
        if mq:
            flush_q()
            flush_mat()
            cur = {"no": mq.group(1), "qid": mq.group(2), "category": mq.group(3).strip(),
                   "stem_lines": [], "options": [], "answer_raw": "", "exp_lines": [],
                   "material_id": cur_mat}
            mode = "stem"
            continue
        if mm:
            flush_q()
            flush_mat()
            cur_mat, mat_buf, mode = mm.group(1), [], "material"
            continue
        if s == "---":
            flush_q()
            flush_mat()
            mode = None
            continue
        if cur is None:
            if cur_mat is not None:
                mat_buf.append(line)
            continue

        if mode in ("stem", "options"):
            mo = re.match(r"^-\s*\*\*([A-H])\*\*[\.．、]\s*(.*)$", s)
            if mo:
                cur["options"].append([mo.group(1), mo.group(2)])
                mode = "options"
            elif re.match(r"^\*\*答案\*\*", s):
                cur["answer_raw"] = re.sub(r"^\*\*答案\*\*[:：]?\s*", "", s)
                mode = "answer"
            elif mode == "options" and s.startswith("- ") and len(cur["options"]) < 5:
                cur["options"].append([chr(65 + len(cur["options"])), s[2:]])
            elif mode == "stem" and s:
                cur["stem_lines"].append(line)
            elif s and cur["options"]:
                cur["options"][-1][1] += "\n" + line
        elif mode == "answer":
            if "解析" in s:
                mode = "explanation"
            elif s and not cur["exp_lines"]:
                cur["answer_raw"] += " " + s
        elif mode == "explanation":
            cur["exp_lines"].append(line)

    flush_q()
    flush_mat()

    out = []
    for q in questions:
        out.append({
            "qid": q["qid"], "no": q["no"], "category": q["category"],
            "stem": "\n".join(q["stem_lines"]),
            "options": [(k, re.sub(r"\s*✅\s*$", "", v)) for k, v in q["options"]],
            "answer_raw": html_to_text(q["answer_raw"]),
            "explanation": q["explanation"],
            "material_id": q["material_id"],
            "paper": fm.get("试卷", ""), "region": fm.get("地区", ""),
            "year": fm.get("年份", ""), "module": fm.get("模块", ""),
        })
    return out, materials


def write_module(key, label, data):
    outdir = os.path.join(ROOT, "assets", "data")
    os.makedirs(outdir, exist_ok=True)
    path = os.path.join(outdir, key + ".js")
    payload = {"module": key, "label": label, "questions": data["questions"],
               "materials": data["materials"]}
    with open(path, "w", encoding="utf-8") as f:
        f.write("/* %s · %d 题 · 数据来源：github.com/ERRRC/xingcezhenti（仅供个人学习） */\n"
                % (label, len(data["questions"])))
        f.write("window.__BANK_PUSH && window.__BANK_PUSH(%s);\n"
                % json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    print("  → 写入 %s（%d 题）" % (os.path.basename(path), len(data["questions"])))


def prune_images():
    """删除没有被任何数据文件引用的图片，避免仓库里堆无用素材。"""
    used = set()
    outdir = os.path.join(ROOT, "assets", "data")
    for name in os.listdir(outdir):
        if not name.endswith(".js"):
            continue
        with open(os.path.join(outdir, name), encoding="utf-8") as f:
            used.update(re.findall(r"assets/img/([A-Za-z0-9._-]+)", f.read()))
    removed = 0
    for name in os.listdir(IMGDIR):
        if name not in used:
            os.remove(os.path.join(IMGDIR, name))
            removed += 1
    print("清理未引用图片 %d 张，保留 %d 张" % (removed, len(used)))


def main():
    stat_only = "--stat" in sys.argv
    papers_limit = arg("--papers", 30)
    all_out = {}

    for key, label, folder, quota in MODULES:
        print("\n=== %s ===" % label)
        try:
            files = list_dir(folder)
        except Exception as e:
            print("  目录获取失败：", e)
            continue
        files = [f for f in files if f["name"].endswith(".md") and f["name"] != "README.md"]

        def sort_key(f):
            y = re.search(r"(20\d{2})", f["name"])
            y = int(y.group(1)) if y else 0
            return (-y, -1 if "国家公务员" in f["name"] else 0, f["name"])

        files.sort(key=sort_key)

        # 跨年份 + 国考/省考交替抽样，避免只覆盖某一年的国考卷
        buckets = {}
        for f in files:
            y = (re.search(r"(20\d{2})", f["name"]) or [None, "0"])[1]
            if y == "0":
                continue
            b = buckets.setdefault(y, {"gk": [], "prov": []})
            b["gk" if "国家公务员" in f["name"] else "prov"].append(f)
        years = sorted(buckets.keys(), reverse=True)[:5]
        # 每年从不同省份起头，避免省考卷全落在同一个城市
        for yi, y in enumerate(years):
            prov = buckets[y]["prov"]
            if prov:
                k = (yi * 3) % len(prov)
                buckets[y]["prov"] = prov[k:] + prov[:k]
        interleaved = []
        for i in range(4):
            for y in years:
                b = buckets[y]
                if i < len(b["gk"]):
                    interleaved.append(b["gk"][i])
                if i < len(b["prov"]):
                    interleaved.append(b["prov"][i])
        files = interleaved or files

        collected, seen, mats_out = [], set(), {}
        for f in files[:papers_limit]:
            paper_tag = hashlib.md5(f["name"].encode("utf-8")).hexdigest()[:6]
            if len(collected) >= quota:
                break
            try:
                qs, mats = parse_paper(get_file(folder, f["name"]))
            except Exception as e:
                print("  跳过 %-40s %s" % (f["name"][:40], type(e).__name__))
                continue
            htmls = list(mats.values())
            for q in qs:
                htmls.append(q["stem"])
                htmls.append(q["explanation"])
                htmls.extend(v for _, v in q["options"])
            prefetch(htmls)
            usable = 0
            for q in qs:
                if not (2 <= len(q["options"]) <= 5):
                    continue
                if len(html_to_text(q["stem"])) < 8:
                    continue
                letters = re.findall(r"[A-H]", q["answer_raw"].upper())
                if not letters:
                    continue
                sig = re.sub(r"\s+", "", html_to_text(q["stem"]))[:40]
                if sig in seen:
                    continue
                if label == "资料分析":
                    if not q["material_id"] or not mats.get(q["material_id"]):
                        continue
                elif q["material_id"]:
                    # 其他模块：只有真正依赖共用材料的题才挂材料
                    # 1) 题干里明确引用“文中/上述/以上信息”；2) 题干与材料的内容重合度足够高
                    stem_text = html_to_text(q["stem"])
                    short = len(stem_text) < 130
                    # 只认强引用，避免“上述文段/这段文字”这类自带材料的题干被误判
                    refers = short and re.search(
                        r"文中|文章中|该材料|根据材料|上述材料|以上材料|材料中|填入文中|表中|图中", stem_text)
                    so, ex = material_overlap(q, mats.get(q["material_id"], ""))
                    # 解析里出现“文章第X段/全文/上述材料”也说明这道题依赖共用材料
                    exp_text = html_to_text(q["explanation"])
                    ref_exp = len(stem_text) < 40 and q["category"] != "逻辑填空" and re.search(
                        r"文章|文中|全文|第[一二三四五六七八九十0-9]+段|这段文字|上述材料|以上信息", exp_text)
                    depends = (bool(refers) or bool(ref_exp) or (short and so >= 0.12)
                               or (len(stem_text) < 70 and ex >= 0.25))
                    if not depends:
                        q["material_id"] = None
                try:
                    stem = localize_and_sanitize(q["stem"])
                    opts = [{"k": k, "text": localize_and_sanitize(v)} for k, v in q["options"]]
                    exp = localize_and_sanitize(q["explanation"])
                    mat_html = ""
                    if q["material_id"]:
                        mat_html = localize_and_sanitize(mats.get(q["material_id"], ""))
                except Exception as e:
                    continue
                if "@@IMGFAIL@@" in (stem + exp + mat_html + "".join(o["text"] for o in opts)):
                    continue
                if not html_to_text(stem):
                    continue
                seen.add(sig)
                entry = {
                    "id": "%s-%s" % (key, q["qid"]),
                    "module": key,
                    "category": q["category"],
                    "stem": stem,
                    "options": opts,
                    "answer": sorted(set(letters[:5])),
                    "explanation": exp,
                    "paper": q["paper"], "year": q["year"], "region": q["region"],
                    "source": ("%s %s" % (q["region"], q["year"])).strip(),
                }
                if q["material_id"]:
                    entry["materialId"] = "%s-m%s-%s" % (key, q["material_id"], paper_tag)
                    mats_out[entry["materialId"]] = mat_html
                collected.append(entry)
                usable += 1
            print("  %-44s +%d (累计 %d)" % (f["name"][:44], usable, len(collected)))
        all_out[key] = {"questions": collected, "materials": mats_out}
        if not stat_only:
            write_module(key, label, all_out[key])

    print("\n===== 汇总 =====")
    total = 0
    for key, label, _, _ in MODULES:
        n = len(all_out.get(key, {}).get("questions", []))
        total += n
        print("%-10s %4d 题" % (label, n))
    print("合计 %d 题" % total)

    if stat_only:
        return
    if "--prune" in sys.argv:
        prune_images()


if __name__ == "__main__":
    main()
