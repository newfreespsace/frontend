const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");
const { IDBFactory } = require("fake-indexeddb");
function load(source, globals = {}) {
  const context = { module: { exports: {} }, ...globals };
  vm.runInNewContext(
    transformSync(fs.readFileSync(path.join(__dirname, source), "utf8"), {
      loader: "ts",
      format: "cjs",
      target: "es2020"
    }).code,
    context
  );
  return context.module.exports;
}
function workerFixture() {
  const indexedDB = new IDBFactory(),
    handlers = {},
    shown = [],
    opened = [],
    navigated = [];
  const { browserBinding } = load("../src/notifications/binding.ts", { indexedDB });
  const self = {
    addEventListener: (event, handler) => {
      handlers[event] = handler;
    },
    registration: {
      showNotification: async (...args) => {
        shown.push(args);
      }
    },
    navigator: { language: "zh-CN" },
    location: { origin: "https://nsoj.top" },
    clients: {
      matchAll: async () => [],
      openWindow: async url => {
        opened.push(url);
      },
      claim: async () => {}
    },
    skipWaiting: async () => {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/notification-sw.js"), "utf8"), {
    self,
    indexedDB,
    URL
  });
  const dispatch = async (event, payload) => {
    let pending;
    handlers[event]({
      data: { json: () => payload },
      notification: { data: payload, close() {} },
      waitUntil: promise => {
        pending = promise;
      }
    });
    await pending;
  };
  return { browserBinding, self, dispatch, shown, opened, navigated };
}
const binding = { id: "browser", userId: 2, bindingVersion: "generation-a" };
const message = { userId: 2, bindingVersion: "generation-a", notificationId: "6f6cc862-d251-4940-a329-1887cf682572" };

test("service worker shows only generic alerts matching the saved account and generation", async () => {
  const f = workerFixture();
  await f.browserBinding(binding);
  await f.dispatch("push", { ...message, body: "private text must not appear" });
  assert.equal(f.shown.length, 1);
  assert.equal(f.shown[0][0], "NSOJ");
  assert.equal(f.shown[0][1].body, "你有一条新通知，请登录查看。");
  assert.equal(JSON.stringify(f.shown).includes("private text"), false);
  for (const payload of [
    { ...message, userId: 3 },
    { ...message, bindingVersion: "old" },
    { ...message, notificationId: "javascript:alert(1)" },
    null
  ])
    await f.dispatch("push", payload);
  assert.equal(f.shown.length, 1);
});
test("clearing the local binding suppresses queued pushes and old notification clicks", async () => {
  const f = workerFixture();
  await f.browserBinding(binding);
  await f.browserBinding(null);
  await f.dispatch("push", message);
  await f.dispatch("notificationclick", message);
  assert.equal(f.shown.length, 0);
  assert.equal(f.opened.length, 0);
  await f.browserBinding({ ...binding, userId: 3, bindingVersion: "generation-b" });
  await f.dispatch("push", message);
  assert.equal(f.shown.length, 0);
});
test("notification clicks always open this site's authenticated notification center", async () => {
  const f = workerFixture();
  await f.browserBinding(binding);
  await f.dispatch("notificationclick", { ...message, url: "https://evil.test" });
  assert.equal(f.opened[0], `https://nsoj.top/notifications?open=${message.notificationId}`);
  f.self.clients.matchAll = async () => [
    {
      url: "https://nsoj.top/p",
      navigate: async url => {
        f.navigated.push(url);
      },
      focus: async () => {}
    }
  ];
  await f.dispatch("notificationclick", message);
  assert.equal(f.navigated.length, 1);
});
function pushFixture(timers = { setTimeout, clearTimeout }) {
  let saved = { ...binding },
    token = "alice-token";
  const calls = [],
    warnings = [],
    appState = { currentUser: { id: 2 }, token };
  const subscription = {
    toJSON: () => ({
      endpoint: "https://fcm.googleapis.com/test",
      expirationTime: null,
      keys: { p256dh: "key", auth: "auth" }
    }),
    unsubscribe: async () => {
      calls.push("unsubscribe");
      return true;
    }
  };
  const registered = {
    active: { scriptURL: "https://nsoj.top/notification-sw.js" },
    pushManager: { getSubscription: async () => subscription, subscribe: async () => subscription },
    getNotifications: async () => []
  };
  const api = {
    pushStatus: async () => ({ response: { enabled: true, publicKey: "YWJj", subscriptions: [{ ...binding }] } }),
    bindPush: async () => {
      calls.push("bind");
      return { response: { ...binding } };
    },
    disablePush: async () => {
      calls.push("disable");
      return { response: { success: true } };
    }
  };
  const browserBinding = async value => {
    if (value !== undefined) {
      saved = value;
      calls.push(value === null ? "clear" : "save");
    }
    return saved;
  };
  const Notification = { permission: "granted", requestPermission: async () => "granted" };
  const window = {
    isSecureContext: true,
    PushManager: {},
    Notification,
    indexedDB: {},
    dispatchEvent() {},
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  };
  const navigator = { serviceWorker: { register: async () => registered, getRegistration: async () => registered } };
  const preferences = new Map();
  const prompt = load("../src/notifications/pushPromptPreference.ts", {
    localStorage: {
      getItem: key => preferences.get(key) ?? null,
      setItem: (key, value) => preferences.set(key, value)
    },
    window,
    Event
  });
  const exported = load("../src/notifications/push.ts", {
    window,
    navigator,
    Notification,
    atob,
    Uint8Array,
    setTimeout,
    clearTimeout,
    Event,
    console: { warn: (...args) => warnings.push(args) },
    require: name =>
      ({
        "@/appState": { appState },
        "@/authToken": { getAuthToken: () => token },
        "./api": { notificationApi: api },
        "./binding": { browserBinding },
        "./pushPromptPreference": prompt
      }[name])
  });
  return {
    ...exported,
    calls,
    api,
    appState,
    registered,
    navigator,
    subscription,
    warnings,
    Notification,
    prompt,
    getSaved: () => saved,
    setToken: value => {
      token = value;
    }
  };
}
test("disabling push invalidates local ownership before contacting the server", async () => {
  const f = pushFixture();
  await f.disableBrowserPush();
  assert.equal(f.getSaved(), null);
  assert.ok(f.calls.indexOf("clear") < f.calls.indexOf("disable"));
  assert.ok(f.calls.includes("unsubscribe"));
  assert.equal(f.prompt.readPushPromptPreference(2).choice, "denied");
});
test("account changes cancel the previous browser subscription instead of transferring it", async () => {
  const f = pushFixture();
  f.appState.currentUser.id = 3;
  await f.reconcileBrowserPush();
  assert.equal(f.getSaved(), null);
  assert.ok(f.calls.includes("unsubscribe"));
  assert.equal(f.calls.includes("bind"), false);
});
test("revoked subscriptions are cleared and denied permission never creates a binding", async () => {
  const f = pushFixture();
  f.api.pushStatus = async () => ({ response: { subscriptions: [] } });
  await f.reconcileBrowserPush();
  assert.equal(f.getSaved(), null);
  f.Notification.requestPermission = async () => "denied";
  await assert.rejects(() => f.enableBrowserPush(), /push_denied/);
  assert.equal(f.calls.includes("bind"), false);
});
test("a login change during subscription creation cannot persist an old account binding", async () => {
  const f = pushFixture();
  f.api.bindPush = async () => {
    f.setToken("bob-token");
    return { response: { ...binding } };
  };
  await assert.rejects(() => f.enableBrowserPush(), /push_error/);
  assert.equal(f.getSaved(), null);
  assert.ok(f.calls.includes("unsubscribe"));
});

test("native subscription JSON is normalized before registering it with the strict API", async () => {
  const f = pushFixture();
  let received;
  f.api.bindPush = async value => {
    received = value;
    return { response: { ...binding } };
  };
  await f.enableBrowserPush();
  assert.deepEqual(Object.keys(received).sort(), ["endpoint", "keys"]);
  assert.equal(f.getSaved().userId, 2);
  assert.equal(f.prompt.readPushPromptPreference(2).choice, "allowed");
});

test("dismissing native permission defers the next prompt instead of permanently rejecting it", async () => {
  const f = pushFixture();
  f.Notification.requestPermission = async () => "default";
  const before = Date.now();
  await assert.rejects(() => f.enableBrowserPush(), /push_deferred/);
  const preference = f.prompt.readPushPromptPreference(2);
  assert.equal(preference.choice, "later");
  assert.ok(preference.remindAfter >= before + f.prompt.PUSH_PROMPT_DELAY_MS);
  assert.equal(f.calls.includes("bind"), false);
});

test("a rejected native permission is remembered without creating a subscription", async () => {
  const f = pushFixture();
  f.Notification.requestPermission = async () => "denied";
  await assert.rejects(() => f.enableBrowserPush(), /push_denied/);
  assert.equal(f.prompt.readPushPromptPreference(2).choice, "denied");
  assert.equal(f.calls.includes("bind"), false);
});

test("account changes while native permission is pending never subscribe the new account", async () => {
  const f = pushFixture();
  let resolvePermission;
  f.Notification.requestPermission = () =>
    new Promise(resolve => {
      resolvePermission = resolve;
    });
  const pending = f.enableBrowserPush();
  f.appState.currentUser.id = 3;
  f.setToken("bob-token");
  resolvePermission("granted");
  await assert.rejects(() => pending, /push_error/);
  assert.equal(f.calls.includes("bind"), false);
  assert.equal(f.prompt.readPushPromptPreference(3), null);
});

function pushTimers() {
  const pending = new Map();
  let nextId = 0;
  return {
    pending,
    setTimeout: (callback, delay) => {
      const id = ++nextId;
      pending.set(id, { callback, delay });
      return id;
    },
    clearTimeout: id => pending.delete(id),
    expire: delay => {
      for (const [id, timer] of pending) {
        if (timer.delay !== delay) continue;
        pending.delete(id);
        timer.callback();
      }
    }
  };
}

for (const scenario of [
  {
    name: "permission",
    key: "push_permission_timeout",
    delay: 60000,
    hang: f => (f.Notification.requestPermission = () => new Promise(() => {}))
  },
  {
    name: "worker registration",
    key: "push_worker_timeout",
    delay: 15000,
    hang: f => (f.navigator.serviceWorker.register = () => new Promise(() => {}))
  },
  {
    name: "reading an existing subscription",
    key: "push_subscription_timeout",
    delay: 15000,
    hang: f => (f.registered.pushManager.getSubscription = () => new Promise(() => {}))
  },
  {
    name: "reading server configuration",
    key: "push_server_timeout",
    delay: 15000,
    hang: f => (f.api.pushStatus = () => new Promise(() => {}))
  },
  {
    name: "saving a server binding",
    key: "push_server_timeout",
    delay: 15000,
    hang: f => (f.api.bindPush = () => new Promise(() => {}))
  }
]) {
  test(`a stalled ${scenario.name} stops enabling with the matching timeout`, async () => {
    const timers = pushTimers();
    const f = pushFixture(timers);
    scenario.hang(f);
    const pending = f.enableBrowserPush();
    const rejected = assert.rejects(pending, new RegExp(scenario.key));
    await new Promise(setImmediate);
    assert.equal(timers.pending.size, 1);
    timers.expire(scenario.delay);
    await rejected;
    assert.equal(f.calls.includes("save"), false);
    assert.equal(f.calls.includes("bind"), false);
    assert.equal(timers.pending.size, 0);
  });
}

test("a subscription that completes after timeout never binds or saves ownership", async () => {
  const timers = pushTimers();
  const f = pushFixture(timers);
  let resolveSubscription;
  f.registered.pushManager.getSubscription = async () => null;
  f.registered.pushManager.subscribe = () => new Promise(resolve => (resolveSubscription = resolve));
  const pending = f.enableBrowserPush();
  const rejected = assert.rejects(pending, /push_subscription_timeout/);
  await new Promise(setImmediate);
  assert.equal(typeof resolveSubscription, "function");
  timers.expire(30000);
  await rejected;
  resolveSubscription(f.subscription);
  await new Promise(setImmediate);
  assert.equal(f.calls.includes("bind"), false);
  assert.equal(f.calls.includes("save"), false);
  assert.equal(timers.pending.size, 0);
});

test("worker activation timeout removes the listener and never creates a binding", async () => {
  const timers = pushTimers();
  const f = pushFixture(timers);
  const listeners = new Set();
  f.registered.active = null;
  f.registered.installing = {
    state: "installing",
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener)
  };
  const pending = f.enableBrowserPush();
  const rejected = assert.rejects(pending, /push_worker_timeout/);
  await new Promise(setImmediate);
  assert.equal(listeners.size, 1);
  timers.expire(15000);
  await rejected;
  assert.equal(listeners.size, 0);
  assert.equal(f.calls.includes("bind"), false);
});

test("subscription failures expose the stage and log no provider details or subscription secrets", async () => {
  const f = pushFixture();
  f.registered.pushManager.getSubscription = async () => null;
  f.registered.pushManager.subscribe = async () => {
    const error = new Error("provider response containing a private endpoint and secret");
    error.name = "AbortError";
    throw error;
  };
  await assert.rejects(f.enableBrowserPush(), /push_subscription_error/);
  assert.equal(f.browserPushErrorKey(new Error("push_subscription_error")), "push_subscription_error");
  assert.equal(f.browserPushErrorKey(new Error("unknown private detail")), "push_error");
  assert.equal(f.warnings.length, 1);
  assert.equal(JSON.stringify(f.warnings), '[["[BrowserPush] subscription failed","AbortError"]]');
  assert.equal(f.calls.includes("bind"), false);
});

test("offline browsers fail before asking for permission or creating a binding", async () => {
  const f = pushFixture();
  f.navigator.onLine = false;
  let requested = false;
  f.Notification.requestPermission = async () => {
    requested = true;
    return "granted";
  };
  await assert.rejects(f.enableBrowserPush(), /push_network_error/);
  assert.equal(requested, false);
  assert.equal(f.calls.includes("bind"), false);
  assert.equal(f.calls.includes("save"), false);
  assert.equal(f.prompt.readPushPromptPreference(2), null);
});

test("native network failures and denied permission have distinct subscription messages", async () => {
  for (const [name, key] of [
    ["NetworkError", "push_network_error"],
    ["NotAllowedError", "push_denied"],
    ["AbortError", "push_subscription_error"],
    ["TypeError", "push_subscription_error"]
  ]) {
    const f = pushFixture();
    f.registered.pushManager.getSubscription = async () => null;
    f.registered.pushManager.subscribe = async () => {
      const error = new Error("private provider details");
      error.name = name;
      throw error;
    };
    await assert.rejects(f.enableBrowserPush(), new RegExp(key));
    assert.equal(f.browserPushErrorKey(new Error(key)), key);
    assert.equal(f.calls.includes("bind"), false);
    assert.equal(JSON.stringify(f.warnings).includes("private provider details"), false);
  }
});

test("a login change while creating a native subscription never calls bindPush", async () => {
  const f = pushFixture();
  f.registered.pushManager.getSubscription = async () => null;
  f.registered.pushManager.subscribe = async () => {
    f.setToken("bob-token");
    f.appState.currentUser.id = 3;
    return f.subscription;
  };
  await assert.rejects(f.enableBrowserPush(), /push_error/);
  assert.equal(f.calls.includes("bind"), false);
  assert.equal(f.calls.includes("save"), false);
});

test("a stalled replacement subscription also times out without retrying the server binding", async () => {
  const timers = pushTimers();
  const f = pushFixture(timers);
  f.api.bindPush = async () => {
    f.calls.push("bind");
    return { requestError: "conflict" };
  };
  f.registered.pushManager.subscribe = () => new Promise(() => {});
  const pending = f.enableBrowserPush();
  const rejected = assert.rejects(pending, /push_subscription_timeout/);
  await new Promise(setImmediate);
  timers.expire(30000);
  await rejected;
  assert.equal(f.calls.filter(call => call === "bind").length, 1);
  assert.equal(f.calls.includes("save"), false);
  assert.equal(f.getSaved(), null);
});

test("a failed configuration request is not reported as a site missing push configuration", async () => {
  const f = pushFixture();
  f.api.pushStatus = async () => ({ requestError: "network failure" });
  await assert.rejects(f.enableBrowserPush(), /push_error/);
  assert.equal(f.calls.includes("bind"), false);
});

test("a stalled notification cleanup cannot leave a new account's enable attempt spinning", async () => {
  const timers = pushTimers();
  const f = pushFixture(timers);
  f.appState.currentUser.id = 3;
  f.registered.getNotifications = () => new Promise(() => {});
  const pending = f.enableBrowserPush();
  const rejected = assert.rejects(pending, /push_worker_timeout/);
  await new Promise(setImmediate);
  timers.expire(15000);
  await rejected;
  assert.equal(f.getSaved(), null);
  assert.equal(f.calls.includes("bind"), false);
  assert.equal(f.calls.includes("save"), false);
});

function promptFixture(storage = new Map()) {
  const events = [];
  const globals = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    window: { dispatchEvent: event => events.push(event.type) },
    Event
  };
  return { ...load("../src/notifications/pushPromptPreference.ts", globals), storage, events, globals };
}

test("new visitors are prompted; allow and decline persist through refreshes and future visits", () => {
  for (const choice of ["allowed", "denied"]) {
    const f = promptFixture();
    assert.equal(f.shouldOfferBrowserPush(2), true);
    f.rememberPushPromptChoice(2, choice, 1000);
    const revisited = promptFixture(f.storage);
    assert.equal(revisited.shouldOfferBrowserPush(2, 1000 + 365 * f.PUSH_PROMPT_DELAY_MS), false);
    assert.equal(f.events[0], f.PUSH_PROMPT_CHANGED_EVENT);
  }
});

test("Later defers exactly 24 hours, survives refresh and does not extend on each visit", () => {
  const f = promptFixture();
  const chosenAt = Date.UTC(2026, 9, 27, 10);
  f.rememberPushPromptChoice(2, "later", chosenAt);
  const revisited = promptFixture(f.storage);
  assert.equal(revisited.shouldOfferBrowserPush(2, chosenAt + f.PUSH_PROMPT_DELAY_MS - 1), false);
  assert.equal(revisited.shouldOfferBrowserPush(2, chosenAt + f.PUSH_PROMPT_DELAY_MS), true);
  assert.equal(revisited.readPushPromptPreference(2).remindAfter, chosenAt + f.PUSH_PROMPT_DELAY_MS);
  revisited.rememberPushPromptChoice(2, "later", chosenAt + f.PUSH_PROMPT_DELAY_MS);
  assert.equal(revisited.shouldOfferBrowserPush(2, chosenAt + 2 * f.PUSH_PROMPT_DELAY_MS - 1), false);
});

test("prompt choices are scoped to each account in the browser and tolerate corrupt storage", () => {
  const f = promptFixture();
  f.rememberPushPromptChoice(2, "denied");
  assert.equal(f.shouldOfferBrowserPush(3), true);
  for (const value of ["not-json", '{"choice":"unknown"}', '{"choice":"later","remindAfter":"tomorrow"}']) {
    f.storage.set(f.PUSH_PROMPT_STORAGE_PREFIX + 3, value);
    assert.equal(f.shouldOfferBrowserPush(3), true);
  }
});

test("unavailable persistent storage still remembers a decision for the current visit", () => {
  const f = promptFixture();
  f.globals.localStorage.getItem = f.globals.localStorage.setItem = () => {
    throw new Error("blocked");
  };
  f.rememberPushPromptChoice(2, "denied");
  assert.equal(f.shouldOfferBrowserPush(2), false);
});
