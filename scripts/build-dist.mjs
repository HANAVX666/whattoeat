import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const SHELL_FILES = ["index.html", "app.js", "style.css", "manifest.webmanifest", "sw.js",
                     "icon-192.png", "icon-512.png", "icon-512-maskable.png"];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

for (const f of SHELL_FILES) cpSync(join(ROOT, f), join(DIST, f));
cpSync(join(ROOT, "data"), join(DIST, "data"), { recursive: true });
writeFileSync(join(DIST, ".nojekyll"), "");

// 内容变了就换 cache 版本号，手机上才会拿到新数据
const hash = createHash("sha256");
for (const f of SHELL_FILES) hash.update(readFileSync(join(ROOT, f)));
for (const f of readdirSync(join(DIST, "data", "dishes")).sort()) {
  hash.update(f);
  hash.update(readFileSync(join(DIST, "data", "dishes", f)));
}
const version = hash.digest("hex").slice(0, 10);
const swPath = join(DIST, "sw.js");
writeFileSync(swPath, readFileSync(swPath, "utf8").replace(/const VERSION = "[^"]*";/, 'const VERSION = "' + version + '";'));
console.log("dist/ 已生成（cache 版本 " + version + "），把 dist 里的文件全部上传即可");
