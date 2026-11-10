import { writeFileSync } from "node:fs";
const PORT = process.env.CDP_PORT || "9223";
const j = await (await fetch("http://127.0.0.1:" + PORT + "/json/list")).json();
const ws = new WebSocket(j.find((t) => t.type === "page").webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
await new Promise((r) => ws.addEventListener("open", r));
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.result?.exceptionDetails) return { ERROR: r.result.exceptionDetails.exception?.description };
  return r.result?.result?.value;
};
const log = async (name, expression) => { const v = await ev(expression); console.log(name.padEnd(16), JSON.stringify(v)); return v; };
const shot = async (f) => { const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(f, Buffer.from(s.result.data, "base64")); };
const go = async (u) => { await send("Page.navigate", { url: u }); await sleep(1500); };

await go("http://127.0.0.1:8080/?t=feat1");
await ev("localStorage.clear()");
await go("http://127.0.0.1:8080/?t=feat2");
await log("home", "document.querySelectorAll('.big').length + '|' + !!document.querySelector('.home-link')");
await ev("document.querySelectorAll('.big')[2].click()"); await sleep(500);
await log("result", "document.querySelectorAll('.dish').length");
const dishId = await ev("document.querySelector('.dish').dataset.id");
await ev("document.querySelector('.star').click()"); await sleep(200);
await log("star", "document.querySelector('.star').className + '|' + document.querySelector('.star').textContent");
console.log("dishId", dishId);

await go("http://127.0.0.1:8080/?t=feat3");
await log("home-link", "document.querySelector('.home-link')?.textContent");
await ev("document.querySelector('.home-link').click()"); await sleep(400);
await log("saved", "document.querySelectorAll('.dish').length + '|' + (document.querySelector('.topbar .pill')||{}).textContent");
await shot("C:/Users/LENOVO/Documents/deepseek-harness/default-workspace/whattoeat/.shots/saved.png");

await ev("document.querySelector('.dish').click()"); await sleep(500);
await log("detail", "!!document.querySelector('[data-share]') + '|' + !!document.querySelector('[data-eat]') + '|' + document.querySelector('.actions .btn').textContent");
await ev("document.querySelector('[data-eat]').click()"); await sleep(150);
await log("eaten", "document.querySelector('[data-eat]').textContent + '|' + !!JSON.parse(localStorage.getItem('eaten')||'[]').length");
await shot("C:/Users/LENOVO/Documents/deepseek-harness/default-workspace/whattoeat/.shots/detail-actions.png");

await go("http://127.0.0.1:8080/?t=feat4");
await log("recent", "document.querySelector('.home-strip .chipbtn')?.textContent");
await go("http://127.0.0.1:8080/#" + dishId);
await log("deeplink", "document.querySelector('.screen h1')?.textContent");
await log("sw", "!!navigator.serviceWorker");

// 吃过之后不该再被优先推荐
await go("http://127.0.0.1:8080/?t=feat5");
await ev("document.querySelectorAll('.big')[2].click()"); await sleep(500);
const ids = await ev("[...document.querySelectorAll('.dish')].map(d=>d.dataset.id)");
console.log("afterEat", "cards=" + ids.length, "eatenStillShown=" + ids.includes(dishId));
ws.close();
