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
let Fields, SubmitMenuItem, AccountView, SubmissionItem, RemoteDetails, root;
const container = document.getElementById("root");
const mockState = { enterNewPage() {}, currentUser: { id: 1, username: "coder" } };
let activations, status, accountStatus, accountReads, credentialWrites;

before(async () => {
  global.__remoteTest = {
    state: mockState,
    activate: async context => {
      activations.push(context);
      return { response: {} };
    },
    status: async () => ({ response: status }),
    accounts: async () => {
      accountReads++;
      return { response: accountStatus };
    },
    setCredentials: async request => {
      credentialWrites.push(request);
      return {
        response: {
          enabled: true,
          accounts: [{ platform: "Codeforces", handle: "coder", codeforcesSourceEnabled: !request.clear }]
        }
      };
    }
  };
  const mocks = {
    "@/utils/hooks": `const React = require('react'); exports.useLocalizer = () => (key, params) => key + (params ? JSON.stringify(params) : '');
      exports.Link = ({href,children,...props}) => React.createElement('a',{...props,href},children);
      exports.useLoginOrRegisterNavigation = () => () => {};`,
    "@/appState": `exports.appState = global.__remoteTest.state;`,
    "./api": `exports.remoteApi = {activate: global.__remoteTest.activate,status: global.__remoteTest.status};`,
    "@/remote-judge/api": `exports.remoteApi = {accounts:global.__remoteTest.accounts,setCodeforcesCredentials:global.__remoteTest.setCredentials};`,
    "@/pages/submission/submission/common/FormattableCodeBox": `const React = require('react'); export default React.forwardRef(({code},ref)=>React.createElement('pre',{ref},code));`,
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
      export {default as RemoteDetails} from './src/remote-judge/RemoteSubmissionDetails';
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
  ({ Fields, SubmitMenuItem, AccountView, SubmissionItem, RemoteDetails } = compiledModule.exports);
});

beforeEach(() => {
  activations = [];
  credentialWrites = [];
  accountReads = 0;
  accountStatus = { accounts: [], enabled: true };
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
  assert.match(container.textContent, /sync_rate_limited/);
});

test("account progress refreshes after returning to the page and clears a completed CF history import", async () => {
  const account = { platform: "Codeforces", handle: "coder", importingHistory: true };
  await act(async () => root.render(React.createElement(AccountView, { accounts: [account], enabled: true })));
  assert.match(container.textContent, /importing_history/);
  accountStatus = {
    accounts: [{ ...account, importingHistory: false, lastSyncedAt: "2026-10-21T12:00:00Z" }],
    enabled: true
  };
  await act(async () => document.dispatchEvent(new window.Event("visibilitychange")));
  assert.doesNotMatch(container.textContent, /importing_history/);
  assert.match(container.textContent, /last_synced/);
  assert.equal(accountReads, 1);
  assert.deepEqual(activations, [], "reading progress must not trigger an upstream catch-up");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  await act(async () => document.dispatchEvent(new window.Event("visibilitychange")));
  assert.equal(accountReads, 1);
  delete document.visibilityState;
});

test("failed CF history imports show access errors and retry time instead of a running banner", async () => {
  const account = {
    platform: "Codeforces",
    handle: "coder",
    importingHistory: true,
    lastError: "REMOTE_ACCESS_DENIED",
    nextSyncAt: "2026-10-21T12:10:00Z"
  };
  await act(async () => root.render(React.createElement(AccountView, { accounts: [account], enabled: true })));
  assert.doesNotMatch(container.textContent, /importing_history/);
  assert.match(container.textContent, /sync_access_denied/);
  assert.match(container.textContent, /REMOTE_ACCESS_DENIED/);
  assert.match(container.textContent, /next_retry/);
  accountStatus = { accounts: [{ ...account, lastError: "REMOTE_API_FAILED" }], enabled: false };
  await act(async () => document.dispatchEvent(new window.Event("visibilitychange")));
  assert.match(container.textContent, /sync_api_failed/);
  assert.match(container.textContent, /sync_paused/);
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

test("CF source credentials are optional, require both fields and are cleared from the form after save", async () => {
  await act(async () =>
    root.render(
      React.createElement(AccountView, { accounts: [{ platform: "Codeforces", handle: "coder" }], enabled: true })
    )
  );
  assert.match(container.textContent, /cf_source_optional/);
  assert.ok(container.querySelector('a[href="https://codeforces.com/settings/api"]'));
  const key = container.querySelector("#cf-api-key");
  const secret = container.querySelector("#cf-api-secret");
  assert.equal(key.type, "password");
  assert.equal(secret.type, "password");
  const save = [...container.querySelectorAll("button")].find(button => button.textContent === ".cf_credentials_save");
  const clear = [...container.querySelectorAll("button")].find(
    button => button.textContent === ".cf_credentials_clear"
  );
  assert.equal(save.disabled, true);
  assert.equal(clear.disabled, true);
  async function change(input, value) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  }
  await change(key, "testKey123");
  assert.equal(save.disabled, true);
  await change(secret, "testSecret456");
  assert.equal(save.disabled, false);
  await act(async () => save.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
  assert.deepEqual(credentialWrites, [{ apiKey: "testKey123", apiSecret: "testSecret456" }]);
  assert.equal(key.value, "");
  assert.equal(secret.value, "");
  assert.doesNotMatch(container.innerHTML, /testKey123|testSecret456/);
  assert.match(container.textContent, /cf_source_enabled/);
  assert.equal(clear.disabled, false);
  await act(async () => clear.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
  assert.deepEqual(credentialWrites[1], { clear: true });
  assert.match(container.textContent, /cf_source_optional/);
});

test("missing source is not mislabeled as invalid credentials", async () => {
  await act(async () =>
    root.render(
      React.createElement(AccountView, {
        accounts: [
          {
            platform: "Codeforces",
            handle: "coder",
            codeforcesSourceEnabled: true,
            codeforcesSourceError: "REMOTE_CF_SOURCE_MISSING"
          }
        ],
        enabled: true
      })
    )
  );
  assert.match(container.querySelector('[role="alert"]').textContent, /cf_source_missing/);
  assert.doesNotMatch(container.querySelector('[role="alert"]').textContent, /cf_source_failed/);
});

test("remote detail shows authorized source and real summaries, including zero, without inventing test cases", async () => {
  const remote = {
    platform: "Codeforces",
    handle: "coder",
    id: "123",
    url: "https://codeforces.com/contest/4/submission/123",
    language: "GNU C++20",
    verdict: "COMPILATION_ERROR",
    passedTestCount: 0,
    testset: "PRETESTS",
    sourceAvailable: true
  };
  await act(async () =>
    root.render(React.createElement(RemoteDetails, { remote, content: { code: "int main() {}", language: "cpp" } }))
  );
  assert.equal(container.querySelector("pre").textContent, "int main() {}");
  assert.match(container.textContent, /passed_tests.*0/);
  assert.match(container.textContent, /test_stage.*PRETESTS/);
  assert.match(container.textContent, /test_details_unavailable/);
  assert.equal(container.querySelectorAll("table").length, 0);
  await act(async () => root.render(React.createElement(RemoteDetails, { remote, content: undefined })));
  assert.equal(container.querySelector("pre"), null);
  assert.match(container.textContent, /details_unavailable/);
});
