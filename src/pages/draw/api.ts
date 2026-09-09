import axios from "axios";
import { appState } from "@/appState";

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

async function request<T>(action: string, body = {}): Promise<T> {
  let result;
  try {
    result = await axios.post(`${window.apiEndpoint}api/whiteboard/${action}`, body, {
      headers: { Authorization: `Bearer ${appState.token}` },
      timeout: 30000,
      validateStatus: () => true
    });
  } catch {
    throw new BoardError(0, "无法连接云端，请检查网络后点击“保存到云端”重试");
  }
  if (result.status >= 200 && result.status < 300) return result.data;
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
