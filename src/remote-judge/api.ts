import { createPostApi } from "@/api";

export type SubmissionMethod = "Local" | "Codeforces" | "AtCoder";
export interface RemoteProblem {
  contestId: string;
  taskId: string;
  url: string;
  fullScore?: number;
}
export interface RemoteInfo {
  platform: SubmissionMethod;
  handle: string;
  id: string;
  url: string;
  language: string;
  verdict: string;
  points?: number;
  historical: boolean;
}
export interface RemoteContext {
  problemId?: number;
  contestId?: number;
  contestProblemIndex?: number;
}
export interface RemoteAccount {
  platform: SubmissionMethod;
  handle: string;
  lastSyncedAt?: string;
  lastError?: string;
  importingHistory?: boolean;
}
interface AccountsResponse {
  error?: string;
  enabled: boolean;
  accounts: RemoteAccount[];
}
export interface RemoteStatus {
  enabled: boolean;
  bound: boolean;
  handle?: string;
  lastSyncedAt?: string;
  lastError?: string;
  latest?: { id: number; status: string; submittedAt: string; remote?: RemoteInfo };
}

export const remoteApi = {
  accounts: createPostApi<Record<string, never>, AccountsResponse>("remoteJudge/accounts", false),
  beginBinding: createPostApi<{ platform: SubmissionMethod; handle: string }, { error?: string; code: string }>(
    "remoteJudge/beginBinding",
    false
  ),
  verifyBinding: createPostApi<{ platform: SubmissionMethod }, AccountsResponse>("remoteJudge/verifyBinding", false),
  unbind: createPostApi<{ platform: SubmissionMethod }, AccountsResponse>("remoteJudge/unbind", false),
  activate: createPostApi<RemoteContext, AccountsResponse>("remoteJudge/activate", false),
  status: createPostApi<RemoteContext, RemoteStatus>("remoteJudge/status", false),
  setMethod: createPostApi<
    {
      problemId: number;
      submissionMethod: SubmissionMethod;
      remoteUrl?: string;
      remoteFullScore?: number;
      submittable?: boolean;
    },
    { error?: string }
  >("remoteJudge/setSubmissionMethod", false)
};

declare global {
  namespace ApiTypes {
    interface ProblemMetaDto {
      submissionMethod?: SubmissionMethod;
      remoteProblem?: RemoteProblem;
    }
    interface CreateProblemRequestDto {
      submissionMethod?: SubmissionMethod;
      remoteUrl?: string;
      remoteFullScore?: number;
    }
    interface SubmissionMetaDto {
      remote?: RemoteInfo;
    }
    interface SubmissionBasicMetaDto {
      remote?: RemoteInfo;
    }
  }
}

export function isRemoteProblem(meta: ApiTypes.ProblemMetaDto): boolean {
  return !!meta.submissionMethod && meta.submissionMethod !== "Local";
}
