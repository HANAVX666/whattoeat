// 用 CDP 打开页面、执行测量、必要时截图（不用 puppeteer）
import { writeFileSync } from "node:fs";

const [url, outPng, ...exprs] = process.argv.slice(2);
const j = await (await fetch("http://127.0.0.1:" + (process.env.CDP_PORT || "9222") + "/json/list")).json();
const target = j.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pend = new Map();
const events = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  else if (m.method) events.push(m.method);
});
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
await new Promise((r) => ws.addEventListener("open", r));
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url });
await new Promise((r) => setTimeout(r, 1200));
await send("Runtime.evaluate", { expression: "document.fonts.ready" });
for (const e of exprs) {
  const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  console.log(JSON.stringify(r.result?.result?.value ?? r.result, null, 1));
}
if (outPng) {
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(outPng, Buffer.from(shot.result.data, "base64"));
  console.log("shot -> " + outPng);
}
ws.close();
