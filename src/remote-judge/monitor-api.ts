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
  lastErrorDetails?: RemoteErrorDetails;
}
export interface RemoteErrorDetails {
  stage?: string;
  reason?: string;
  contestId?: string;
  page?: number;
  submissionId?: string;
  httpStatus?: number;
}
export interface MonitorError {
  id: string;
  account: Pick<MonitorAccount, "accountId" | "userId" | "username" | "handle">;
  kind: "Result" | "Source";
  error: string;
  at: string;
  retryAt: string | null;
  details: RemoteErrorDetails;
}
export interface PlatformMonitor {
  platform: "Codeforces" | "AtCoder";
  state: RemoteMonitorState;
  lastSyncedAt: string | null;
  lastHeartbeatAt: string | null;
  sourceSupport: "PersonalKey" | "PersonalSession" | "Unavailable";
  admin?: {
    boundAccounts: number;
    activeAccounts: number;
    queuedAccounts: number;
    retryingAccounts: number;
    historyAccounts: number;
    pendingSubmissions: number;
    sourcePendingSubmissions: number;
    sourceFailedSubmissions: number;
    errorAccounts: number;
    sourceErrorAccounts: number;
    oldestQueuedAt: string | null;
    liveWorkers: number;
    tasks: { account: MonitorAccount; phase: "Syncing" | "Collecting" | "Importing"; startedAt: string }[];
    errors: MonitorAccount[];
    errorsTruncated: boolean;
    recentErrors?: MonitorError[];
    errorHistoryAvailable?: boolean;
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
