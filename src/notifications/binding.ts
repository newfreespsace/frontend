import type { PushBinding } from "./api";

const databaseName = "nsoj-notifications";

// Shared with notification-sw.js. No session token is stored in this database.
export async function browserBinding(value?: PushBinding | null): Promise<PushBinding | null> {
  return await new Promise((resolve, reject) => {
    const opening = indexedDB.open(databaseName, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("settings");
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const tx = db.transaction("settings", value === undefined ? "readonly" : "readwrite");
      const store = tx.objectStore("settings");
      const request =
        value === undefined
          ? store.get("binding")
          : value === null
          ? store.delete("binding")
          : store.put(value, "binding");
      let result: PushBinding = null;
      request.onsuccess = () => {
        result = value === undefined ? request.result || null : value;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("Binding storage failed"));
      };
    };
  });
}
