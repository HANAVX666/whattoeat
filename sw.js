const VERSION = "v323-why";
const CACHE = "eat-" + VERSION;
const IMG_CACHE = "eat-img-v1";
const SHELL = [
  "./", "./index.html", "./app.js", "./style.css",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

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
            if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
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
