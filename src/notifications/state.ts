import { observable, runInAction } from "mobx";
import SocketIO from "socket.io-client";
import SocketIOParser from "socket.io-msgpack-parser";

import { appState } from "@/appState";
import { AUTH_TOKEN_STORAGE_KEY, getAuthToken } from "@/authToken";

import { notificationApi } from "./api";
import { clearPushOnAccountChange, reconcileBrowserPush } from "./push";

export const notificationState = observable({ unread: 0, revision: 0 });

export function startNotifications(): () => void {
  const token = appState.token;
  const userId = appState.currentUser?.id;
  const allowed = userId && token && !appState.activeGroupContests.length;
  let stopped = false;
  let updateTimer: number;
  let reconnectTimer: number;
  let socket: ReturnType<typeof SocketIO>;
  let inFlight = false;
  let again = false;
  const refresh = async () => {
    if (stopped || !allowed || token !== getAuthToken()) return;
    if (inFlight) {
      again = true;
      return;
    }
    inFlight = true;
    try {
      const result = await notificationApi.unreadCount();
      if (!stopped && result.response && getAuthToken() === token)
        runInAction(() => {
          notificationState.unread = result.response.count;
          notificationState.revision++;
        });
    } finally {
      inFlight = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  };
  const schedule = () => {
    clearTimeout(updateTimer);
    updateTimer = window.setTimeout(() => {
      void refresh();
    }, 150);
  };
  const focus = () => {
    if (document.visibilityState === "visible") {
      schedule();
      void reconcileBrowserPush().catch(() => undefined);
    }
  };
  const accountChanged = (event: StorageEvent) => {
    if (event.key === AUTH_TOKEN_STORAGE_KEY || event.key === null) {
      socket?.disconnect();
      runInAction(() => {
        notificationState.unread = 0;
      });
      void clearPushOnAccountChange().catch(() => undefined);
      // Session metadata must follow the shared token before another bind.
      if (getAuthToken() !== token) location.reload();
    }
  };
  window.addEventListener("storage", accountChanged);
  document.addEventListener("visibilitychange", focus);
  window.addEventListener("focus", focus);
  if (allowed) {
    socket = SocketIO(window.apiEndpoint + "notifications", {
      path: "/api/socket",
      transports: ["websocket"],
      auth: { token },
      ...{ parser: SocketIOParser },
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000
    });
    socket.on("changed", schedule);
    socket.on("disconnect", reason => {
      if (reason === "io server disconnect" && !stopped)
        reconnectTimer = window.setTimeout(() => {
          if (getAuthToken() === token) socket.connect();
        }, 5000);
    });
    schedule();
  }
  void reconcileBrowserPush().catch(() => undefined);
  return () => {
    stopped = true;
    clearTimeout(updateTimer);
    clearTimeout(reconnectTimer);
    socket?.disconnect();
    window.removeEventListener("storage", accountChanged);
    document.removeEventListener("visibilitychange", focus);
    window.removeEventListener("focus", focus);
    runInAction(() => {
      notificationState.unread = 0;
    });
  };
}
