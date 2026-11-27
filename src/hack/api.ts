import { createPostApi } from "@/api";
import { CodeLanguage } from "@/interfaces/CodeLanguage";

export interface HackRecord {
  id: number;
  targetSubmissionId: number;
  state: string;
  verdict?: string;
  createdAt: string;
  revokedAt?: string;
  recheckFailed?: boolean;
  challengerId?: number;
  canCancel: boolean;
  canDownload: boolean;
  canRevoke: boolean;
  input?: string;
}

export interface HackTarget {
  id: number;
  language: string;
  time: string;
}

export interface Program {
  language: CodeLanguage;
  code: string;
  compileAndRunOptions: Record<string, string>;
}

export interface HackProfile {
  problemId: number;
  enabled: boolean;
  inputLimit: number;
  validator?: Program;
  reference?: Program;
}

export const hackApi = {
  targets: createPostApi<
    { problemId: number; contestId?: number; before?: number },
    { enabled: boolean; inputLimit?: number; targets: HackTarget[] }
  >("hack/targets", false),
  create: createPostApi<{ id: number; input: string }, HackRecord>("hack/create", false),
  mine: createPostApi<{ id?: number; before?: number }, HackRecord[]>("hack/mine", false),
  history: createPostApi<{ id: number; before?: number }, HackRecord[]>("hack/history", false),
  download: createPostApi<
    { id: number; input: boolean; output: boolean },
    { files: { name: string; data: string }[]; remaining?: number; error?: string }
  >("hack/download", false),
  cancel: createPostApi<{ id: number }, { success: boolean }>("hack/cancel", false),
  revoke: createPostApi<{ id: number; reason: string }, { success: boolean }>("hack/revoke", false),
  profile: createPostApi<{ id: number }, HackProfile>("hack/profile", false),
  saveProfile: createPostApi<HackProfile, { success: boolean }>("hack/saveProfile", false)
};
