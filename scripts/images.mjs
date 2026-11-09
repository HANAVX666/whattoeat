// 从维基百科抓菜品缩略图，写回 data/dishes/*.json 的 image 字段
// 需要能上外网。用法：cd whattoeat && npm run images
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "data/dishes");
const files = readdirSync(dir).filter((f) => /^batch-\d+\.json$/.test(f)).sort();
const batches = files.map((f) => ({ f, arr: JSON.parse(readFileSync(join(dir, f), "utf8")) }));
const dishes = batches.flatMap((b) => b.arr);

const API = "https://zh.wikipedia.org/w/api.php";
const THUMB = 560;
const BATCH = 20;
const UA = "whattoeat/0.1 (local image fetcher; contact: local user)";

async function queryOnce(titles) {
  const url =
    API + "?action=query&format=json&prop=pageimages&pithumbsize=" + THUMB +
    "&redirects=1&titles=" + encodeURIComponent(titles.join("|"));
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  const norm = new Map((j.query.normalized || []).map((n) => [n.from, n.to]));
  const redir = new Map((j.query.redirects || []).map((r) => [r.from, r.to]));
  const thumbs = new Map();
  for (const p of Object.values(j.query.pages || {})) {
    if (p.thumbnail && p.thumbnail.source) thumbs.set(p.title, p.thumbnail.source);
  }
  return (t) => {
    let x = norm.get(t) || t;
    for (let i = 0; i < 3 && redir.has(x); i++) x = redir.get(x);
    return thumbs.get(x) || null;
  };
}

async function lookup(titles) {
  const map = new Map();
  for (let i = 0; i < titles.length; i += BATCH) {
    const chunk = titles.slice(i, i + BATCH);
    try {
      const get = await queryOnce(chunk);
      for (const t of chunk) {
        const url = get(t);
        if (url) map.set(t, url);
      }
    } catch (e) {
      console.warn("  批 " + (i / BATCH + 1) + " 失败：" + e.message);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return map;
}

let hit = 0;
const miss = [];

console.log("共 " + dishes.length + " 道菜，开始查询维基百科…");
const byName = await lookup(dishes.map((d) => d.name));
for (const d of dishes) {
  const url = byName.get(d.name);
  if (url) { d.image = url; hit++; } else { d.image = ""; miss.push(d.name); }
}

if (miss.length) {
  console.log("直接命中 " + hit + " / " + dishes.length + "，其余用别名再试一次…");
  const aliasQ = [];
  const aliasOf = new Map();
  for (const d of dishes) {
    if (d.image || !d.aliases || !d.aliases.length) continue;
    const a = d.aliases[0];
    aliasQ.push(a);
    aliasOf.set(a, d);
  }
  if (aliasQ.length) {
    const byAlias = await lookup(aliasQ);
    for (const [a, d] of aliasOf) {
      const url = byAlias.get(a);
      if (url) {
        d.image = url;
        hit++;
        const i = miss.indexOf(d.name);
        if (i >= 0) miss.splice(i, 1);
      }
    }
  }
}

let wrote = 0;
for (const b of batches) {
  if (b.arr.some((d) => d.image)) {
    writeFileSync(join(dir, b.f), JSON.stringify(b.arr, null, 2) + "\n");
    wrote++;
  }
}

console.log("\n结果：配上图 " + hit + " / " + dishes.length + " 道（" + Math.round((hit / dishes.length) * 100) + "%）");
if (miss.length) console.log("没配上的：" + miss.join("、"));
console.log(wrote ? "\n已写回 " + wrote + " 个数据文件。跑一下 npm run validate 确认没写坏。" : "\n一张都没配上，数据文件没有改动。");
