self.CIPOLATTI_CHAT_SW_VERSION = "20260821-group-admin-permissions-v1";
self.CIPOLATTI_CHAT_CACHE_PREFIX = "cipolatti-chat-";
self.CIPOLATTI_CHAT_CACHE_NAME = `${self.CIPOLATTI_CHAT_CACHE_PREFIX}${self.CIPOLATTI_CHAT_SW_VERSION}`;
console.info("CIPOLATTI service worker version:", self.CIPOLATTI_CHAT_SW_VERSION);

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(self.CIPOLATTI_CHAT_CACHE_PREFIX) && key !== self.CIPOLATTI_CHAT_CACHE_NAME)
        .map((key) => self.caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CIPOLATTI_SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

function parsePushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    try {
      return { body: event.data.text() };
    } catch {
      return {};
    }
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const data = payload.data || {};
  const title = payload.title || "Chat | Cipolatti";
  const tag = payload.tag || data.messageId || data.conversationId || data.notificationId || "cipolatti-chat";
  const options = {
    body: payload.body || "Você tem uma nova atualização no Chat | Cipolatti.",
    icon: payload.icon || "/chat-cipolatti-icon-v3-192.png",
    badge: payload.badge || "/chat-cipolatti-icon-v3-192.png",
    tag,
    renotify: payload.renotify !== false,
    silent: false,
    timestamp: payload.timestamp || Date.now(),
    vibrate: payload.vibrate || [200, 100, 200],
    requireInteraction: payload.requireInteraction === true,
    data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

function notificationTargetUrl(data = {}) {
  const url = new URL("/", self.location.origin);
  url.searchParams.set("source", "push");
  if (data.conversationId) url.searchParams.set("conversationId", data.conversationId);
  if (data.messageId) url.searchParams.set("messageId", data.messageId);
  if (data.notificationId) url.searchParams.set("notificationId", data.notificationId);
  if (data.groupId || data.isGroup) url.searchParams.set("group", "1");
  return url.pathname + url.search + url.hash;
}

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  const message = { type: "cipolatti-open-push", ...data };
  const targetUrl = notificationTargetUrl(data);
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const focused = clients.find((client) => "focus" in client);
      if (focused) {
        focused.postMessage(message);
        return focused.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
