/// <reference lib="webworker" />
const sw = /** @type {ServiceWorkerGlobalScope} */ (self);

sw.addEventListener("fetch", ev => {
  const { pathname: p } = new URL(ev.request.url);
  if (p === "/playground/respecConfig.js" || p === "/playground/body.html") {
    const cached = caches
      .open("playground")
      .then(cache => cache.match(ev.request));
    ev.respondWith(cached);
  }
});
