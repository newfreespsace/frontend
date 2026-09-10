const assert = require("node:assert/strict");
const { test, beforeEach, afterEach } = require("node:test");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");
const { IDBFactory } = require("fake-indexeddb");
const bundle = esbuild.buildSync({
  stdin: {
    contents: 'export * from "./src/pages/draw/librarySync"; export * from "./src/pages/draw/libraryStorage";',
    resolveDir: path.resolve(__dirname, "..")
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false
});
const compiled = new Module(__filename, module);
compiled._compile(bundle.outputFiles[0].text, __filename);
const { AccountLibrarySync, updateLibraryRecord, applyLibraryChanges } = compiled.exports;
const item = id => ({
  id,
  status: "unpublished",
  created: 1,
  elements: [{ id: `element-${id}`, type: "rectangle", version: 1 }]
});
let sessions;
beforeEach(() => {
  global.indexedDB = new IDBFactory();
  sessions = [];
});
afterEach(() => sessions.forEach(session => session.stop()));
function fixture() {
  let items = [],
    offline = false,
    loseResponse = false;
  const remote = {
    get: async () => {
      if (offline) throw new Error("offline");
      return { libraryItems: items };
    },
    save: async changes => {
      if (offline) throw new Error("offline");
      items = applyLibraryChanges(items, changes);
      if (loseResponse) {
        loseResponse = false;
        throw new Error("lost response");
      }
      return { libraryItems: items };
    }
  };
  return {
    remote,
    get items() {
      return items;
    },
    set offline(value) {
      offline = value;
    },
    set loseResponse(value) {
      loseResponse = value;
    }
  };
}
function session(userId, remote) {
  const statuses = [];
  const sync = new AccountLibrarySync(userId, remote, (status, error) => statuses.push({ status, error }));
  sessions.push(sync);
  return { sync, statuses };
}
async function edit(sync, items) {
  await sync.adapter.load({ source: "save" });
  await sync.adapter.save({ libraryItems: items });
}

test("account library survives remount and loads on a device with no cache", async () => {
  const cloud = fixture(),
    first = session(1, cloud.remote).sync;
  await first.adapter.load({ source: "load" });
  await edit(first, [item("A")]);
  await first.sync();
  first.stop();
  global.indexedDB = new IDBFactory(); // another device has its own browser storage
  const next = session(1, cloud.remote).sync;
  assert.deepEqual((await next.adapter.load({ source: "load" })).libraryItems, [item("A")]);
  assert.deepEqual((await updateLibraryRecord(2)).libraryItems, []);
});

test("offline additions and deletions survive reload and sync without removing other device additions", async () => {
  const cloud = fixture(),
    first = session(1, cloud.remote).sync;
  await edit(first, [item("A")]);
  await first.sync();
  cloud.offline = true;
  await edit(first, [item("B")]);
  await assert.rejects(first.sync(), /offline/);
  first.stop();
  cloud.offline = false;
  await cloud.remote.save([{ id: "C", item: item("C") }]);
  const next = session(1, cloud.remote).sync;
  await next.adapter.load({ source: "load" });
  assert.deepEqual(cloud.items.map(x => x.id).sort(), ["B", "C"]);
  assert.equal((await updateLibraryRecord(1)).pending.length, 0);
});

test("lost response retries are idempotent and retain the pending journal until acknowledgement", async () => {
  const cloud = fixture(),
    sync = session(1, cloud.remote).sync;
  await edit(sync, [item("A")]);
  cloud.loseResponse = true;
  await assert.rejects(sync.sync(), /lost response/);
  assert.equal((await updateLibraryRecord(1)).pending.length, 1);
  await sync.sync();
  assert.deepEqual(cloud.items, [item("A")]);
  assert.equal((await updateLibraryRecord(1)).pending.length, 0);
});

test("edits made during an in-flight save are not acknowledged or overwritten by the older response", async () => {
  const cloud = fixture();
  let release, entered;
  const started = new Promise(resolve => {
    entered = resolve;
  });
  const gate = new Promise(resolve => {
    release = resolve;
  });
  let first = true;
  const sync = session(1, {
    ...cloud.remote,
    save: async changes => {
      if (first) {
        first = false;
        entered();
        await gate;
      }
      return cloud.remote.save(changes);
    }
  }).sync;
  await edit(sync, [item("A")]);
  const task = sync.sync();
  await started;
  await edit(sync, [item("A"), item("B")]);
  release();
  await task;
  assert.deepEqual(
    cloud.items.map(x => x.id),
    ["A", "B"]
  );
  assert.equal((await updateLibraryRecord(1)).pending.length, 0);
});

test("multiple tabs append local operations atomically", async () => {
  const cloud = fixture(),
    a = session(1, cloud.remote).sync,
    b = session(1, cloud.remote).sync;
  await Promise.all([a.adapter.load({ source: "save" }), b.adapter.load({ source: "save" })]);
  await Promise.all([a.adapter.save({ libraryItems: [item("A")] }), b.adapter.save({ libraryItems: [item("B")] })]);
  await a.sync();
  assert.deepEqual(cloud.items.map(x => x.id).sort(), ["A", "B"]);
});

test("removing an unsynced item coalesces its upload and isolated accounts retain their own pending data", async () => {
  const cloud = fixture(),
    sync = session(1, cloud.remote).sync,
    other = session(2, fixture().remote).sync;
  await edit(sync, [item("large")]);
  await edit(sync, []);
  await edit(other, [item("private")]);
  await sync.sync();
  assert.deepEqual(cloud.items, []);
  assert.equal((await updateLibraryRecord(2)).pending.length, 1);
});

test("failed initial cloud read uses cache and never sends an empty replacement", async () => {
  const cloud = fixture();
  cloud.offline = true;
  const { sync, statuses } = session(1, cloud.remote);
  assert.deepEqual((await sync.adapter.load({ source: "load" })).libraryItems, []);
  assert.equal((await updateLibraryRecord(1)).pending.length, 0);
  assert.match(statuses.at(-1).error, /offline/);
});

test("storage failure reports an unsaved library and never claims cloud success", async () => {
  const cloud = fixture(),
    { sync, statuses } = session(1, cloud.remote);
  await sync.adapter.load({ source: "save" });
  global.indexedDB = {
    open() {
      throw new Error("storage disabled");
    }
  };
  await assert.rejects(sync.adapter.save({ libraryItems: [item("A")] }), /storage disabled/);
  assert.match(statuses.at(-1).error, /本地保存失败/);
  assert.deepEqual(cloud.items, []);
  global.indexedDB = new IDBFactory();
  await sync.sync();
  assert.deepEqual(cloud.items, [item("A")]);
  assert.equal((await updateLibraryRecord(1)).pending.length, 0);
});
