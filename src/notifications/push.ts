import { appState } from "@/appState";
import { getAuthToken } from "@/authToken";

import { notificationApi, PushBinding } from "./api";
import { browserBinding } from "./binding";
import { rememberPushPromptChoice } from "./pushPromptPreference";

export function browserPushErrorKey(failure: unknown): string {
  const key = (failure as Error)?.message;
  return [
    "push_unsupported",
    "push_denied",
    "push_unconfigured",
    "push_deferred",
    "push_permission_timeout",
    "push_worker_timeout",
    "push_subscription_timeout",
    "push_subscription_error",
    "push_network_error",
    "push_server_timeout"
  ].includes(key)
    ? key
    : "push_error";
}

async function pushStep<T>(operation: Promise<T>, timeoutKey: string, timeoutMs = 15000): Promise<T> {
  let timeout: number;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error(timeoutKey)), timeoutMs);
      })
    ]);
  } finally {
    window.clearTimeout(timeout);
  }
}

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
  const registered = await pushStep(registration(), "push_worker_timeout");
  if (registered.active) return registered;
  await new Promise<void>((resolve, reject) => {
    const worker = registered.installing || registered.waiting;
    if (!worker) {
      reject(new Error("push_error"));
      return;
    }
    const timeout = window.setTimeout(() => {
      worker.removeEventListener("statechange", changed);
      reject(new Error("push_worker_timeout"));
    }, 15000);
    const changed = () => {
      if (worker.state === "activated") {
        window.clearTimeout(timeout);
        worker.removeEventListener("statechange", changed);
        resolve();
      } else if (worker.state === "redundant") {
        window.clearTimeout(timeout);
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

async function createSubscription(registered: ServiceWorkerRegistration, publicKey: string) {
  try {
    return await pushStep(
      registered.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(publicKey)
      }),
      "push_subscription_timeout",
      30000
    );
  } catch (failure) {
    if ((failure as Error)?.message === "push_subscription_timeout") throw failure;
    // Report only the error name, never subscription URLs, keys or provider bodies.
    const name = (failure as Error)?.name || "Error";
    console.warn("[BrowserPush] subscription failed", /^[a-z]+Error$/i.test(name) ? name : "Error");
    if (name === "NetworkError") throw new Error("push_network_error");
    if (name === "NotAllowedError") throw new Error("push_denied");
    throw new Error("push_subscription_error");
  }
}

async function clearLocalPush() {
  await browserBinding(null); // Invalidate queued messages before any network call.
  const registered = await pushStep(
    navigator.serviceWorker.getRegistration("/notification-sw.js"),
    "push_worker_timeout"
  );
  if (!registered || !registered.active?.scriptURL.endsWith("/notification-sw.js")) return;
  const subscription = await pushStep(registered.pushManager.getSubscription(), "push_subscription_timeout");
  if (subscription) await pushStep(subscription.unsubscribe(), "push_subscription_timeout");
  const notifications = await pushStep(registered.getNotifications(), "push_worker_timeout");
  notifications.forEach(notification => notification.close());
}

export async function disableBrowserPush(): Promise<void> {
  if (!browserPushSupported()) return;
  const userId = appState.currentUser?.id;
  if (userId) rememberPushPromptChoice(userId, "denied");
  const binding = await browserBinding();
  await clearLocalPush();
  if (binding?.userId === appState.currentUser?.id) {
    const result = await pushStep(notificationApi.disablePush({ id: binding.id }), "push_server_timeout");
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
  if (navigator.onLine === false) throw new Error("push_network_error");
  rememberPushPromptChoice(userId, "allowed");
  // Request permission directly in the click handler, before awaiting network.
  const permission = await pushStep(Notification.requestPermission(), "push_permission_timeout", 60000);
  if (permission !== "granted") {
    rememberPushPromptChoice(userId, permission === "denied" ? "denied" : "later");
    throw new Error(permission === "denied" ? "push_denied" : "push_deferred");
  }
  if (token !== getAuthToken() || appState.currentUser?.id !== userId) throw new Error("push_error");
  const previous = await browserBinding();
  if (!previous || previous.userId !== userId) await clearLocalPush();
  const status = await pushStep(notificationApi.pushStatus(), "push_server_timeout");
  if (status.requestError || !status.response) throw new Error("push_error");
  if (!status.response?.enabled) throw new Error("push_unconfigured");
  if (getAuthToken() !== token) throw new Error("push_error");
  const registered = await activeRegistration();
  let subscription = await pushStep(registered.pushManager.getSubscription(), "push_subscription_timeout");
  if (!subscription) subscription = await createSubscription(registered, status.response.publicKey);
  if (getAuthToken() !== token || appState.currentUser?.id !== userId) throw new Error("push_error");
  let result = await pushStep(notificationApi.bindPush(subscriptionPayload(subscription)), "push_server_timeout");
  if (result.requestError) {
    // Recreate subscriptions left by a different account or an old VAPID key.
    await browserBinding(null);
    await pushStep(subscription.unsubscribe(), "push_subscription_timeout");
    if (getAuthToken() !== token || appState.currentUser?.id !== userId) throw new Error("push_error");
    subscription = await createSubscription(registered, status.response.publicKey);
    if (getAuthToken() !== token || appState.currentUser?.id !== userId) throw new Error("push_error");
    result = await pushStep(notificationApi.bindPush(subscriptionPayload(subscription)), "push_server_timeout");
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
