const assert = require("node:assert/strict");
const { test, before, beforeEach, afterEach } = require("node:test");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="root"></div>', { url: "https://nsoj.test/p/7", pretendToBeVisual: true });
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
let Fields, SubmitMenuItem, AccountView, SubmissionItem, root;
const container = document.getElementById("root");
const mockState = { enterNewPage() {}, currentUser: { id: 1, username: "coder" } };
let activations, status;

before(async () => {
  global.__remoteTest = {
    state: mockState,
    activate: async context => {
      activations.push(context);
      return { response: {} };
    },
    status: async () => ({ response: status })
  };
  const mocks = {
    "@/utils/hooks": `const React = require('react'); exports.useLocalizer = () => (key, params) => key + (params ? JSON.stringify(params) : '');
      exports.Link = ({href,children,...props}) => React.createElement('a',{...props,href},children);
      exports.useLoginOrRegisterNavigation = () => () => {};`,
    "@/appState": `exports.appState = global.__remoteTest.state;`,
    "./api": `exports.remoteApi = {activate: global.__remoteTest.activate,status: global.__remoteTest.status};`,
    "@/remote-judge/api": `exports.remoteApi = {};`,
    "@/components/StatusText": `const React = require('react'); export default props => React.createElement('span',null,props.status);`,
    "@/AppRouter": `exports.RouteError = Error;`,
    "@/locales": `exports.makeToBeLocalizedText = key => key;`,
    "@/utils/toast": `export default {error:()=>{}};`,
    "@/components/UserLink": `const React=require('react'); export default props=>React.createElement('span',null,props.user.username);`,
    "@/components/ScoreText": `const React=require('react'); export default props=>React.createElement('span',null,props.score);`,
    "@/components/EmojiRenderer": `exports.EmojiRenderer = props=>props.children;`,
    "@/interfaces/CodeLanguage": `exports.CodeLanguage={Cpp:'cpp'};`,
    "@/pages/problem/utils": `exports.getProblemDisplayName=()=> 'Problem'; exports.getProblemIdString=()=> 'P7'; exports.getProblemUrl=()=>'/p/7';`,
    "@/utils/formatDateTime": `exports.friendlyFormatDateTime=()=>['time','time'];`
  };
  const bundle = await esbuild.build({
    stdin: {
      contents: `export {default as Fields} from './src/remote-judge/SubmissionMethodFields';
      export {default as SubmitMenuItem} from './src/remote-judge/RemoteSubmitMenuItem';
      export {View as AccountView} from './src/pages/user/edit/RemoteView';
      export {SubmissionItem} from './src/pages/submission/componments/SubmissionItem';`,
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
        name: "boundaries",
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
        }
      }
    ]
  });
  const compiledModule = new Module(path.join(__dirname, "remote-judge.generated.cjs"), module.parent);
  compiledModule.filename = path.join(__dirname, "remote-judge.generated.cjs");
  compiledModule.paths = Module._nodeModulePaths(__dirname);
  compiledModule._compile(bundle.outputFiles[0].text, compiledModule.filename);
  ({ Fields, SubmitMenuItem, AccountView, SubmissionItem } = compiledModule.exports);
});

beforeEach(() => {
  activations = [];
  status = {
    enabled: true,
    bound: true,
    handle: "coder",
    lastSyncedAt: "2026-10-20T12:00:00Z",
    latest: { id: 100, status: "Accepted" }
  };
  mockState.currentUser = { id: 1, username: "coder" };
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});

test("local configuration has no remote URL or score fields", async () => {
  await act(async () =>
    root.render(React.createElement(Fields, { method: "Local", url: "", fullScore: "", onChange() {} }))
  );
  assert.equal(container.querySelectorAll("input").length, 0);
  assert.match(container.textContent, /submission_method/);
});

test("remote configuration exposes source URL and optional partial-score maximum", async () => {
  await act(async () =>
    root.render(
      React.createElement(Fields, {
        method: "AtCoder",
        url: "https://atcoder.jp/contests/abc001/tasks/abc001_1",
        fullScore: "",
        onChange() {}
      })
    )
  );
  assert.equal(
    container.querySelector('input[placeholder*="abc001_1"]').value,
    "https://atcoder.jp/contests/abc001/tasks/abc001_1"
  );
  assert.ok(container.querySelector('input[type="number"]'));
  assert.match(container.textContent, /source_help/);
});

test("CF submit menu item links to the original form and keeps syncing without a status panel", async () => {
  const context = { problemId: 7, contestId: 20, contestProblemIndex: 1 };
  let refreshes = 0;
  status.lastError = "UPSTREAM_ERROR";
  await act(async () =>
    root.render(
      React.createElement(SubmitMenuItem, {
        meta: {
          id: 7,
          submissionMethod: "Codeforces",
          remoteProblem: { contestId: "4", taskId: "A" }
        },
        context,
        canSubmit: true,
        className: "important-submit",
        onResult: () => refreshes++
      })
    )
  );
  assert.deepEqual(activations, [context]);
  const button = container.querySelector('a[target="_blank"]');
  assert.equal(button.href, "https://codeforces.com/contest/4/submit?problemIndex=A");
  assert.equal(button.rel, "noopener noreferrer");
  assert.ok(button.classList.contains("item"));
  assert.ok(button.classList.contains("important-submit"));
  assert.ok(button.querySelector(".paper.plane.icon"));
  assert.equal(container.querySelector(".message"), null);
  assert.equal(container.querySelectorAll("a").length, 1);
  assert.doesNotMatch(container.textContent, /submission_help|bound_as|last_synced|sync_delayed|Accepted|coder/);
  status.latest = { id: 101, status: "Accepted" };
  await act(async () => document.dispatchEvent(new window.Event("visibilitychange")));
  assert.equal(refreshes, 1);
  assert.doesNotMatch(container.textContent, /Accepted|101/);
});

test("AtCoder uses the real task ID rather than deriving the letter", async () => {
  await act(async () =>
    root.render(
      React.createElement(SubmitMenuItem, {
        meta: {
          id: 7,
          submissionMethod: "AtCoder",
          remoteProblem: { contestId: "abc001", taskId: "abc001_1" }
        },
        context: { problemId: 7 },
        canSubmit: true
      })
    )
  );
  assert.equal(
    container.querySelector('a[target="_blank"]').href,
    "https://atcoder.jp/contests/abc001/submit?taskScreenName=abc001_1"
  );
});

test("the same submit menu item points unbound users to account settings and respects submission restrictions", async () => {
  status = { enabled: true, bound: false };
  const props = {
    meta: { id: 7, submissionMethod: "Codeforces", remoteProblem: { contestId: "4", taskId: "A" } },
    context: { problemId: 7 },
    canSubmit: true
  };
  await act(async () => root.render(React.createElement(SubmitMenuItem, props)));
  const button = container.querySelector('a.item[href="/u/coder/edit/remote"]');
  assert.ok(button);
  assert.match(button.textContent, /submit_on_platform.*Codeforces/);
  assert.equal(button.getAttribute("target"), null);
  assert.equal(container.querySelector('a[target="_blank"]'), null);
  await act(async () => root.render(React.createElement(SubmitMenuItem, { ...props, canSubmit: false })));
  assert.equal(container.textContent, "");
  assert.equal(container.querySelector("a"), null);
  mockState.currentUser = undefined;
  await act(async () => root.render(React.createElement(SubmitMenuItem, props)));
  assert.match(container.textContent, /submit_on_platform/);
  assert.equal(container.querySelector("a[href]"), null);
});

test("account settings show both platforms without accepting passwords or cookies", async () => {
  await act(async () => root.render(React.createElement(AccountView, { accounts: [], enabled: true })));
  assert.match(container.textContent, /Codeforces/);
  assert.match(container.textContent, /AtCoder/);
  assert.equal(container.querySelectorAll('input[type="password"]').length, 0);
  assert.equal(container.querySelectorAll("input").length, 2);
});

test("expired AtCoder sessions prompt users and give administrators a settings link", async () => {
  const accounts = [{ platform: "AtCoder", handle: "coder", lastError: "REMOTE_AUTH_REQUIRED" }];
  await act(async () => root.render(React.createElement(AccountView, { accounts, enabled: true })));
  assert.match(container.querySelector('[role="alert"]').textContent, /atcoder_session_expired/);
  assert.equal(container.querySelector('a[href="/site-settings"]'), null);
  mockState.currentUser.isAdmin = true;
  await act(async () => root.render(React.createElement(AccountView, { accounts, enabled: true })));
  assert.ok(container.querySelector('a[href="/site-settings"]'));
  await act(async () =>
    root.render(
      React.createElement(AccountView, {
        key: "rate-limited",
        accounts: [{ ...accounts[0], lastError: "REMOTE_RATE_LIMITED" }],
        enabled: true
      })
    )
  );
  assert.doesNotMatch(container.textContent, /atcoder_session_expired/);
  assert.match(container.textContent, /sync_delayed/);
});

test("remote memory summaries use KiB and unavailable values remain unknown", async () => {
  const submission = {
    id: 10,
    problem: { id: 7 },
    problemTitle: "Problem",
    submitter: { id: 1, username: "coder" },
    submitTime: "2026-10-20T12:00:00Z",
    status: "Accepted",
    score: 100,
    remote: { platform: "Codeforces", language: "GNU C++20" },
    timeUsed: 31,
    memoryUsed: 4
  };
  const render = value =>
    React.createElement(
      "table",
      null,
      React.createElement(
        "tbody",
        null,
        React.createElement(SubmissionItem, { submission: value, page: "submissions" })
      )
    );
  await act(async () => root.render(render(submission)));
  let cells = container.querySelectorAll("td");
  assert.equal(cells[3].textContent, "31 ms");
  assert.equal(cells[4].textContent, "4 K");
  await act(async () => root.render(render({ ...submission, timeUsed: null, memoryUsed: null })));
  cells = container.querySelectorAll("td");
  assert.equal(cells[3].textContent, "—");
  assert.equal(cells[4].textContent, "—");
});
