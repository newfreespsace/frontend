export interface Draft {
  localId: string;
  userId: number;
  id: string;
  title: string;
  version: number;
  scene: string;
  dirty: boolean;
  savedAt: number;
}

let database: Promise<IDBDatabase>;
function openDatabase(): Promise<IDBDatabase> {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("nsoj-whiteboards", 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("drafts", { keyPath: "localId" });
        store.createIndex("userId", "userId");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        database = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        database = undefined;
        reject(new Error("请关闭其他旧版本画板页面后重试"));
      };
    });
  return database;
}

export async function listDrafts(userId: number): Promise<Draft[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("drafts").objectStore("drafts").index("userId").getAll(userId);
    request.onsuccess = () => resolve((request.result as Draft[]).sort((a, b) => b.savedAt - a.savedAt));
    request.onerror = () => reject(request.error);
  });
}

export async function putDraft(draft: Draft): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", "readwrite");
    transaction.objectStore("drafts").put(draft);
    // A successful request alone does not guarantee the transaction committed.
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error("本地存储失败"));
  });
}

export async function deleteDraft(localId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", "readwrite");
    transaction.objectStore("drafts").delete(localId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error("删除本地草稿失败"));
  });
}
