const VERSION = "v350-cook";
const CACHE = "eat-" + VERSION;
const IMG_CACHE = "eat-img-v1";
const SHELL = [
  "./", "./index.html", "./app.js", "./style.css",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
  "./data/lite.json", "./data/photos.json", "./data/thumbs.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    // 做法按批次拆开了，装的时候一次缓存齐，断网也能看步骤
    try {
      const idx = await (await fetch("./data/index.json")).json();
      const files = [...new Set((idx.files || []).map((b) => "./data/steps/" + b))];
      // 逐个加：某个批次缺了也不至于整个安装失败
      for (const f of files) await c.add(f).catch(() => {});
    } catch (err) {}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 菜图缓存不设上限会越攒越多，手机配额吃紧时整站缓存都可能被清掉
const IMG_MAX = 160;
async function trimImages(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length <= IMG_MAX) return;
    for (const k of keys.slice(0, keys.length - IMG_MAX)) await cache.delete(k);
  } catch (e) {}
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 菜图（百度图片）走独立的缓存：第一次下载，之后直接命中本地
  if (url.origin !== self.location.origin) {
    if (/(^|\.)baidu\.com$/.test(url.hostname)) {
      e.respondWith(
        caches.open(IMG_CACHE)
          .then(async (cache) => {
            const hit = await cache.match(req);
            if (hit) return hit;
            const res = await fetch(req);
            if (res && (res.ok || res.type === "opaque")) {
              cache.put(req, res.clone()).catch(() => {});
              trimImages(cache);
            }
            return res;
          })
          .catch(() => fetch(req))
      );
    }
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const fromNet = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) {
        e.waitUntil(fromNet);
        return cached;
      }
      const res = await fromNet;
      if (res) return res;
      return (await cache.match("./index.html")) || Response.error();
    })
  );
});
