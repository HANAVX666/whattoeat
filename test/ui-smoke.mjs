// 无浏览器的冒烟测试：把 app.js 跑起来，点一遍所有页面
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "app.js"), "utf8");

const appEl = { innerHTML: "", querySelector: () => null };
const inputEl = { value: "" };
const document = {
  querySelector: (s) => (s === "#app" ? appEl : s === "#pantry" ? inputEl : null),
  addEventListener: (type, fn) => { handlers[type] = fn; },
};
const handlers = {};
const window = { scrollTo: () => {} };
const navigator = {};
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
};
const fetch = async (p) => {
  const clean = p.replace(/^\.\//, "");
  const abs = join(ROOT, clean);
  return { ok: true, json: async () => JSON.parse(readFileSync(abs, "utf8")) };
};

const mod = new Function("document", "window", "navigator", "localStorage", "fetch",
  src + "\nreturn { state, render, pick, activeQs, hardPool };"
)(document, window, navigator, localStorage, fetch);

const click = (dataset) => {
  const t = { dataset };
  handlers.click({ target: { closest: () => t } });
};
const html = () => appEl.innerHTML;

await new Promise((r) => setTimeout(r, 50)); // 等数据加载完

const checks = [];
const ok = (name, cond) => { checks.push([name, !!cond]); if (!cond) console.log("  ✗ " + name); };

ok("首屏渲染出三个入口", html().includes("不知道吃什么") && html().includes("家里有食材"));
click({ go: "quiz" });
ok("进答题页", html().includes("1 / ") && html().includes("class='opt"));
// 一路答题直到进入 soft
let guard = 0;
while (!html().includes("还有什么讲究") && guard++ < 20) {
  const qid = mod.activeQs()[mod.state.qi].id;
  const val = mod.activeQs()[mod.state.qi].opts[mod.activeQs()[mod.state.qi].opts.length - 1][1];
  click({ ans: val });
}
ok("答完题进入软选项页", html().includes("还有什么讲究"));
ok("软选项渲染出芯片", (html().match(/chipbtn/g) || []).length > 20);
const chips = (html().match(/data-soft='([^']+)'/g) || []);
ok("芯片带 data-soft", chips.length > 20);
click({ soft: "tag:下饭" });
ok("勾选后仍在软选项页", html().includes("还有什么讲究"));
click({ go: "result" });
ok("结果页有卡片", (html().match(/class='dish'/g) || []).length > 0);
ok("结果页有刷新按钮", html().includes("刷新换一批"));
const firstId = (html().match(/data-id='([^']+)'/g) || [])[0];
click({ id: firstId.match(/'([^']+)'/)[1] });
ok("详情页有做法", html().includes("做法") && html().includes("class='steps'") && html().includes("class='step'"));
click({ go: "back" });
ok("从详情返回结果页", html().includes("刷新换一批"));

click({ go: "refresh" });
ok("刷新后仍有卡片", (html().match(/class='dish'/g) || []).length > 0);

click({ go: "home" });
ok("回到首页", html().includes("不知道吃什么"));
click({ go: "pantry" });
ok("食材页有输入框", html().includes("id='pantry'"));
inputEl.value = "鸡蛋 番茄";
click({ go: "pantryResult" });
ok("食材结果页有卡片", (html().match(/class='dish'/g) || []).length > 0);
click({ go: "pantryRefresh" });
ok("食材刷新仍正常", (html().match(/class='dish'/g) || []).length > 0);

click({ go: "home" });
click({ go: "spin" });
ok("随机抽也有卡片", (html().match(/class='dish'/g) || []).length > 0);

const bad = checks.filter((c) => !c[1]);
console.log(bad.length ? "FAIL " + bad.length + " / " + checks.length : "OK 全部通过（" + checks.length + " 项）");
if (bad.length) process.exitCode = 1;
