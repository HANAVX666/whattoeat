// 给缺图的菜从 Bing 图片搜补照片：标题必须含菜名/别名，图片要真下得下来、够大、横构图。
// 用法：node scripts/photos-bing.mjs [--limit=200] [--only=<dishId>] [--workers=5]
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const PY = "C:/Users/LENOVO/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe";
const args = process.argv.slice(2);
const num = (k, def) => { const a = args.find((x) => x.startsWith("--" + k + "=")); return a ? Number(a.split("=")[1]) : def; };
const LIMIT = num("limit", 200);
const WORKERS = num("workers", 5);
const ONLY = (args.find((a) => a.startsWith("--only=")) || "").split("=")[1];
const RELAX = args.includes("--relax");
const QOVERRIDE = (args.find((a) => a.startsWith("--q=")) || "").split("=")[1] || "";
const TMP = path.join(ROOT, ".photos-tmp");
fs.mkdirSync(TMP, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ascii = (s) => (s && !/[^\x00-\x7F]/.test(s) ? s : "");

function getText(url, referer) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => finish({ status: 0, body: "" }), 12000);
    const req = https.get(url, { headers: { "user-agent": UA, referer: ascii(referer) || "https://cn.bing.com/", "accept-language": "zh-CN,zh;q=0.9" } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume(); done = true; clearTimeout(timer);
        return resolve(getText(new URL(r.headers.location, url).href, referer));
      }
      const chunks = []; let n = 0;
      r.on("data", (d) => { n += d.length; if (n < 4e6) chunks.push(d); });
      r.on("end", () => finish({ status: r.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
      r.on("error", () => finish({ status: 0, body: "" }));
    });
    req.on("error", () => finish({ status: 0, body: "" }));
  });
}

function download(url, dest, referer) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => { try { req.destroy(); } catch {} finish(0); }, 10000);
    const lib = url.startsWith("https") ? https : http;
    let req;
    try {
      req = lib.get(url, { headers: { "user-agent": UA, referer: ascii(referer), accept: "image/avif,image/webp,image/*,*/*;q=0.8" } }, (r) => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          r.resume(); done = true; clearTimeout(timer);
          return resolve(download(new URL(r.headers.location, url).href, dest, referer));
        }
        if (r.statusCode !== 200) { r.resume(); return finish(0); }
        const w = fs.createWriteStream(dest);
        r.pipe(w);
        w.on("finish", () => { let size = 0; try { size = fs.statSync(dest).size; } catch {} finish(size); });
        w.on("error", () => finish(0));
      });
    } catch { return finish(0); }
    req.on("error", () => finish(0));
  });
}

const DISHES = fs.readdirSync(path.join(ROOT, "data/dishes"))
  .filter((f) => f.endsWith(".json") && /^batch-\d+\.json$/.test(f))
  .sort()
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data/dishes", f), "utf8")));
const photosFile = path.join(ROOT, "data/photos.json");
const PHOTOS = JSON.parse(fs.readFileSync(photosFile, "utf8"));

const clean = (s) => s.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
const keysOf = (d) => [d.name, ...(d.aliases || [])].filter((k) => k && k.length >= 2);
const hostsOk = (u) => /^https?:\/\//.test(u) && !/\.(gif|svg)(\?|$)/i.test(u)
  && !/logo|icon|banner|avatar|emoji|sprite|placeholder|watermark/i.test(u);

function parseBing(html) {
  const items = [];
  const re = /<a [^>]*class="iusc"[^>]*?\sm="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    try {
      const j = JSON.parse(raw);
      if (j && j.murl) items.push({ u: j.murl.replace(/&amp;/g, "&"), t: clean(j.t || ""), p: (j.purl || "").replace(/&amp;/g, "&") });
    } catch {}
  }
  return items;
}

async function candidates(d) {
  const keys = keysOf(d);
  const seen = new Set(), out = [];
  for (const first of [1, 36]) {
    const q = QOVERRIDE ? QOVERRIDE + " " + first : (RELAX ? d.name + " 成品" : d.name + " 做法 成品");
    const url = "https://cn.bing.com/images/async?q=" + encodeURIComponent(q) + "&first=" + first + "&count=35&mmasync=1" + (RELAX ? "" : "&qft=+filterui:imagesize-large");
    const r = await getText(url);
    if (r.status !== 200) break;
    for (const it of parseBing(r.body)) {
      if (out.length >= 5) break;
      if (!keys.some((k) => it.t.includes(k))) continue;
      if (!hostsOk(it.u) || seen.has(it.u)) continue;
      seen.add(it.u);
      out.push(it);
    }
    if (out.length >= 5) break;
  }
  return out;
}

function dims(files) {
  if (!files.length) return {};
  const listFile = path.join(TMP, "files-" + process.pid + ".json");
  fs.writeFileSync(listFile, JSON.stringify(files));
  const script = path.join(TMP, "dims.py");
  if (!fs.existsSync(script)) {
    fs.writeFileSync(script, [
      "import json, sys",
      "from PIL import Image",
      "files = json.load(open(sys.argv[1], encoding='utf-8'))",
      "out = {}",
      "for f in files:",
      "    try:",
      "        im = Image.open(f); out[f] = [im.width, im.height]",
      "    except Exception:",
      "        out[f] = [0, 0]",
      "print(json.dumps(out))"
    ].join("\n"));
  }
  const r = spawnSync(PY, [script, listFile], { encoding: "utf8" });
  try { return JSON.parse(r.stdout); } catch { return {}; }
}

async function handle(d) {
  const cands = await candidates(d);
  const tasks = cands.slice(0, 5).map(async (c, i) => {
    const ext = /\.png(\?|$)/i.test(c.u) ? "png" : "jpg";
    const file = path.join(TMP, d.id + "-" + process.pid + "-" + i + "." + ext);
    let size = await download(c.u, file, c.p);
    if (!size) size = await download(c.u, file, "");
    if (!size) { try { fs.unlinkSync(file); } catch {} return null; }
    return { file, c, size };
  });
  const saved = (await Promise.all(tasks)).filter(Boolean);
  const dmap = dims(saved.map((s) => s.file));
  const picks = [];
  for (const s of saved) {
    if (picks.length >= 3) break;
    const [w, h] = dmap[s.file] || [0, 0];
    const minW = RELAX ? 420 : 520;
    if (!w || w < minW) continue;
    const ratio = w / h;
    if (RELAX ? (ratio < 0.85 || ratio > 2.8) : (ratio < 1.15 || ratio > 2.4)) continue;
    if (s.size < (RELAX ? 11000 : 15000)) continue;
    picks.push({ u: s.c.u });
  }
  for (const s of saved) { try { fs.unlinkSync(s.file); } catch {} }
  if (picks.length) { PHOTOS[d.id] = picks; return { id: d.id, n: picks.length, cand: cands.length, t: "" }; }
  return { id: d.id, n: 0, cand: cands.length, t: "-" };
}

const todo = DISHES.filter((d) => (ONLY ? d.id === ONLY : (PHOTOS[d.id] || []).length === 0)).slice(0, LIMIT);
console.log("todo", todo.length, "workers", WORKERS);
let i = 0, added = 0;
const report = [];
let lastFlush = 0;
async function worker() {
  while (i < todo.length) {
    const d = todo[i++];
    let r;
    try { r = await handle(d); } catch (e) { r = { id: d.id, n: 0, cand: 0, t: "ERR " + e.message }; }
    if (r.n) added++;
    report.push([r.id, r.n, r.cand, r.t].join("\t"));
    const now = Date.now();
    if (now - lastFlush > 4000) {
      lastFlush = now;
      fs.writeFileSync(photosFile, JSON.stringify(PHOTOS));
      fs.writeFileSync(path.join(ROOT, ".photos-bing.log"), report.join("\n"));
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
fs.writeFileSync(photosFile, JSON.stringify(PHOTOS));
fs.writeFileSync(path.join(ROOT, ".photos-bing.log"), report.join("\n"));
console.log("added", added, "of", todo.length);
