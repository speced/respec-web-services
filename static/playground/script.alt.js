// @ts-check
const form = document.querySelector("form");
const [respecConfig, body] = document.querySelectorAll("textarea");
const iframe = document.querySelector("iframe");

if (navigator.serviceWorker) {
  navigator.serviceWorker
    .register("./sw.js", { scope: "/playground/" })
    .then(() => {
      form.addEventListener("change", update);
      // update();
    });
} else {
  const msg = "Error: ServiceWorker support is required for this app to work.";
  document.querySelector("output").textContent = msg;
}

async function update() {
  const cache = await caches.open("playground");
  await cache.put(
    new Request("respecConfig.js"),
    new Response(respecConfig.value, {
      headers: { "Content-Type": "application/javascript" },
    }),
  );
  await cache.put(
    new Request("body.html"),
    new Response(body.value, { headers: { "Content-Type": "text/html" } }),
  );
  iframe.src = iframe.src;
}
