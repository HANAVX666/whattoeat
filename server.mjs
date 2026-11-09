import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const root = fileURLToPath(new URL("./", import.meta.url));
const port = Number(process.env.PORT || 8080);
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8", ".png":"image/png", ".svg":"image/svg+xml" };

createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = normalize(join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const st = statSync(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404, { "content-type":"text/plain; charset=utf-8" }).end("404"); }
}).listen(port, "0.0.0.0", () => {
  const addrs = [];
  for (const list of Object.values(networkInterfaces())) for (const a of list || [])
    if (a.family === "IPv4" && !a.internal) addrs.push(a.address);
  console.log("本机   http://localhost:" + port);
  for (const a of addrs) console.log("手机   http://" + a + ":" + port);
});
