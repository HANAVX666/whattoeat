// 真浏览器回归：node test/e2e.mjs（自己起服务与无头 Chrome，跑完自动关）
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.E2E_PORT || 8110);
const CDP = Number(process.env.E2E_CDP || 9235);
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SHOTS = join(ROOT, ".shots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = join(os.tmpdir(), "eatwha-e2e-" + Date.now());
mkdirSync(SHOTS, { recursive: true });

let server, chrome, ws, id = 0;
const pend = new Map();
const results = [];
const ok = (name, cond, extra) => {
  results.push([name, !!cond]);
  console.log((cond ? "  ✓ " : "  ✗ ") + name + (cond ? "" : "  " + JSON.stringify(extra ?? "")));
};

async function main() {
  server = spawn(process.env.NODE_BIN || "node", ["server.mjs"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  await sleep(700);
  chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-crash-reporter", "--hide-scrollbars",
    "--user-data-dir=" + tmp, "--remote-debugging-port=" + CDP, "--window-size=390,844", "about:blank"
  ], { stdio: "ignore" });

  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    await sleep(250);
    try { list = await (await fetch("http://127.0.0.1:" + CDP + "/json/list")).json(); } catch (e) {}
  }
  if (!list) throw new Error("Chrome 没起来");
  ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  });
  await new Promise((r) => ws.addEventListener("open", r));
  const send = (method, params = {}) => new Promise((res) => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  // 机器本身可能是深色系统，先钉死浅色，最后再单独验深色
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "eval failed");
    return r.result?.result?.value;
  };
  const shot = async (name) => {
    const s = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(SHOTS, name), Buffer.from(s.result.data, "base64"));
  };
  const nav = async (url) => { await send("Page.navigate", { url }); await sleep(1600); };
  const click = async (sel) => { const hit = await ev("!!document.querySelector(" + JSON.stringify(sel) + ")"); if (!hit) throw new Error("找不到 " + sel); await ev("document.querySelector(" + JSON.stringify(sel) + ").click()"); await sleep(220); };
  const text = (sel) => ev("(document.querySelector(" + JSON.stringify(sel) + ")||{}).textContent || ''");

  await nav("http://127.0.0.1:" + PORT + "/?e2e=1");
  await ev("localStorage.clear()");
  await nav("http://127.0.0.1:" + PORT + "/?e2e=2");

  // 首页入口
  ok("首页 5 个主入口", (await ev("document.querySelectorAll('.big').length")) === 5, await ev("document.querySelectorAll('.big').length"));
  ok("首页有搜索/收藏/口味档案", (await ev("document.querySelectorAll('.home-search').length + document.querySelectorAll('.home-link').length")) === 3);
  ok("搜索入口在第一个入口之前", (await ev("!!document.querySelector('.home-search') && document.querySelectorAll('.home-search')[0].compareDocumentPosition(document.querySelector('.big')) === 4")) === true);
  await shot("v350-home-light.png");

  // 搜索
  await click("[data-go='search']");
  ok("搜索页打开", (await ev("!!document.querySelector('#searchq')")) === true);
  await ev(`(() => { const i = document.querySelector('#searchq'); i.value = '番茄'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(300);
  ok("搜「番茄」有结果", (await ev("document.querySelectorAll('#hitwrap .dish').length")) > 0, await ev("document.querySelectorAll('#hitwrap .dish').length"));
  ok("结果里有番茄炒蛋", (await text("#hitwrap")).includes("番茄"));
  await shot("v350-search.png");

  // 打开详情：做法要按需加载出来
  await ev("document.querySelector('#hitwrap .dish').click()");
  await sleep(700);
  ok("详情页做法加载完成", !(await text(".steps")).includes("做法加载中") && (await ev("document.querySelectorAll('.steps .step').length")) >= 2, await text(".steps"));
  ok("详情页有收藏/吃过/复制", (await ev("!!document.querySelector('[data-save]') && !!document.querySelector('[data-eat]') && !!document.querySelector('[data-copy]')")) === true);
  await shot("v350-detail.png");
  // 不想吃 → 口味档案恢复
  await click("[data-dislike]");
  ok("详情页标记不想吃", (await text("[data-dislike]")).includes("已标记"));
  await ev("document.querySelector('.back').click()");
  await sleep(300);
  await ev("document.querySelector('.back').click()");
  await sleep(300);
  await click("[data-go='profile']");
  ok("口味档案列出不想吃", (await text("#app")).includes("不想吃") && (await ev("document.querySelectorAll('[data-undislike]').length")) === 1);
  await shot("v350-profile.png");
  await click("[data-undislike]");
  ok("恢复后列表清空", (await ev("document.querySelectorAll('[data-undislike]').length")) === 0);

  // 结果页 + 刷到底
  await ev("document.querySelector('.back').click()");
  await sleep(400);
  await click("[data-go='spin']");
  ok("直接来一批给 6 道", (await ev("document.querySelectorAll('.dish').length")) === 6);
  ok("结果页解释排序", (await text(".result-sub")).includes("按大众度挑的"));
  ok("结果页有剩余提示", (await text(".foot-note")).includes("道没看过"), await text(".foot-note"));
  await shot("v350-result-light.png");
  await click("[data-go='refresh']");
  ok("刷新后变第 2 批", (await text(".topbar .pill")).includes("第 2 批"));
  let guard = 0;
  while (guard++ < 260) {
    const has = await ev("!!document.querySelector('[data-go=refresh]')");
    if (!has) break;
    await ev("document.querySelector('[data-go=refresh]').click()");
    await sleep(35);
  }
  ok("刷到底给出提示", (await text("#app")).includes("都看过了") && (await text("#app")).includes("从头再看一遍"));
  ok("刷到底不重复出卡", (await ev("document.querySelectorAll('.dish').length")) === 0);
  await click("[data-go='restartBatch']");
  ok("从头再看能重新出卡", (await ev("document.querySelectorAll('.dish').length")) === 6);

  // 今日推荐：回到干净首页再进（返回栈在不同入口下深度不一致）
  await nav("http://127.0.0.1:" + PORT + "/?e2e=daily");
  await click("[data-go='daily']");
  ok("今日推荐两组按钮", (await ev("document.querySelectorAll('[data-daily]').length")) === 2);
  ok("推荐按季节生成组名", (await text("#app")).includes("这个月正当时"));
  await click("[data-daily='hot']");
  ok("一组 4 道", (await ev("document.querySelectorAll('.dish').length")) === 4);
  ok("推荐卡片都有做法可看", (await ev("[...document.querySelectorAll('.dish')].every((x) => x.dataset.id && x.querySelector('.dish-name'))")) === true);
  console.log("  今日推荐：", await ev("[...document.querySelectorAll('.dish .dish-name')].map((x) => x.textContent).join('、')"));
  await shot("v350-daily.png");

  // 暗色模式
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await nav("http://127.0.0.1:" + PORT + "/?e2e=dark");
  const bg = await ev("getComputedStyle(document.body).backgroundColor");
  ok("暗色模式背景变深", /rgb\(2[0-9], 1[0-9], 1[0-9]\)/.test(bg) || /rgb\(1[4-9], 1[0-9], 1[0-9]\)/.test(bg), bg);
  await shot("v350-home-dark.png");
  await click("[data-go='spin']");
  await shot("v350-result-dark.png");
  await send("Emulation.setEmulatedMedia", { features: [] });

  // 断网：Service Worker 必须把界面、菜库、做法都兜住（APK 也靠这条）
  await send("Network.enable");
  let ctrl = false;
  for (let i = 0; i < 25 && !ctrl; i++) {
    await sleep(300);
    ctrl = await ev("!!navigator.serviceWorker.controller");
  }
  ok("Service Worker 已接管页面", ctrl);
  await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await nav("http://127.0.0.1:" + PORT + "/?e2e=offline");
  ok("断网仍能打开首页", (await ev("document.querySelectorAll('.big').length")) === 5);
  await click("[data-go='spin']");
  ok("断网能出推荐", (await ev("document.querySelectorAll('.dish').length")) === 6);
  await ev("document.querySelector('.dish').click()");
  await sleep(700);
  ok("断网能看做法", (await ev("document.querySelectorAll('.steps .step').length")) >= 2);
  await shot("v350-offline-detail.png");
  await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  const bad = results.filter((r) => !r[1]);
  console.log(bad.length ? "FAIL " + bad.length + " / " + results.length : "OK 全部通过（" + results.length + " 项）");
  if (bad.length) process.exitCode = 1;
}

try {
  await main();
} catch (e) {
  console.error("E2E ERROR:", e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch (e) {}
  try { chrome && chrome.kill(); } catch (e) {}
  try { server && server.kill(); } catch (e) {}
}
