// 真浏览器里逐步点一遍，每步打印结果（不打包成一个大表达式，好定位）
import { writeFileSync, mkdirSync } from "node:fs";

const PORT = process.env.CDP_PORT || "9223";
const j = await (await fetch("http://127.0.0.1:" + PORT + "/json/list")).json();
const ws = new WebSocket(j.find((t) => t.type === "page").webSocketDebuggerUrl);
let id = 0;
const pend = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
await new Promise((r) => ws.addEventListener("open", r));
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: "http://127.0.0.1:8080/?t=" + Date.now() });
await new Promise((r) => setTimeout(r, 2000));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  const ex = r.result?.exceptionDetails;
  if (ex) return { ERROR: ex.exception?.description || ex.text };
  return r.result?.result?.value;
};
const log = async (name, expression) => {
  const v = await evalJs(expression);
  console.log(name.padEnd(18), JSON.stringify(v));
  return v;
};
const shot = async (file) => {
  const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(file, Buffer.from(s.result.data, "base64"));
};

await log("home", "document.querySelectorAll('.big').length + '|' + document.title");
await evalJs("document.querySelector('.big').click()");
await sleep(400);
await log("quiz", "document.querySelector('.q-title')?.textContent + '| dots=' + document.querySelectorAll('.dot').length");
await shot("C:/Users/LENOVO/Documents/deepseek-harness/default-workspace/whattoeat/.shots/quiz.png");

for (let i = 0; i < 15; i++) {
  const soft = await evalJs("!!document.querySelector('#softcount')");
  if (soft) break;
  await evalJs("[...document.querySelectorAll('.opt:not(.dead)')].pop().click()");
  await sleep(220);
  if (i === 0) await log("after1", "document.querySelector('.q-title')?.textContent");
}
await log("soft", "'chips=' + document.querySelectorAll('.chipbtn').length + ' count=' + document.querySelector('#softcount')?.textContent");
await shot("C:/Users/LENOVO/Documents/deepseek-harness/default-workspace/whattoeat/.shots/soft.png");
await evalJs("window.__screen = document.querySelector('.screen'); document.querySelector('.chipbtn').click()");
await sleep(120);
await log("chip", "({ sel: document.querySelector('.chipbtn').classList.contains('sel'), sameNode: document.querySelector('.screen') === window.__screen, count: document.querySelector('#softcount').textContent })");

await evalJs("document.querySelector('.soft-foot .btn').click()");
await sleep(500);
await log("result", "'cards=' + document.querySelectorAll('.dish').length + ' sticky=' + !!document.querySelector('.sticky .btn.primary')");
await log("overflow", "[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+0.5).length");
await shot("C:/Users/LENOVO/Documents/deepseek-harness/default-workspace/whattoeat/.shots/result.png");

await evalJs("document.querySelector('.dish').click()");
await sleep(500);
await log("detail", "'steps=' + document.querySelectorAll('.step').length + ' bing=' + !!document.querySelector('.photo[href*=bing]') + ' bili=' + !!document.querySelector('.sticky a[href*=bilibili]')");
await shot("C:/Users/LENOVO/Documents/deepseek-harness/default-workspace/whattoeat/.shots/detail.png");
await evalJs("window.__d = document.querySelector('.screen'); document.querySelector('.dislike').click()");
await sleep(120);
await log("dislike", "({ sameNode: document.querySelector('.screen') === window.__d, text: document.querySelector('.dislike').textContent })");

await evalJs("document.querySelector('[data-go=back]').click()");
await sleep(400);
const before = await log("before-refresh", "document.querySelectorAll('.dish').length");
await evalJs("document.querySelector('[data-go=refresh]').click()");
await sleep(500);
await log("after-refresh", "document.querySelectorAll('.dish').length + ' pill=' + document.querySelector('.result-head .pill').textContent");
await log("refreshChanged", "window.__before !== [...document.querySelectorAll('.dish')].map(d=>d.dataset.id).join()");

await send("Page.navigate", { url: "http://127.0.0.1:8080/?t=" + Date.now() });
await sleep(1800);
await evalJs("document.querySelectorAll('.big')[1].click()");
await sleep(500);
await log("pantry", "!!document.querySelector('#pantry') + '|' + document.querySelector('.q-title, h2')?.textContent");
await evalJs("document.querySelector('#pantry').value = '鸡蛋 番茄'; document.querySelector('[data-go=pantryResult]').click()");
await sleep(700);
await log("pantryResult", "document.querySelectorAll('.dish').length");
await shot("C:/Users/LENOVO/Documents/deepseek-harness/default-workspace/whattoeat/.shots/pantry-result.png");

ws.close();
