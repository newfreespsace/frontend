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
export interface RemoteTaskProblem {
  problemId: number;
  displayId: number | null;
  title: string;
  remoteKey: string;
  scope: "Round" | "Buffer" | "Watch";
  state: "Watching" | "Collecting" | "Queued" | "Importing" | "Succeeded" | "Skipped" | "Failed";
  records: number | null;
  processed: number;
  synchronized: number;
}
export interface FinishedRemoteTask {
  id: string;
  accountId: number;
  account: MonitorAccount | null;
  phase: "Syncing" | "Collecting" | "Importing";
  state: "Succeeded" | "Failed" | "Skipped";
  continuation: "None" | "More" | "Pending" | "Polling" | "Retry" | "Paused" | "Inactive";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  processed: number;
  nextSyncAt: string | null;
  error: string | null;
  sourceError: string | null;
  problems: RemoteTaskProblem[];
  problemsTruncated: boolean;
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
    tasks: {
      account: MonitorAccount;
      phase: "Syncing" | "Collecting" | "Importing";
      startedAt: string;
      problems: RemoteTaskProblem[];
      problemsTruncated: boolean;
    }[];
    scheduledTasks: {
      account: MonitorAccount;
      phase: "Syncing" | "Collecting" | "Importing";
      state: "Queued" | "Scheduled" | "Retrying" | "Paused";
      scheduledAt: string | null;
      problems: RemoteTaskProblem[];
      problemsTruncated: boolean;
    }[];
    scheduledTaskTotal: number;
    scheduledTasksTruncated: boolean;
    history: FinishedRemoteTask[];
    historyAvailable: boolean;
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
