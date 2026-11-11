import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const tax = load("data/taxonomy.json");
const ing = load("data/ingredients.json");
const files = readdirSync(join(root, "data/dishes")).filter((f) => f.endsWith(".json")).sort();

const dishes = [];
for (const f of files) {
  const arr = load("data/dishes/" + f);
  if (!Array.isArray(arr)) { console.error("!! " + f + " 顶层不是数组"); process.exit(1); }
  for (const d of arr) { d.__file = f; dishes.push(d); }
}

const errors = [];
const E = (d, m) => errors.push((d.id || "(no-id)") + " @ " + d.__file + ": " + m);

const REQ = ["id","name","aliases","region","diet","taste","spicy","method","form","timeMin","difficulty","popularity","mainIngredients","tags","steps","tips","imageQuery"];
const ingNames = new Set(ing.map((i) => i.name));
const tagSet = new Set(tax.tags);
const seenId = new Map();
const seenName = new Map();

for (const d of dishes) {
  for (const k of REQ) if (d[k] === undefined) E(d, "缺少字段 " + k);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(d.id))) E(d, "id 需为 kebab-case");
  if (seenId.has(d.id)) E(d, "id 重复，另见 " + seenId.get(d.id)); else seenId.set(d.id, d.__file);
  if (!String(d.name || "").trim()) E(d, "name 为空");
  for (const n of [d.name].concat(d.aliases || [])) {
    if (seenName.has(n)) E(d, "名称或别名重复：" + n + "，另见 " + seenName.get(n));
    else seenName.set(n, d.id);
  }
  for (const f of ["region","diet","taste","method","form"]) {
    if (!tax[f].includes(d[f])) E(d, f + " 不在词表：" + d[f]);
  }
  if (!(Number.isInteger(d.spicy) && d.spicy >= 0 && d.spicy <= 4)) E(d, "spicy 需为 0-4 整数");
  if (!(Number.isInteger(d.timeMin) && d.timeMin >= 1 && d.timeMin <= 600)) E(d, "timeMin 需为 1-600 整数");
  if (![1,2,3].includes(d.difficulty)) E(d, "difficulty 需为 1-3");
  if (!(typeof d.popularity === "number" && d.popularity >= 1 && d.popularity <= 5 && (d.popularity * 2) % 1 === 0)) E(d, "popularity 需为 1-5、0.5 一档");
  if (!Array.isArray(d.mainIngredients) || d.mainIngredients.length === 0) E(d, "mainIngredients 不能为空");
  else for (const x of d.mainIngredients) if (!ingNames.has(x)) E(d, "主食材不在词表：" + x);
  if (!Array.isArray(d.tags) || d.tags.length === 0) E(d, "tags 不能为空");
  else for (const t of d.tags) if (!tagSet.has(t)) E(d, "tag 不在词表：" + t);
  if (!Array.isArray(d.steps) || d.steps.length < 3 || d.steps.length > 10) E(d, "steps 需 3-10 步");
  else for (const s of d.steps) if (s.length < 6 || s.length > 90) E(d, "单步长度异常 " + s.length + " 字：" + s.slice(0, 16));
  if (!String(d.tips || "").trim()) E(d, "tips 为空");
  if (!String(d.imageQuery || "").trim()) E(d, "imageQuery 为空");
}

const count = (key) => {
  const m = new Map();
  for (const d of dishes) { const k = d[key]; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([k, v]) => k + ":" + v).join("  ");
};

console.log("批次文件  " + files.join(", "));
console.log("菜品总数  " + dishes.length);
console.log("荤素      " + count("diet"));
console.log("口味      " + count("taste"));
console.log("辣度      " + count("spicy"));
console.log("做法      " + count("method"));
console.log("形态      " + count("form"));
console.log("地区      " + count("region"));

const timeBucket = (m) => (m <= 10 ? "A 十分钟" : m <= 30 ? "B 半小时" : m <= 60 ? "C 一小时" : "D 一小时以上");
const tb = new Map();
for (const d of dishes) { const k = timeBucket(d.timeMin); tb.set(k, (tb.get(k) || 0) + 1); }
console.log("时长      " + [...tb.entries()].sort().map(([k, v]) => k + ":" + v).join("  "));

const pb = new Map();
for (const d of dishes) { const k = "大众度" + d.popularity; pb.set(k, (pb.get(k) || 0) + 1); }
console.log("大众度    " + [...pb.entries()].sort().map(([k, v]) => k + ":" + v).join("  "));

const gaps = [];
for (const f of ["method","form","taste","diet"]) {
  for (const v of tax[f]) {
    const n = dishes.filter((d) => d[f] === v).length;
    if (n < 2) gaps.push(f + "=" + v + " 只有 " + n + " 道");
  }
}
for (let s = 0; s <= 4; s++) {
  const n = dishes.filter((d) => d.spicy === s).length;
  if (n < 2) gaps.push("辣度=" + s + " 只有 " + n + " 道");
}
if (gaps.length) console.log("\n缺口（建议补）\n  " + gaps.join("\n  "));

if (errors.length) {
  console.log("\nFAIL 校验未通过，共 " + errors.length + " 处\n  " + errors.join("\n  "));
  process.exit(1);
}
writeFileSync(join(root, "data/index.json"), JSON.stringify({ files, count: dishes.length }, null, 2) + "\n");
// 首屏只读 lite.json（不含做法，约 1/3 体积）；做法进详情页再按批次拉
const lite = dishes.map((d) => {
  const o = {};
  for (const k of REQ) if (k !== "steps" && k !== "tips") o[k] = d[k];
  o.b = d.__file;
  return o;
});
writeFileSync(join(root, "data/lite.json"), JSON.stringify(lite) + "\n");
const stepDir = join(root, "data/steps");
rmSync(stepDir, { recursive: true, force: true });
mkdirSync(stepDir, { recursive: true });
for (const f of files) {
  const obj = {};
  for (const d of dishes) if (d.__file === f) obj[d.id] = { steps: d.steps, tips: d.tips };
  writeFileSync(join(stepDir, f), JSON.stringify(obj) + "\n");
}

console.log("\nOK 全部通过" + (gaps.length ? "（缺口不阻塞）" : ""));
