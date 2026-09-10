import type { ComponentProps } from "react";
import type { Excalidraw } from "@excalidraw/excalidraw";

export type LibraryItems = Parameters<NonNullable<ComponentProps<typeof Excalidraw>["onLibraryChange"]>>[0];

export interface LibraryChange {
  id: string;
  item?: LibraryItems[number];
}
export interface LibraryRecord {
  userId: number;
  libraryItems: LibraryItems;
  pending: { operationId: string; changes: LibraryChange[] }[];
}

export function applyLibraryChanges(items: LibraryItems, changes: LibraryChange[]): LibraryItems {
  const merged = new Map(items.map(item => [item.id, item]));
  for (const change of changes) {
    if (change.item) merged.set(change.id, change.item);
    else merged.delete(change.id);
  }
  return [...merged.values()];
}

export function diffLibraryItems(previous: LibraryItems, next: LibraryItems): LibraryChange[] {
  const before = new Map(previous.map(item => [item.id, item]));
  const after = new Set(next.map(item => item.id));
  return [
    ...previous.filter(item => !after.has(item.id)).map(item => ({ id: item.id })),
    ...next
      .filter(item => JSON.stringify(before.get(item.id)) !== JSON.stringify(item))
      .map(item => ({ id: item.id, item }))
  ];
}

// Separate from scene drafts: a single account library is shared by every board and tab.
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("nsoj-whiteboard-libraries", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("libraries", { keyPath: "userId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateLibraryRecord(
  userId: number,
  update?: (record: LibraryRecord) => LibraryRecord
): Promise<LibraryRecord> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("libraries", update ? "readwrite" : "readonly");
    const store = transaction.objectStore("libraries");
    const request = store.get(userId);
    let result: LibraryRecord;
    request.onsuccess = () => {
      result = request.result || { userId, libraryItems: [], pending: [] };
      if (update) {
        result = update(result);
        store.put(result);
      }
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("素材库本地保存失败"));
    };
  });
}
