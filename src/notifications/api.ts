import { createGetApi, createPostApi } from "@/api";

export interface NotificationItem {
  id: string;
  body: string;
  targetPath: string;
  createdAt: string;
  readAt: string | null;
}
export interface NotificationHistoryItem extends Omit<NotificationItem, "readAt"> {
  senderId: number;
  audience: string;
  audienceLabel: string;
  recipientCount: number;
  push: boolean;
  revokedAt: string | null;
  revokedById: number | null;
}
export interface PushBinding {
  id: string;
  userId: number;
  bindingVersion: string;
}
export interface PushStatus {
  enabled: boolean;
  publicKey: string;
  subscriptions: (Omit<PushBinding, "userId"> & { sessionId: number })[];
}
export interface SendNotification {
  body: string;
  targetPath: string;
  audience: "all" | "users" | "group";
  usernames: string[];
  groupIds?: number[];
  groupId?: number;
  push: boolean;
  requestId: string;
}
export const notificationApi = {
  unreadCount: createGetApi<void, { count: number }>("notification/unreadCount"),
  query: createPostApi<
    { skip?: number; take?: number; unreadOnly?: boolean },
    { items: NotificationItem[]; total: number }
  >("notification/query", false),
  get: createPostApi<{ id: string }, { item: NotificationItem }>("notification/get", false),
  read: createPostApi<{ id?: string; all?: boolean }, { count: number }>("notification/read", false),
  deleteReceived: createPostApi<{ id: string }, { count: number }>("notification/delete", false),
  revoke: createPostApi<{ id: string }, { success: boolean }>("notification/revoke", false),
  send: createPostApi<SendNotification, { id: string; recipientCount: number }>("notification/send", false),
  history: createPostApi<{ skip?: number; take?: number }, { items: NotificationHistoryItem[]; total: number }>(
    "notification/history",
    false
  ),
  pushStatus: createGetApi<void, PushStatus>("notification/pushStatus"),
  bindPush: createPostApi<{ endpoint: string; keys: { p256dh: string; auth: string } }, PushBinding>(
    "notification/bindPush",
    false
  ),
  disablePush: createPostApi<{ id: string }, { success: boolean }>("notification/disablePush", false)
};
