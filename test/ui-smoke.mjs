// 无浏览器的冒烟测试：把 app.js 跑起来，点一遍所有页面
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "app.js"), "utf8");

const appEl = { innerHTML: "", querySelector: () => null };
const inputEl = { value: "" };
const foldInput = { value: "" };
const document = {
  querySelector: (s) => (s === "#app" ? appEl : s === "#pantry" ? inputEl : s === "#foldname" ? foldInput : null),
  querySelectorAll: () => [],
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

// ----- 今日推荐 -----
click({ go: "home" });
click({ go: "daily" });
ok("今日推荐有 8 道", (html().match(/class='dish'/g) || []).length === 8 && html().includes("今日推荐"));
ok("今日推荐有推荐理由", html().includes("水煮") || html().includes("起锅") || html().includes("class='why'"));
ok("今日推荐没有刷新按钮", !html().includes("刷新换一批"));

// ----- 学习指南 -----
click({ go: "back" });
ok("从今日推荐能返回首页", html().includes("不知道吃什么"));
click({ go: "learn" });
ok("学习指南有四个难度", (html().match(/data-lvl=/g) || []).length === 4);
ok("学习指南有外链条目", (html().match(/class='learn-item'/g) || []).length === 4);
click({ lvl: "师" });
ok("切到大师级内容变了", html().includes("吊高汤"));

// ----- 收藏分类 -----
click({ go: "home" });
click({ go: "saved" });
ok("收藏页有默认分类", html().includes("我想吃") && html().includes("想试试") && html().includes("考虑考虑"));
click({ newfolder: "" });
ok("弹出新建分类", html().includes("新建分类"));
foldInput.value = "周末做";
click({ folderSave: "new" });
ok("新建分类成功", html().includes("周末做"));
click({ folder: "want" });
ok("能打开分类", html().includes("这个分类还是空的"));

// ----- 详情页收藏 / 吃过了 / 复制 / 返回 -----
click({ go: "home" });
click({ go: "spin" });
const sId = (html().match(/data-id='([^']+)'/g) || [])[0].match(/'([^']+)'/)[1];
click({ id: sId });
ok("详情页有收藏按钮", html().includes("☆ 收藏"));
click({ save: sId });
ok("点收藏弹出分类", html().includes("收藏到"));
click({ collect: "want" });
ok("收藏后按钮变已收藏", html().includes("★ 已收藏"));
const nId = (html().match(/data-id='([^']+)'/g) || []).map((x) => x.match(/'([^']+)'/)[1]).find((x) => x !== sId);
click({ id: nId });
click({ go: "back" });
ok("从推荐菜返回上一道菜", mod.state.current === sId && mod.state.screen === "detail");
click({ go: "back" });
ok("再返回回到结果页", mod.state.screen === "result");

click({ id: sId });
click({ eat: sId });
ok("吃过了状态写进 state", (mod.state.eaten || []).some((x) => x.id === sId));
click({ eat: sId });
ok("再点一次能取消吃过了", !(mod.state.eaten || []).some((x) => x.id === sId));

click({ copy: sId });
ok("复制失败时给出可复制的文字", html().includes("复制这段") && html().includes("做法"));
click({ sheetClose: "" });
ok("关闭弹层", !html().includes("复制这段"));

// ----- 收藏落库 -----
click({ go: "home" });
click({ go: "saved" });
ok("收藏页统计到 1 道", html().includes("1 道"));

const bad = checks.filter((c) => !c[1]);
console.log(bad.length ? "FAIL " + bad.length + " / " + checks.length : "OK 全部通过（" + checks.length + " 项）");
if (bad.length) process.exitCode = 1;
