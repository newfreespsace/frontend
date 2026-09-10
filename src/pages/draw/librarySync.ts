import { v4 as uuid } from "uuid";
import type { useHandleLibrary } from "@excalidraw/excalidraw";
import {
  applyLibraryChanges,
  diffLibraryItems,
  LibraryChange,
  LibraryItems,
  LibraryRecord,
  updateLibraryRecord
} from "./libraryStorage";

type LibraryPersistenceAdapter = Extract<Parameters<typeof useHandleLibrary>[0], { adapter: unknown }>["adapter"];

export interface LibraryRemote {
  get(): Promise<{ libraryItems: LibraryItems }>;
  save(changes: LibraryChange[]): Promise<{ libraryItems: LibraryItems }>;
}

export class AccountLibrarySync {
  private baseline: LibraryItems = [];
  private task: Promise<void> = null;
  private timer: ReturnType<typeof setTimeout>;
  private stopped = false;
  private retryDelay = 1500;
  private unsaved: LibraryRecord["pending"] = [];
  private localTask: Promise<void> = null;

  constructor(
    private userId: number,
    private remote: LibraryRemote,
    private report: (status: string, error?: string) => void
  ) {}

  readonly adapter: LibraryPersistenceAdapter = {
    load: async ({ source }) => {
      if (source === "load") {
        try {
          await this.sync();
        } catch {
          /* Display cached items and retain pending edits when offline. */
        }
      }
      const record = await updateLibraryRecord(this.userId);
      if (source === "save") this.baseline = record.libraryItems;
      return { libraryItems: record.libraryItems };
    },
    save: async ({ libraryItems }) => {
      const changes = diffLibraryItems(this.baseline, libraryItems);
      if (!changes.length) return;
      this.unsaved.push({ operationId: uuid(), changes });
      try {
        await this.flushLocal();
      } catch (error) {
        this.status("素材库未保存", "素材库本地保存失败，请从素材库菜单导出文件备份后重试");
        throw error;
      }
      this.status("素材库已保存到本机，等待同步");
      this.schedule(300);
    }
  };

  private async flushLocal(): Promise<void> {
    if (this.localTask) return this.localTask;
    if (!this.unsaved.length) return;
    const snapshot = [...this.unsaved];
    this.localTask = (async () => {
      try {
        await updateLibraryRecord(this.userId, record => ({
          ...record,
          libraryItems: applyLibraryChanges(
            record.libraryItems,
            snapshot.flatMap(operation => operation.changes)
          ),
          pending: [...record.pending, ...snapshot]
        }));
        const saved = new Set(snapshot.map(operation => operation.operationId));
        this.unsaved = this.unsaved.filter(operation => !saved.has(operation.operationId));
      } finally {
        this.localTask = null;
      }
    })();
    return this.localTask;
  }

  private status(status: string, error = "") {
    if (!this.stopped) this.report(status, error);
  }

  private schedule(delay: number) {
    clearTimeout(this.timer);
    if (!this.stopped)
      this.timer = setTimeout(() => {
        void this.sync().catch(() => {});
      }, delay);
  }

  sync(): Promise<void> {
    if (this.task) return this.task;
    if (this.stopped) return Promise.resolve();
    clearTimeout(this.timer);
    this.status("正在同步账号素材库…");
    this.task = (async () => {
      try {
        do {
          await this.flushLocal();
          const snapshot = await updateLibraryRecord(this.userId);
          if (this.stopped) return;
          // Coalesce offline edits, including add-then-delete, so an oversized item can be removed before retrying.
          const changes = [
            ...new Map(
              snapshot.pending.flatMap(operation => operation.changes).map(change => [change.id, change])
            ).values()
          ];
          const result = snapshot.pending.length ? await this.remote.save(changes) : await this.remote.get();
          const acknowledged = new Set(snapshot.pending.map(operation => operation.operationId));
          const latest = await updateLibraryRecord(this.userId, record => {
            const pending = record.pending.filter(operation => !acknowledged.has(operation.operationId));
            return {
              ...record,
              pending,
              libraryItems: applyLibraryChanges(
                result.libraryItems,
                pending.flatMap(operation => operation.changes)
              )
            };
          });
          if (!latest.pending.length && !this.unsaved.length) break;
        } while (!this.stopped);
        this.retryDelay = 1500;
        this.status("素材库已同步到账号");
      } catch (error) {
        this.status("素材库未同步", error.message || "素材库同步失败，本机素材已保留，请重试");
        if (!error.status || error.status === 429 || error.status >= 500) {
          this.schedule(this.retryDelay);
          this.retryDelay = Math.min(this.retryDelay * 2, 30000);
        }
        throw error;
      } finally {
        this.task = null;
      }
    })();
    return this.task;
  }

  start() {
    this.stopped = false;
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
}
