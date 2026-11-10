#!/usr/bin/env python
"""把 photos.json 里每道菜的第一张图下载下来，压成 420px 宽的 webp 缩略图。

用法：
  python scripts/make-thumbs.py            # 只处理还没有缩略图的菜
  python scripts/make-thumbs.py --force    # 全部重做
  python scripts/make-thumbs.py --limit 10 # 只做前 10 道（调试用）
"""
import io
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(ROOT, "data", "photos.json")
OUT = os.path.join(ROOT, "data", "thumbs")
WIDTH = 420
QUALITY = 72

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Referer": "https://image.baidu.com/",
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def make_one(item):
    dish_id, url = item
    dest = os.path.join(OUT, dish_id + ".webp")
    try:
        raw = fetch(url)
        from PIL import Image
        im = Image.open(io.BytesIO(raw))
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        # 卡片是横图，按 4:3 居中裁一次，省得前端 cover 裁到菜盘子外面
        w, h = im.size
        target = WIDTH / 3 * 4  # 420 宽对应的 4:3 高度基准
        if w / h > 4 / 3:
            new_w = int(h * 4 / 3)
            left = (w - new_w) // 2
            im = im.crop((left, 0, left + new_w, h))
        else:
            new_h = int(w * 3 / 4)
            top = max(0, int((h - new_h) * 0.45))
            im = im.crop((0, top, w, top + new_h))
        im = im.resize((WIDTH, int(WIDTH * 3 / 4)), Image.LANCZOS)
        im.save(dest, "WEBP", quality=QUALITY, method=6)
        return dish_id, os.path.getsize(dest), None
    except Exception as exc:  # 网络/解码失败都跳过，前端会回落原图
        return dish_id, 0, str(exc)[:80]


def main():
    force = "--force" in sys.argv
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    os.makedirs(OUT, exist_ok=True)
    photos = json.load(open(PHOTOS, encoding="utf-8"))
    todo = []
    for dish_id, arr in photos.items():
        if not arr:
            continue
        if not force and os.path.exists(os.path.join(OUT, dish_id + ".webp")):
            continue
        todo.append((dish_id, arr[0]["u"]))
    if limit:
        todo = todo[:limit]
    print("待处理", len(todo), "道")
    ok = fail = 0
    errors = []
    total = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for i, (dish_id, size, err) in enumerate(pool.map(make_one, todo), 1):
            if err:
                fail += 1
                errors.append((dish_id, err))
            else:
                ok += 1
                total += size
            if i % 50 == 0:
                print("  ...", i, "/", len(todo))
    print("完成 ok=%d fail=%d 平均 %.1fKB 合计 %.1fMB" % (
        ok, fail, (total / ok / 1024) if ok else 0, total / 1024 / 1024))
    for dish_id, err in errors[:10]:
        print("  失败", dish_id, err)
    # 给前端一份清单，避免为没有缩略图的菜发 404 请求
    ids = sorted(f[:-5] for f in os.listdir(OUT) if f.endswith(".webp"))
    with open(os.path.join(ROOT, "data", "thumbs.json"), "w", encoding="utf-8") as fh:
        json.dump(ids, fh, ensure_ascii=False)
        fh.write("\n")
    print("清单 data/thumbs.json:", len(ids), "条")


if __name__ == "__main__":
    main()
