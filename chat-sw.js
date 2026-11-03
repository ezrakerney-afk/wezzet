/* Wezzet chat service worker: shows push notifications. Pushes carry no data; we fetch what's new. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => e.waitUntil((async () => {
  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  let notes = [];
  try { notes = (await (await fetch("/api/chat/notes", { credentials: "include", cache: "no-store" })).json()).notes || []; } catch {}
  // The open, focused chat page already alerts in-page.
  if (wins.some((w) => w.focused && new URL(w.url).pathname.startsWith("/chat"))) return;
  if (!notes.length) return self.registration.showNotification("Wezzet Chat", { body: "You have something new.", tag: "wz-chat", icon: "/assets/icon-192.png" });
  for (const n of notes.slice(0, 3).reverse()) {
    await self.registration.showNotification(n.title, { body: n.body, tag: n.room || n.kind, renotify: true, icon: "/assets/icon-192.png", data: { url: "/chat" + (n.room ? "#" + n.room : "") } });
  }
})()));
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/chat";
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const w = wins.find((c) => new URL(c.url).pathname.startsWith("/chat"));
    if (w) { await w.focus(); return w.navigate(url).catch(() => {}); }
    return self.clients.openWindow(url);
  })());
});
