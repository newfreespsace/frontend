import { createGetApi } from "@/api";

export type RemoteMonitorState =
  | "Healthy"
  | "Syncing"
  | "Idle"
  | "RateLimited"
  | "Error"
  | "Disabled"
  | "Unconfigured"
  | "AuthExpired"
  | "Unknown";
export interface MonitorAccount {
  accountId: number;
  userId: number;
  username: string;
  handle: string;
  lastError: string | null;
  lastErrorAt: string | null;
  nextSyncAt: string | null;
  sourceError: string | null;
  sourceErrorAt: string | null;
  sourceRetryAt: string | null;
}
export interface PlatformMonitor {
  platform: "Codeforces" | "AtCoder";
  state: RemoteMonitorState;
  lastSyncedAt: string | null;
  lastHeartbeatAt: string | null;
  sourceSupport: "PersonalKey" | "Unavailable";
  admin?: {
    boundAccounts: number;
    activeAccounts: number;
    queuedAccounts: number;
    retryingAccounts: number;
    historyAccounts: number;
    pendingSubmissions: number;
    errorAccounts: number;
    sourceErrorAccounts: number;
    oldestQueuedAt: string | null;
    liveWorkers: number;
    tasks: { account: MonitorAccount; phase: "Syncing" | "Collecting" | "Importing"; startedAt: string }[];
    errors: MonitorAccount[];
    errorsTruncated: boolean;
    session?: { configured: boolean; status: string; checkedAt: string | null; error: string | null };
  };
}
export interface RemoteMonitorSnapshot {
  updatedAt: string | null;
  stale: boolean;
  unavailable: boolean;
  platforms: PlatformMonitor[];
  admin?: {
    redis: {
      available: boolean;
      connectedClients: number | null;
      maxClients: number | null;
      rejectedConnections: number | null;
      rejectedDelta: number | null;
      deltaSince: string | null;
      sampledAt: string | null;
    };
  };
}
export const getRemoteMonitor = createGetApi<void, RemoteMonitorSnapshot>("remoteJudge/monitor");
