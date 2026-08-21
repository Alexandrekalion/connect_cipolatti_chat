self.CIPOLATTI_CHAT_SW_VERSION = "20260821-web-push-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
  const options = {
    body: payload.body || "Você tem uma nova atualização no Chat | Cipolatti.",
    icon: payload.icon || "/chat-cipolatti-icon-v3-192.png",
    badge: payload.badge || "/chat-cipolatti-icon-v3-192.png",
    tag: payload.tag || data.conversationId || data.notificationId || "cipolatti-chat",
    renotify: payload.renotify !== false,
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
