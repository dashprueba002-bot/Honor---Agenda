// Service worker de Honor · Mi gestión (JF26)
// Recibe los avisos enviados por el servidor y los muestra en la barra del celular,
// aunque la app esté cerrada.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { cuerpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Honor · Tienes un recordatorio pendiente", {
    body: d.cuerpo || "Revisa tu agenda de Honor. Tienes un recordatorio pendiente.",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: "aviso-" + (d.id || Date.now()),
    renotify: true,
    requireInteraction: true,
    vibrate: [500, 250, 500, 250, 500],
    data: { id: d.id || "" }
  }));
});

// Al tocar la notificación, abre (o trae al frente) la agenda y muestra la alerta con voz.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const id = (e.notification.data && e.notification.data.id) || "";
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const v of ventanas) {
      if ("focus" in v) { v.postMessage({ tipo: "abrir-aviso", id }); return v.focus(); }
    }
    return self.clients.openWindow("./?aviso=" + encodeURIComponent(id));
  })());
});
