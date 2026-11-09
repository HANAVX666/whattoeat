// 生成设计预览页：把 app.js 的各个页面渲染成静态 HTML，方便截图检查
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "app.js"), "utf8");

const appEl = { innerHTML: "" };
const inputEl = { value: "" };
const handlers = {};
const document = {
  querySelector: (s) => (s === "#app" ? appEl : s === "#pantry" ? inputEl : null),
  addEventListener: (type, fn) => { handlers[type] = fn; },
};
const window = { scrollTo: () => {} };
const store = new Map();
const localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
const fetch = async (p) => ({ ok: true, json: async () => JSON.parse(readFileSync(join(ROOT, p.replace(/^\.\//, "")), "utf8")) });

const mod = new Function("document", "window", "navigator", "localStorage", "fetch",
  src + "\nreturn { state, render, pick, activeQs, hardPool };"
)(document, window, {}, localStorage, fetch);
const click = (dataset) => handlers.click({ target: { closest: () => ({ dataset }) } });
const snap = () => appEl.innerHTML;

await new Promise((r) => setTimeout(r, 80));

const shots = [];
shots.push(["首页", snap()]);

click({ go: "quiz" });
shots.push(["提问（第 1 题）", snap()]);

let guard = 0;
while (!snap().includes("还有什么讲究") && guard++ < 20) {
  const q = mod.activeQs()[mod.state.qi];
  click({ ans: q.opts[q.opts.length - 1][1] });
}
click({ soft: "tag:下饭" });
click({ soft: "tag:清淡" });
shots.push(["软选项", snap()]);

click({ go: "result" });
shots.push(["推荐结果", snap()]);
const firstId = (snap().match(/data-id='([^']+)'/) || [])[1];
click({ id: firstId });
shots.push(["菜品详情", snap()]);

click({ go: "home" });
click({ go: "pantry" });
shots.push(["食材输入", snap()]);
inputEl.value = "鸡蛋 番茄 面条";
click({ go: "pantryResult" });
shots.push(["食材结果", snap()]);

const frames = shots.map(([label, html]) =>
  '<div class="pv"><div class="pv-label">' + label + '</div><div class="frame"><div class="app">' + html + "</div></div></div>").join("\n");

const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<link rel="stylesheet" href="./style.css">
<style>
  body{background:#efe7dc;padding:22px;margin:0}
  .sheet{display:grid;grid-template-columns:repeat(3,390px);gap:22px;justify-content:center;align-items:start}
  .pv-label{font:600 12px/1.4 system-ui;color:#8b7c70;margin:0 0 6px 4px;letter-spacing:.04em}
  .frame{position:relative;width:390px;height:820px;overflow:hidden;border-radius:26px;background:#fbf8f3;
    box-shadow:0 8px 30px rgba(70,45,25,.14);}
  .frame .app{max-width:520px;margin:0 auto;padding:18px 16px 130px;min-height:100%;overflow:hidden}
  .frame .sticky{position:absolute;bottom:0;left:0;right:0}
  .frame .hero{height:190px}
  .frame *, .frame *::before, .frame *::after{animation:none!important;transition:none!important}
</style></head><body><div class="sheet">${frames}</div></body></html>`;
writeFileSync(join(ROOT, "preview.html"), page, "utf8");
console.log("wrote preview.html with " + shots.length + " screens");
