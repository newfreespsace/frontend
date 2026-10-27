/* Notification worker intentionally has no fetch handler or offline page cache. */
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

function readBinding() {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open("nsoj-notifications", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("settings");
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const tx = db.transaction("settings", "readonly");
      const request = tx.objectStore("settings").get("binding");
      let value;
      request.onsuccess = () => {
        value = request.result;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(value);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

self.addEventListener("push", event => {
  event.waitUntil(
    (async () => {
      let payload;
      try {
        payload = event.data && event.data.json();
      } catch {
        return;
      }
      if (!payload || typeof payload.notificationId !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.notificationId))
        return;
      const binding = await readBinding();
      // Dropped bindings and old account/session generations cannot display pushes.
      if (!binding || binding.userId !== payload.userId || binding.bindingVersion !== payload.bindingVersion) return;
      const language = self.navigator.language || "en";
      const body = language.startsWith("zh")
        ? "你有一条新通知，请登录查看。"
        : language.startsWith("ja")
        ? "新しい通知があります。ログインして確認してください。"
        : "You have a new notification. Sign in to view it.";
      await self.registration.showNotification("NSOJ", {
        body,
        tag: "nsoj-" + payload.notificationId,
        data: { notificationId: payload.notificationId, userId: payload.userId, bindingVersion: payload.bindingVersion }
      });
    })()
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const binding = await readBinding();
      const data = event.notification.data || {};
      if (!binding || binding.userId !== data.userId || binding.bindingVersion !== data.bindingVersion) return;
      const target = new URL("/notifications", self.location.origin);
      target.searchParams.set("open", data.notificationId);
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find(client => new URL(client.url).origin === target.origin);
      if (existing) {
        await existing.navigate(target.href);
        await existing.focus();
      } else await self.clients.openWindow(target.href);
    })()
  );
});
