const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("", { url: "https://nsoj.test/" });
global.window = dom.window;
global.localStorage = dom.window.localStorage;
global.location = { reload: () => globalThis.__authSyncTest.reloads++ };
window.apiEndpoint = "https://nsoj.test/";

async function compile(entry, mocks = {}) {
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, entry)],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "test-dependencies",
        setup(build) {
          build.onResolve({ filter: /.*/ }, args => {
            if (Object.hasOwn(mocks, args.path)) return { path: args.path, namespace: "test" };
          });
          build.onLoad({ filter: /.*/, namespace: "test" }, args => ({
            contents: mocks[args.path],
            loader: "js"
          }));
        }
      }
    ]
  });
  const mod = new Module(path.resolve(__dirname, "auth-session-sync.compiled.cjs"), module);
  mod.filename = path.resolve(__dirname, "auth-session-sync.compiled.cjs");
  mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, mod.filename);
  return mod.exports;
}

test("a stale 401 cannot erase a newer login from another tab", async () => {
  localStorage.clear();
  localStorage.setItem("appState", JSON.stringify({ token: "legacy-token", logout: false }));

  const tokenStorage = await compile("../src/authToken.ts");
  assert.equal(tokenStorage.getAuthToken(), "legacy-token");

  const state = (globalThis.__authSyncTest = {
    appState: { token: "legacy-token" },
    reloads: 0,
    axios: null
  });
  const api = await compile("../src/api.ts", {
    axios: "module.exports = (...args) => globalThis.__authSyncTest.axios(...args);",
    "./appState": `
      exports.appState = globalThis.__authSyncTest.appState;
      exports.setAuthToken = token => {
        localStorage.setItem("nsoj-auth-token", token);
        exports.appState.token = token;
      };
      exports.syncAuthToken = () => {
        exports.appState.token = localStorage.getItem("nsoj-auth-token");
      };
    `,
    "./locales": "exports.makeToBeLocalizedText = key => key;",
    "./api-generated": ""
  });

  let finishOldRequest;
  state.axios = (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer legacy-token");
    return new Promise(resolve => (finishOldRequest = resolve));
  };
  const oldRequest = api.createGetApi("protected")({});

  tokenStorage.storeAuthToken("new-token");
  finishOldRequest({ status: 401, data: { message: "login required" } });
  await oldRequest;
  assert.equal(tokenStorage.getAuthToken(), "new-token");
  assert.equal(state.reloads, 0);

  state.appState.token = "new-token";
  state.axios = async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer new-token");
    return { status: 401, data: { message: "login required" } };
  };
  await api.createGetApi("protected")({});
  assert.equal(tokenStorage.getAuthToken(), "");
  assert.equal(state.reloads, 1);
  assert.equal(localStorage.getItem("appState"), "{}");
});

test("a recorded logout does not restore a legacy token during migration", async () => {
  localStorage.clear();
  localStorage.setItem("appState", JSON.stringify({ token: "revoked-token", logout: true }));
  const tokenStorage = await compile("../src/authToken.ts");
  assert.equal(tokenStorage.getAuthToken(), "");
  assert.equal(localStorage.getItem("nsoj-auth-token"), "");
});

test("startup rejects another token's cache and navigation picks up the newer login", async () => {
  localStorage.clear();
  localStorage.setItem("nsoj-auth-token", "new-token");
  localStorage.setItem(
    "session-swr",
    JSON.stringify({
      version: 1,
      token: "old-token",
      date: Date.now(),
      sessionInfo: { userMeta: { id: 1 }, serverPreference: { misc: {} } }
    })
  );
  window.initialSessionToken = "new-token";
  delete window.sessionInfo;

  const state = (globalThis.__authSyncTest = {
    appState: { token: "new-token", currentUser: null, serverPreference: null },
    reloads: 0
  });
  const initApp = await compile("../src/initApp.ts", {
    "@/appState": `
      exports.appState = globalThis.__authSyncTest.appState;
      exports.initAppStateStore = async () => {};
      exports.setAuthToken = token => {
        localStorage.setItem("nsoj-auth-token", token);
        exports.appState.token = token;
      };
      exports.syncAuthToken = () => {
        exports.appState.token = localStorage.getItem("nsoj-auth-token");
        return exports.appState.token;
      };
    `,
    "@/api": `module.exports = {
      auth: {
        getSessionInfo: async ({token}) => ({
          response: {userMeta: {id: token === "third-token" ? 3 : 2}, serverPreference: {misc: {}}}
        })
      }
    };`,
    "@/misc/analytics": "exports.loadGoogleAnalytics = () => {}; exports.loadPlausible = () => {};",
    mobx: "exports.runInAction = fn => fn();"
  });

  let initialized = false;
  const pending = initApp.default().then(() => (initialized = true));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(initialized, false);
  assert.equal(state.appState.currentUser, null);

  window.getSessionInfoCallback({ userMeta: { id: 2 }, serverPreference: { misc: {} } });
  await pending;
  assert.equal(state.appState.currentUser.id, 2);
  assert.equal(localStorage.getItem("nsoj-auth-token"), "new-token");

  localStorage.setItem("nsoj-auth-token", "third-token");
  window.dispatchEvent(new window.StorageEvent("storage", { key: "nsoj-auth-token", newValue: "third-token" }));
  assert.equal(state.reloads, 0);
  assert.equal(state.appState.currentUser.id, 2);

  await initApp.refreshSessionIfChanged();
  assert.equal(state.appState.token, "third-token");
  assert.equal(state.appState.currentUser.id, 3);
});
