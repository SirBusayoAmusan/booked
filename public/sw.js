// Booked service worker: enables install, shows push notifications.
// It deliberately does not cache app pages, so owners never see stale data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Booked", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Booked", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/home" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/home";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
