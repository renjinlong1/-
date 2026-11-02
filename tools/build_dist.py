# -*- coding: utf-8 -*-
"""生成用于发布 / 拷贝的纯净副本：dist/（只含运行所需文件）。"""
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, "dist")
ITEMS = ["index.html", "start.bat", "README.md", "assets"]

if os.path.exists(DST):
    shutil.rmtree(DST)
os.makedirs(DST)
for item in ITEMS:
    src = os.path.join(ROOT, item)
    if not os.path.exists(src):
        continue
    if os.path.isdir(src):
        shutil.copytree(src, os.path.join(DST, item))
    else:
        shutil.copy2(src, os.path.join(DST, item))

total = 0
for base, _, files in os.walk(DST):
    for f in files:
        total += os.path.getsize(os.path.join(base, f))
print("dist 生成完成：%.1f MB" % (total / 1024 / 1024))
