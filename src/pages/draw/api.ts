import axios from "axios";
import { appState } from "@/appState";
import type { LibraryChange, LibraryItems } from "./libraryStorage";

export interface BoardMeta {
  id: string;
  title: string;
  version: number;
  updatedAt: string;
}
export interface Board extends BoardMeta {
  scene: string;
}

export class BoardError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(action: string, body = {}, token = appState.token): Promise<T> {
  let result;
  try {
    result = await axios.post(`${window.apiEndpoint}api/whiteboard/${action}`, body, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
      validateStatus: () => true
    });
  } catch {
    throw new BoardError(
      0,
      action.startsWith("library/")
        ? "素材库无法连接云端，本机数据已保留，请检查网络后重试"
        : "无法连接云端，请检查网络后点击“保存到云端”重试"
    );
  }
  if (result.status >= 200 && result.status < 300) return result.data;
  if (action.startsWith("library/")) {
    const messages: Record<number, string> = {
      401: "登录已过期，素材库尚未同步，请重新登录",
      403: "当前账号或比赛状态不允许访问素材库",
      409: "素材库正在其他设备上更新，请重试",
      413: "素材库不能超过 10 MB，请减少素材后重试"
    };
    throw new BoardError(result.status, messages[result.status] || "素材库同步失败，本机数据已保留，请重试");
  }
  const messages: Record<number, string> = {
    401: "登录已过期，请保留本地草稿并重新登录",
    403: "当前账号或比赛状态不允许访问画板",
    404: "画板不存在或无权访问",
    409: "云端版本已变化，已暂停自动上传。请另存副本，或从“我的画板”重新打开云端版本",
    413: "画板不能超过 10 MB，请减少图片大小后重试",
    429: "保存过于频繁，请稍后重试"
  };
  throw new BoardError(result.status, messages[result.status] || "云端保存失败，请稍后重试");
}

export const boardsApi = {
  list: () => request<BoardMeta[]>("list"),
  get: (id: string) => request<Board>("get", { id }),
  save: (board: Pick<Board, "id" | "title" | "version" | "scene">) => request<BoardMeta>("save", board),
  delete: (id: string, version: number) => request<void>("delete", { id, version })
};

export function createLibraryApi(userId: number) {
  // Capture the credential as well as the owner. An old queued save must never use a new account's token.
  const token = appState.token;
  const call = (action: string, body = {}) => {
    if (appState.currentUser?.id !== userId || appState.token !== token)
      return Promise.reject(new BoardError(401, "账号已切换，请重新打开画板后同步素材库"));
    return request<{ libraryItems: LibraryItems }>(`library/${action}`, body, token);
  };
  return {
    get: () => call("get"),
    save: (changes: LibraryChange[]) => call("save", { changes: JSON.stringify(changes) })
  };
}
