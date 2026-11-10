// 抓必应/百度图片缩略图，给每道菜配 3 张真实照片
// 数据源：百度图片 acjson（国内直连，缩略图托管在 img*.baidu.com）
// 用法: node scripts/photos.mjs [--limit N] [--only id1,id2]
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data/photos.json");

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",")) : null;

const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "data/index.json"), "utf8"));
const dishes = idx.files.flatMap((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data/dishes", f), "utf8")));

let db = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const todo = dishes
  .filter((d) => !only || only.has(d.id))
  .filter((d) => !(db[d.id] && db[d.id].length))
  .slice(0, limit);

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

function getJson(word, pn) {
  const p = "/search/acjson?tn=resultjson_com&ipn=rj&word=" + encodeURIComponent(word) +
    "&pn=" + pn + "&rn=24&ie=utf-8&oe=utf-8";
  return new Promise((resolve) => {
    https.get({ host: "image.baidu.com", path: p, timeout: 12000, headers: {
      "user-agent": UA, "accept-language": "zh-CN,zh;q=0.9", referer: "https://image.baidu.com/" } }, (res) => {
      let b = ""; res.setEncoding("utf8");
      res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b).data || []); } catch { resolve([]); } });
    }).on("error", () => resolve([])).on("timeout", function () { this.destroy(); resolve([]); });
  });
}

const clean = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

function pick(items, names) {
  const seen = new Set();
  const scored = [];
  for (const x of items) {
    if (!x || !x.thumbURL) continue;
    const title = clean(x.fromPageTitle);
    if (!names.some((n) => title.includes(n))) continue;
    const w = Number(x.width), h = Number(x.height);
    if (!w || !h) continue;
    const landscape = w / h >= 1.15 ? 1 : 0;
    if (w < 520) continue;
    const url = (x.middleURL || x.thumbURL).replace(/&amp;/g, "&");
    const key = (x.thumbURL || "").split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    scored.push({ u: url, p: clean(x.fromURL || x.fromJumpUrl || ""), t: title.slice(0, 36), score: landscape * 3 + Math.min(w, 1600) / 1600 });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(({ score, ...rest }) => rest);
}

let n = 0;
for (const d of todo) {
  const names = [d.name, ...(d.aliases || [])].filter(Boolean);
  let got = pick(await getJson(d.name, 0), names);
  if (got.length < 2) {
    const more = pick(await getJson(d.name, 24), names);
    for (const m of more) if (got.length < 3 && !got.some((g) => g.u === m.u)) got.push(m);
  }
  db[d.id] = got;
  n++;
  if (n % 20 === 0) {
    fs.writeFileSync(OUT, JSON.stringify(db, null, 1));
    console.log("done", n, "/", todo.length);
  }
  await new Promise((r) => setTimeout(r, 120));
}
fs.writeFileSync(OUT, JSON.stringify(db, null, 1));
console.log("FINISH", n, "photos", Object.values(db).filter((v) => v && v.length).length, "/", dishes.length);
