import { createGetApi, createPostApi } from "@/api";

export interface RemoteJudgeSettings {
  atcoderSessionConfigured: boolean;
  atcoderSessionSource: "site" | "environment" | "none";
  atcoderSessionStatus?: "missing" | "unchecked" | "valid" | "expired" | "unavailable";
  atcoderSessionLastCheckedAt?: string;
  atcoderSessionError?: string;
  updatedAt?: string;
}

interface RemoteJudgeSettingsResponse {
  error?: "PERMISSION_DENIED";
  settings?: RemoteJudgeSettings;
}

export const remoteAdminApi = {
  getSettings: createGetApi<void, RemoteJudgeSettingsResponse>("site-setting/remote-judge"),
  updateSettings: createPostApi<
    { atcoderSession?: string; clearAtcoderSession?: boolean },
    RemoteJudgeSettingsResponse
  >("site-setting/remote-judge", false)
};
