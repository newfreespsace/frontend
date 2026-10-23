const assert = require("node:assert/strict");
const { test, before, beforeEach, afterEach } = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const Module = require("node:module");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="root"></div>', { url: "https://nsoj.test/judge-machine", pretendToBeVisual: true });
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  IS_REACT_ACT_ENVIRONMENT: true
}))
  Object.defineProperty(global, key, { value, configurable: true, writable: true });
const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");
let Monitor, JudgePage, ServerMonitor, root, calls, response, visibility, timers, serial, serverCalls, serverResponse;
const originalSetInterval = global.setInterval,
  originalClearInterval = global.clearInterval;
const container = document.getElementById("root");
Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });

before(async () => {
  global.__monitorTest = {
    read: async () => {
      calls++;
      return { response };
    }
  };
  const mocks = {
    "./server-monitor-api": "exports.getServerMonitor = query => global.__monitorTest.readServer(query);",
    "react-chartjs-2":
      "const React = require('react'); exports.Line = props => React.createElement('canvas', {'aria-label':props['aria-label'], 'data-points':JSON.stringify(props.data.datasets[0].data)});",
    "@/remote-judge/monitor-api": "exports.getRemoteMonitor = () => global.__monitorTest.read();",
    "@/utils/hooks": `const React=require('react'); exports.useLocalizer=()=> (key,params)=>key+(params?JSON.stringify(params):''); exports.Link=({href,children,...props})=>React.createElement('a',{...props,href},children); exports.useNavigationChecked=()=>({refresh(){}}); exports.useAsyncCallbackPending=fn=>[false,fn];`,
    "@/components/TimeAgo":
      "const React=require('react'); export default ({time})=>React.createElement('time',{dateTime:time.toISOString()},'relative-time');",
    "@/utils/formatDateTime": "export default date=>[date.toISOString(),date.toISOString()];",
    "@/appState": "exports.appState={locale:'zh-CN',enterNewPage(){}};",
    "@/components/EmojiRenderer": "exports.EmojiRenderer=props=>props.children;",
    "@/utils/toast": "export default {success(){},error(){}};",
    "@/AppRouter": "exports.defineRoute=route=>route; exports.RouteError=Error;",
    "@/api": "export default {judgeClient:{}};",
    "mobx-react": "exports.observer = component => component;"
  };
  const bundle = await esbuild.build({
    stdin: {
      contents: `export {default as Monitor} from './src/pages/judge-machine/RemoteJudgeMonitor'; export {JudgeMachinePage as JudgePage} from './src/pages/judge-machine/JudgeMachinePage'; export {default as ServerMonitor} from './src/pages/judge-machine/ServerMonitor';`,
      resolveDir: path.resolve(__dirname, ".."),
      loader: "tsx"
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    write: false,
    plugins: [
      {
        name: "monitor-boundaries",
        setup(build) {
          build.onResolve({ filter: /\.less$/ }, args => ({ path: args.path, namespace: "style" }));
          build.onLoad({ filter: /.*/, namespace: "style" }, () => ({ contents: "export default {};", loader: "js" }));
          build.onResolve({ filter: /.*/ }, args =>
            mocks[args.path] ? { path: args.path, namespace: "mock" } : undefined
          );
          build.onLoad({ filter: /.*/, namespace: "mock" }, args => ({
            contents: mocks[args.path],
            loader: "tsx",
            resolveDir: path.resolve(__dirname, "..")
          }));
          build.onLoad({ filter: /judge-machine\/JudgeMachinePage\.tsx$/ }, args => ({
            contents:
              fs.readFileSync(args.path, "utf8").split("export default defineRoute")[0] +
              "\nexport {JudgeMachinePage};",
            loader: "tsx"
          }));
        }
      }
    ]
  });
  const compiled = new Module(__filename, module);
  compiled.paths = module.paths;
  compiled._compile(bundle.outputFiles[0].text, __filename);
  ({ Monitor, JudgePage, ServerMonitor } = compiled.exports);
});

const account = {
  accountId: 7,
  userId: 2,
  username: "private-student",
  handle: "private-remote-handle",
  lastError: null,
  lastErrorAt: null,
  nextSyncAt: new Date().toISOString(),
  sourceError: "REMOTE_CF_SOURCE_MISSING",
  sourceErrorAt: new Date().toISOString(),
  sourceRetryAt: new Date(Date.now() + 300000).toISOString()
};
function snapshot() {
  const now = new Date().toISOString();
  const admin = {
    boundAccounts: 42,
    activeAccounts: 6,
    queuedAccounts: 3,
    retryingAccounts: 1,
    historyAccounts: 2,
    pendingSubmissions: 4,
    errorAccounts: 0,
    sourceErrorAccounts: 1,
    oldestQueuedAt: now,
    liveWorkers: 2,
    tasks: [{ account, phase: "Collecting", startedAt: now }],
    errors: [account],
    errorsTruncated: false
  };
  return {
    updatedAt: now,
    stale: false,
    unavailable: false,
    platforms: [
      {
        platform: "Codeforces",
        state: "Healthy",
        lastSyncedAt: now,
        lastHeartbeatAt: now,
        sourceSupport: "PersonalKey",
        admin
      },
      {
        platform: "AtCoder",
        state: "AuthExpired",
        lastSyncedAt: now,
        lastHeartbeatAt: now,
        sourceSupport: "Unavailable",
        admin: {
          ...admin,
          sourceErrorAccounts: 0,
          errors: [],
          tasks: [],
          session: { configured: true, status: "expired", checkedAt: now, error: "REMOTE_AUTH_REQUIRED" }
        }
      }
    ],
    admin: {
      redis: {
        available: true,
        connectedClients: 24,
        maxClients: 10000,
        rejectedConnections: 10,
        rejectedDelta: 2,
        deltaSince: now,
        sampledAt: now
      }
    }
  };
}
beforeEach(() => {
  root = createRoot(container);
  calls = 0;
  response = snapshot();
  visibility = "visible";
  timers = new Map();
  serial = 0;
  global.setInterval = (fn, ms) => {
    const id = ++serial;
    timers.set(id, { fn, ms });
    return id;
  };
  global.clearInterval = id => timers.delete(id);
  global.__monitorTest.read = async () => {
    calls++;
    return { response };
  };
  serverCalls = [];
  const at = Date.now();
  serverResponse = {
    unavailable: false,
    bucketSeconds: 10,
    servers: [
      {
        id: "test-host",
        latest: { at, cpuPercent: 25, memoryPercent: 50, memoryUsedBytes: 1024 ** 3, memoryTotalBytes: 2 * 1024 ** 3 },
        points: [
          { at: at - 10000, cpuPercent: null, memoryPercent: null },
          { at, cpuPercent: 25, memoryPercent: 50 }
        ]
      }
    ]
  };
  global.__monitorTest.readServer = async query => {
    serverCalls.push(query);
    return { response: serverResponse };
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  assert.equal(timers.size, 0, "polling stops when leaving the page");
  global.setInterval = originalSetInterval;
  global.clearInterval = originalClearInterval;
});
const render = async props => act(async () => root.render(React.createElement(Monitor, props)));
const click = async element =>
  act(async () => {
    assert.ok(element);
    element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
const tick = async () =>
  act(async () => {
    for (const { fn, ms } of timers.values()) if (ms === 30000) fn();
  });
const visible = async value =>
  act(async () => {
    visibility = value;
    document.dispatchEvent(new window.Event("visibilitychange"));
  });

test("ordinary viewers see platform states and source capabilities but never administrator details", async () => {
  await render({ isAdmin: false });
  assert.match(container.textContent, /Codeforces/);
  assert.match(container.textContent, /AtCoder/);
  assert.match(container.textContent, /source_support.PersonalKey/);
  assert.match(container.textContent, /source_support.Unavailable/);
  assert.doesNotMatch(
    container.textContent,
    /private-student|private-remote|queued_accounts|redis_title|source_error_hint/
  );
  assert.equal(container.querySelectorAll("button[aria-expanded]").length, 0);
  assert.equal(calls, 1);
});

test("administrators can inspect queue stages, account errors, session recovery and Redis rejection deltas", async () => {
  await render({ isAdmin: true });
  const cf = container.querySelector('[data-platform="Codeforces"]');
  assert.match(cf.textContent, /state.Healthy/);
  assert.match(cf.textContent, /source_error_hint/);
  assert.match(container.textContent, /redis_rejections_increasing/);
  await click(cf.querySelector("button[aria-expanded]"));
  assert.match(cf.textContent, /phase.Collecting/);
  assert.match(cf.textContent, /REMOTE_CF_SOURCE_MISSING/);
  assert.equal(cf.querySelector('a[href="/u/private-student"]').textContent, "private-student");
  assert.match(cf.textContent, /retry_at/);
  const at = container.querySelector('[data-platform="AtCoder"]');
  await click(at.querySelector("button[aria-expanded]"));
  assert.doesNotMatch(at.textContent, /session.expired/);
  assert.equal(at.querySelector('a[href="/site-settings"]'), null);
});

test("administrators see parse details and retained errors after the account recovers", async () => {
  const at = response.platforms[1];
  const details = {
    stage: "parse",
    reason: "INVALID_SUBMISSION_TIME",
    contestId: "abc480",
    page: 3,
    submissionId: "80223806"
  };
  at.admin.errors = [
    {
      ...account,
      sourceError: null,
      lastError: "REMOTE_PARSE_FAILED",
      lastErrorAt: response.updatedAt,
      lastErrorDetails: details
    }
  ];
  at.admin.errorHistoryAvailable = true;
  at.admin.recentErrors = [
    {
      id: "error-1",
      account,
      kind: "Result",
      error: "REMOTE_PARSE_FAILED",
      details,
      at: response.updatedAt,
      retryAt: account.nextSyncAt
    }
  ];
  await render({ isAdmin: true });
  const card = container.querySelector('[data-platform="AtCoder"]');
  await click(card.querySelector("button[aria-expanded]"));
  assert.equal((card.textContent.match(/diagnostic_reason.INVALID_SUBMISSION_TIME/g) || []).length, 2);
  assert.match(card.textContent, /error_summary.REMOTE_PARSE_FAILED/);
  assert.match(card.textContent, /abc480/);
  assert.match(card.textContent, /failure_page3/);
  assert.match(card.textContent, /80223806/);
  assert.match(card.textContent, /recent_errors|error_history_hint/);
  at.admin.errors = [];
  at.state = "Healthy";
  await tick();
  assert.match(card.textContent, /no_errors/);
  assert.match(card.textContent, /REMOTE_PARSE_FAILED/);
  assert.match(card.textContent, /abc480/);
  await render({ isAdmin: false });
  assert.doesNotMatch(container.textContent, /REMOTE_PARSE_FAILED|abc480|80223806|recent_errors/);
});

test("unavailable error history is distinguished from an empty error history", async () => {
  response.platforms[1].admin.errorHistoryAvailable = false;
  await render({ isAdmin: true });
  const card = container.querySelector('[data-platform="AtCoder"]');
  await click(card.querySelector("button[aria-expanded]"));
  assert.match(card.textContent, /error_history_unavailable/);
  assert.doesNotMatch(card.textContent, /no_recent_errors/);
});

test("polling only reads stored snapshots, pauses in hidden tabs and refreshes on return", async () => {
  await render({ isAdmin: false });
  assert.equal(calls, 1);
  await tick();
  assert.equal(calls, 2);
  await visible("hidden");
  await tick();
  assert.equal(calls, 2);
  await visible("visible");
  assert.equal(calls, 3);
  await click(container.querySelector('button[aria-label=".refresh"]'));
  assert.equal(calls, 4);
});

test("a failed refresh retains timestamps but replaces healthy states with unknown", async () => {
  await render({ isAdmin: false });
  global.__monitorTest.read = async () => {
    calls++;
    throw new Error("network unavailable");
  };
  await tick();
  assert.match(container.textContent, /unavailable/);
  assert.match(container.textContent, /state.Unknown/);
  assert.doesNotMatch(container.textContent, /state.Healthy/);
  assert.ok(container.querySelector("time"));
});

test("an unavailable initial snapshot still displays both platforms as unknown", async () => {
  global.__monitorTest.read = async () => {
    throw new Error("network unavailable");
  };
  await render({ isAdmin: true });
  assert.equal(container.querySelectorAll("[data-platform]").length, 2);
  assert.match(container.textContent, /state.Unknown/);
  assert.doesNotMatch(container.textContent, /state.Healthy|queued_accounts|redis_title/);
});

test("stale or invalid snapshot timestamps never display a healthy platform", async () => {
  response.updatedAt = new Date(Date.now() - 120000).toISOString();
  await render({ isAdmin: false });
  assert.doesNotMatch(container.textContent, /state.Healthy/);
  assert.match(container.textContent, /state.Unknown/);
  response = { ...snapshot(), updatedAt: "invalid" };
  await tick();
  assert.doesNotMatch(container.textContent, /state.Healthy/);
});

test("overlapping refreshes and late responses cannot restore details after privilege loss", async () => {
  const pending = [];
  global.__monitorTest.read = () => {
    calls++;
    return new Promise(resolve => pending.push(resolve));
  };
  await render({ isAdmin: true });
  await tick();
  assert.equal(calls, 1);
  await render({ isAdmin: false });
  assert.equal(calls, 2);
  await act(async () => pending[0]({ response: snapshot() }));
  assert.doesNotMatch(container.textContent, /private-student|redis_title|queued_accounts/);
  await act(async () => pending[1]({ response: snapshot() }));
  assert.equal(container.querySelectorAll("button[aria-expanded]").length, 0);
  assert.doesNotMatch(container.textContent, /private-student|redis_title|queued_accounts/);
});

test("the judge machine page still renders remote services when there are no local judge machines", async () => {
  await act(async () => root.render(React.createElement(JudgePage, { hasManagePermission: false, judgeClients: [] })));
  assert.match(container.textContent, /no_judge_machine/);
  assert.match(container.textContent, /Codeforces/);
  assert.match(container.textContent, /AtCoder/);
});

test("verification and shared cooldown errors have specific administrator explanations", async () => {
  response.platforms[1].admin.errors = [
    {
      ...account,
      lastError: "REMOTE_VERIFICATION_REQUIRED",
      lastErrorDetails: { stage: "request", reason: "CHALLENGE_PAGE", httpStatus: 403 },
      sourceError: null
    },
    {
      ...account,
      accountId: 99,
      lastError: "REMOTE_COOLDOWN",
      lastErrorDetails: { stage: "rate_limit", reason: "SHARED_COOLDOWN" },
      sourceError: null
    }
  ];
  await render({ isAdmin: true });
  const card = container.querySelector('[data-platform="AtCoder"]');
  await click(card.querySelector("button[aria-expanded]"));
  assert.match(card.textContent, /error_summary.REMOTE_VERIFICATION_REQUIRED/);
  assert.match(card.textContent, /diagnostic_reason.CHALLENGE_PAGE/);
  assert.match(card.textContent, /error_summary.REMOTE_COOLDOWN/);
  assert.match(card.textContent, /diagnostic_reason.SHARED_COOLDOWN/);
});

const renderServer = async () => act(async () => root.render(React.createElement(ServerMonitor, { locale: "zh-CN" })));
const tickServer = async () =>
  act(async () => {
    for (const { fn, ms } of timers.values()) if (ms === 15000) fn();
  });

test("server resources show current usage, two chart series and missing samples", async () => {
  await renderServer();
  assert.match(container.textContent, /25.0%/);
  assert.match(container.textContent, /50.0%/);
  assert.match(container.textContent, /1.00 \/ 2.00 GiB/);
  assert.equal(container.querySelectorAll("canvas").length, 2);
  const cpu = JSON.parse(container.querySelector('canvas[aria-label=".cpu"]').dataset.points);
  assert.equal(cpu[0].y, null);
  assert.equal(cpu[1].y, 25);
  assert.deepEqual(serverCalls, [{ hours: 1 }]);
});

test("server range controls request the selected range and polling pauses when hidden", async () => {
  await renderServer();
  await click([...container.querySelectorAll("button")].find(button => button.textContent === ".range_24"));
  assert.deepEqual(serverCalls, [{ hours: 1 }, { hours: 24 }]);
  await tickServer();
  assert.equal(serverCalls.length, 3);
  await visible("hidden");
  await tickServer();
  assert.equal(serverCalls.length, 3);
  await visible("visible");
  assert.equal(serverCalls.length, 4);
  assert.equal(timers.size, 1);
});

test("stale server data never displays current usage and outages retain historical charts", async () => {
  serverResponse.servers[0].latest.at = Date.now() - 60000;
  await renderServer();
  assert.match(container.textContent, /stale/);
  assert.doesNotMatch(container.textContent, /25.0%/);
  global.__monitorTest.readServer = async () => {
    throw new Error("unavailable");
  };
  await tickServer();
  assert.match(container.textContent, /unavailable/);
  assert.equal(container.querySelectorAll("canvas").length, 2);
});

test("late server responses cannot replace the newly selected range", async () => {
  const pending = [];
  global.__monitorTest.readServer = query => {
    serverCalls.push(query);
    return new Promise(resolve => pending.push(resolve));
  };
  await renderServer();
  await tickServer();
  assert.equal(pending.length, 1);
  await click([...container.querySelectorAll("button")].find(button => button.textContent === ".range_6"));
  const old = structuredClone(serverResponse);
  old.servers[0].latest.cpuPercent = 99;
  await act(async () => pending[1]({ response: serverResponse }));
  await act(async () => pending[0]({ response: old }));
  assert.match(container.textContent, /25.0%/);
  assert.doesNotMatch(container.textContent, /99.0%/);
});

test("empty server history shows a waiting state", async () => {
  serverResponse.servers = [];
  await renderServer();
  assert.match(container.textContent, /empty/);
  assert.equal(container.querySelectorAll("canvas").length, 0);
});

test("a failed manual resource refresh retains the last chart", async () => {
  await renderServer();
  global.__monitorTest.readServer = async () => {
    throw new Error("unavailable");
  };
  await click(container.querySelector('button[aria-label=".refresh"]'));
  assert.match(container.textContent, /unavailable/);
  assert.equal(container.querySelectorAll("canvas").length, 2);
});
