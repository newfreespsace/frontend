import { createGetApi } from "@/api";

export interface ResourcePoint {
  at: number;
  cpuPercent: number | null;
  memoryPercent: number | null;
}
export interface ServerMonitorSnapshot {
  unavailable: boolean;
  bucketSeconds: number;
  servers: {
    id: string;
    latest: ResourcePoint & { memoryUsedBytes: number; memoryTotalBytes: number };
    points: ResourcePoint[];
  }[];
}
export const getServerMonitor = createGetApi<{ hours: number }, ServerMonitorSnapshot>("judgeClient/serverMonitor");
