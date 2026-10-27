import { appState } from "@/appState";
import { getAuthToken } from "@/authToken";

import { notificationApi, PushBinding } from "./api";
import { browserBinding } from "./binding";
import { rememberPushPromptChoice } from "./pushPromptPreference";

export function browserPushSupported(): boolean {
  return (
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    "indexedDB" in window
  );
}

async function registration() {
  return await navigator.serviceWorker.register("/notification-sw.js", { scope: "/" });
}

async function activeRegistration() {
  const registered = await registration();
  if (registered.active) return registered;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("push_error")), 15000);
    const worker = registered.installing || registered.waiting;
    if (!worker) {
      clearTimeout(timeout);
      reject(new Error("push_error"));
      return;
    }
    const changed = () => {
      if (worker.state === "activated") {
        clearTimeout(timeout);
        worker.removeEventListener("statechange", changed);
        resolve();
      } else if (worker.state === "redundant") {
        clearTimeout(timeout);
        worker.removeEventListener("statechange", changed);
        reject(new Error("push_error"));
      }
    };
    worker.addEventListener("statechange", changed);
    changed();
  });
  return registered;
}

function applicationServerKey(key: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (key.length % 4)) % 4));
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

async function clearLocalPush() {
  await browserBinding(null); // Invalidate queued messages before any network call.
  const registered = await navigator.serviceWorker.getRegistration("/notification-sw.js");
  if (!registered || !registered.active?.scriptURL.endsWith("/notification-sw.js")) return;
  const subscription = await registered.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
  const notifications = await registered.getNotifications();
  notifications.forEach(notification => notification.close());
}

export async function disableBrowserPush(): Promise<void> {
  if (!browserPushSupported()) return;
  const userId = appState.currentUser?.id;
  if (userId) rememberPushPromptChoice(userId, "denied");
  const binding = await browserBinding();
  await clearLocalPush();
  if (binding?.userId === appState.currentUser?.id) {
    const result = await notificationApi.disablePush({ id: binding.id });
    if (result.requestError) throw new Error("push_error");
  }
}

function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  // Native toJSON() also includes expirationTime. Send only validated API fields.
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

export async function enableBrowserPush(): Promise<PushBinding> {
  if (!browserPushSupported()) throw new Error("push_unsupported");
  const userId = appState.currentUser?.id;
  const token = appState.token;
  if (!userId || token !== getAuthToken()) throw new Error("push_error");
  rememberPushPromptChoice(userId, "allowed");
  // Request permission directly in the click handler, before awaiting network.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    rememberPushPromptChoice(userId, permission === "denied" ? "denied" : "later");
    throw new Error(permission === "denied" ? "push_denied" : "push_deferred");
  }
  if (token !== getAuthToken() || appState.currentUser?.id !== userId) throw new Error("push_error");
  const previous = await browserBinding();
  if (!previous || previous.userId !== userId) await clearLocalPush();
  const status = await notificationApi.pushStatus();
  if (!status.response?.enabled) throw new Error("push_unconfigured");
  if (getAuthToken() !== token) throw new Error("push_error");
  const registered = await activeRegistration();
  let subscription = await registered.pushManager.getSubscription();
  if (!subscription)
    subscription = await registered.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(status.response.publicKey)
    });
  let result = await notificationApi.bindPush(subscriptionPayload(subscription));
  if (result.requestError) {
    // Recreate subscriptions left by a different account or an old VAPID key.
    await browserBinding(null);
    await subscription.unsubscribe();
    if (getAuthToken() !== token) throw new Error("push_error");
    subscription = await registered.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(status.response.publicKey)
    });
    result = await notificationApi.bindPush(subscriptionPayload(subscription));
  }
  if (!result.response || getAuthToken() !== token || appState.currentUser?.id !== userId) {
    await clearLocalPush();
    throw new Error("push_error");
  }
  await browserBinding(result.response);
  window.dispatchEvent(new Event("nsoj-push-changed"));
  return result.response;
}

export async function reconcileBrowserPush(): Promise<void> {
  if (!browserPushSupported()) return;
  const binding = await browserBinding();
  if (!binding) return;
  const token = appState.token;
  const userId = appState.currentUser?.id;
  if (!userId || binding.userId !== userId || !token || Notification.permission !== "granted") {
    await clearLocalPush();
    return;
  }
  const status = await notificationApi.pushStatus();
  if (getAuthToken() !== token) return;
  const active = status.response?.subscriptions.some(
    item => item.id === binding.id && item.bindingVersion === binding.bindingVersion
  );
  if (status.response && !active) {
    await clearLocalPush();
    window.dispatchEvent(new Event("nsoj-push-changed"));
  }
}

export async function clearPushOnAccountChange(): Promise<void> {
  if (browserPushSupported()) await clearLocalPush();
}
