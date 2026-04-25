/*
 * RVerse Payroll emergency service-worker remover.
 * This file intentionally does not cache or intercept requests.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));

        const clientsList = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true
        });

        await self.registration.unregister();

        for (const client of clientsList) {
          client.navigate(client.url);
        }
      } catch (error) {
        await self.registration.unregister();
      }
    })()
  );
});
