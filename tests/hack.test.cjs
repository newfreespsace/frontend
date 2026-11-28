const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");

function loadModule(filename, mocks) {
  const source = esbuild.transformSync(fs.readFileSync(filename, "utf8"), {
    loader: "tsx",
    format: "cjs",
    supported: { "dynamic-import": false }
  }).code;
  const localModule = new Module(filename, module);
  localModule.paths = module.paths;
  const nativeRequire = localModule.require.bind(localModule);
  localModule.require = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/") || name.endsWith(".less")) return {};
    return nativeRequire(name);
  };
  localModule._compile(source, filename);
  return localModule.exports;
}

async function fixture(t) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://nsoj.test/p/12",
    pretendToBeVisual: true
  });
  Object.assign(global, {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true
  });
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const { observable } = require("mobx");
  const el = React.createElement;
  const root = createRoot(document.getElementById("root"));
  const target = { id: 31, language: "cpp", time: "2026-11-27T00:00:00Z" };
  const appState = observable({ currentUser: { id: 4 }, activeGroupContests: [], enterNewPage() {} });
  const mocks = {
    "mobx-react": require("mobx-react-lite"),
    "@/appState": { appState },
    "@/api": {
      default: {
        problem: { getProblem: async () => ({ response: { meta: { id: 12, type: "Traditional" } } }) },
        contest: {
          getContest: async () => ({
            response: { meta: { problemIds: [12], endTime: "2000-01-01T00:00:00Z" } }
          })
        }
      },
      __esModule: true
    },
    "@/utils/hooks": {
      Link: ({ href, children }) => el("a", { href }, children),
      useLocalizer: () => (key, values) => key === ".size" ? `${values.bytes}/${values.limit}` : key
    }
  };
  const api = {
    targets: async () => ({ response: { enabled: true, inputLimit: 100, targets: [target] } }),
    target: async () => ({ response: { target: { ...target, inputLimit: 100 } } }),
    mine: async () => ({ response: [] })
  };
  const panel = loadModule(path.resolve(__dirname, "../src/hack/HackPanel.tsx"), {
    ...mocks,
    "./api": { hackApi: api },
    "./HackPanel.module.less": {
      recordHeader: "hack-record-header",
      recordDetails: "hack-record-details",
      recordActions: "hack-record-actions"
    }
  });
  const render = view => React.act(async () => root.render(view));
  const click = element => React.act(async () => element.click());
  const button = text => [...document.querySelectorAll("button")].find(element => element.textContent === text);
  const setInput = value =>
    React.act(async () => {
      const textarea = document.querySelector("textarea");
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(textarea, value);
      textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  t.after(async () => {
    await React.act(async () => root.unmount());
    dom.window.close();
  });
  return { React, el, panel, api, target, appState, mocks, render, click, button, setInput };
}

test("the public user list shows successful Hacks after rating for each user", async t => {
  const { mocks, appState, render, el } = await fixture(t);
  appState.serverPreference = { pagination: { userList: 20 }, misc: {} };
  let canManageUsers = false;
  appState.currentUserHasPrivilege = () => canManageUsers;
  const first = { id: 1, username: "first", rating: 1500, successfulHackCount: 3 };
  const second = { id: 2, username: "second", rating: 1200, successfulHackCount: 0 };
  const third = { id: 3, username: "third", rating: 1100 };
  const requests = [];
  const route = loadModule(path.resolve(__dirname, "../src/pages/user/users/UsersPage.tsx"), {
    ...mocks,
    "react-navi": { useCurrentRoute: () => ({ url: { query: {} } }) },
    "@/api": {
      __esModule: true,
      default: {
        user: {
          getUserList: async request => {
            requests.push(request);
            return { response: { userMetas: [first, second, third], count: 23 } };
          }
        },
        auth: { listActiveUsers: async () => ({ response: { users: [{ user: first, lastAccessTime: 0 }] } }) }
      }
    },
    "@/AppRouter": { defineRoute: load => load, RouteError: Error },
    "@/utils/hooks": { ...mocks["@/utils/hooks"], useNavigationChecked: () => ({}) },
    "@/components/Pagination": { Pagination: () => null },
    "@/components/UserLink": { default: ({ user }) => user.username, __esModule: true },
    "@/components/UserSearch": { default: () => null, __esModule: true },
    "@/components/EmojiRenderer": { EmojiRenderer: ({ children }) => el("div", null, children) },
    "@/components/TimeAgo": { default: () => null, __esModule: true }
  }).default;

  await render(await route({ query: { page: "2", sortBy: "rating" } }));
  assert.deepEqual(requests, [{ sortBy: "rating", skipCount: 20, takeCount: 20 }]);
  assert.deepEqual(Array.from(document.querySelectorAll("thead th"), cell => cell.textContent.trim()).slice(-2), [
    ".rating",
    ".successful_hack_count"
  ]);
  assert.deepEqual(
    Array.from(document.querySelectorAll("tbody tr"), row =>
      Array.from(row.cells, cell => cell.textContent.trim()).slice(-2)
    ),
    [
      ["1500", "3"],
      ["1200", "0"],
      ["1100", "—"]
    ]
  );

  canManageUsers = true;
  await render(await route({ query: { view: "active" } }));
  assert.equal(document.querySelector("thead th:last-child").textContent.trim(), ".rating");
  assert.equal(document.querySelector("tbody td:last-child").textContent.trim(), "1500");
});

test("judge settings put the Hack profile after the ordinary editor and save both source fields", async t => {
  const { React, el, mocks, render, click, button } = await fixture(t);
  const filepath = name => path.resolve(__dirname, "../src", name);
  const languages = loadModule(filepath("interfaces/CodeLanguage.ts"), mocks);
  const writes = [];
  const reads = [];
  const profileMock = {
    profile: async request => {
      reads.push(request);
      return {
        response: {
          problemId: 12,
          enabled: true,
          inputLimit: 1048576,
          validator: { language: "cpp", code: "validator", compileAndRunOptions: { std: "c++14" } },
          reference: { language: "cpp", code: "reference", compileAndRunOptions: { compiler: "g++" } }
        }
      };
    },
    saveProfile: async request => {
      writes.push(request);
      return { response: { success: true } };
    }
  };
  const settings = loadModule(filepath("hack/HackSettings.tsx"), {
    ...mocks,
    "@/interfaces/CodeLanguage": languages,
    "./api": { hackApi: profileMock }
  });
  const editor = label =>
    Object.assign(() => el("div", null, label), {
      parseJudgeInfo: value => value,
      normalizeJudgeInfo() {}
    });
  const problem = {
    meta: { id: 12, type: "Traditional", submissionMethod: "Local" },
    permissionOfCurrentUser: ["Modify"],
    submittable: true,
    judgeInfo: {},
    testData: []
  };
  const routes = loadModule(filepath("pages/problem/judge-settings/ProblemJudgeSettingsPage.tsx"), {
    ...mocks,
    "@/api": { __esModule: true, default: { problem: { getProblem: async () => ({ response: { ...problem } }) } } },
    "@/utils/hooks": {
      ...mocks["@/utils/hooks"],
      useNavigationChecked: () => ({}),
      useConfirmNavigation: () => [false, () => {}],
      useDialog: () => ({})
    },
    "@/remote-judge/SubmissionMethodSettings": { default: () => el("p", null, "submission-method"), __esModule: true },
    "@/hack/HackSettings": settings,
    "@/remote-judge/api": { isRemoteProblem: meta => meta.submissionMethod !== "Local" },
    "@/components/CodeBox": { HighlightedCodeBox: () => el("div", null, "yaml-preview") },
    "@/components/LazyCodeEditor": { default: () => null, __esModule: true },
    "@/AppRouter": { defineRoute: load => load, RouteError: Error },
    "@/interfaces/ProblemType": { ProblemType: { Traditional: "Traditional", Interaction: "Interaction" } },
    "../utils": { getProblemIdString: () => "P12", getProblemUrl: () => "/p/12" },
    "./types/TraditionalProblemEditor": { default: editor("ordinary-settings"), __esModule: true },
    "./types/InteractionProblemEditor": { default: editor("interaction-settings"), __esModule: true }
  }).default;
  await render(await routes.byId({ params: { id: "12" } }));
  assert.match(document.body.textContent, /submission-method.*yaml-preview.*ordinary-settings.*\.settings/);
  assert.deepEqual(reads, [{ id: 12 }]);
  const validator = document.querySelector('textarea[aria-label=".validator"]');
  const reference = document.querySelector('textarea[aria-label=".reference"]');
  assert.equal(validator.value, "validator");
  assert.equal(reference.value, "reference");
  assert.equal(document.getElementById(validator.getAttribute("aria-describedby")).textContent, ".validator_exit");
  const language = document.querySelector('[aria-label=".reference · .code_language"]');
  const python = [...language.querySelectorAll(".menu .item")].find(item => item.textContent === ".python.name");
  await click(python);
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(validator, "updated");
    validator.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await click(button(".save"));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].inputLimit, 1048576);
  assert.deepEqual(writes[0].validator, { language: "cpp", code: "updated", compileAndRunOptions: { std: "c++14" } });
  assert.equal(writes[0].reference.language, "python");
  assert.equal(writes[0].reference.code, "reference");

  problem.permissionOfCurrentUser = ["View"];
  await render(await routes.byId({ params: { id: "12" } }));
  assert.doesNotMatch(document.body.textContent, /\.settings/);
  problem.permissionOfCurrentUser = ["Modify"];
  problem.meta.type = "Interaction";
  await render(await routes.byDisplayId({ params: { displayId: "12" } }));
  assert.match(document.body.textContent, /interaction-settings/);
  assert.doesNotMatch(document.body.textContent, /\.settings/);
  problem.meta.submissionMethod = "Codeforces";
  await render(await routes.byDisplayId({ params: { displayId: "12" } }));
  assert.equal(document.body.textContent, "submission-method");
  assert.deepEqual(reads, [{ id: 12 }]);
});

test("My Hacks opens from the last menu item and puts counterexample input after the record details", async t => {
  const { el, panel, api, render, click, button } = await fixture(t);
  const { Menu } = require("semantic-ui-react");
  const mineCalls = [];
  api.mine = async request => {
    mineCalls.push(request);
    if (request.id) return { response: [{ input: "1\n  2\n" }] };
    return {
      response: [{ id: 88, targetSubmissionId: 31, state: "InvalidInput", createdAt: "2026-11-27T00:00:00Z" }]
    };
  };
  await render(
    el(
      Menu,
      { vertical: true },
      el(Menu.Item, { content: "submit" }),
      el(Menu.Item, { content: "submissions" }),
      el(Menu.Item, { content: "files" }),
      el(panel.MyHacksMenuItem, { problemId: 12 })
    )
  );
  const menuItem = button(".mine");
  assert.equal(menuItem, document.querySelector(".menu").lastElementChild);
  assert.equal(document.querySelectorAll(".menu .item").length, 4);
  assert.equal(mineCalls.length, 0);
  await click(menuItem);
  const header = document.querySelector(".modal .hack-record-header");
  assert.match(header.firstElementChild.textContent, /#88 \/ #31/);
  assert.equal(header.lastElementChild.className, "hack-record-actions");
  const inputButton = header.lastElementChild.querySelector("button");
  assert.equal(inputButton.textContent, ".input");
  await click(inputButton);
  assert.deepEqual(mineCalls, [{}, { id: 88 }]);
  assert.equal(document.querySelector(".modal pre").textContent, "1\n  2\n");
  await click(button(".close"));
  assert.equal(document.querySelector(".modal pre"), null);
});

test("Hack history puts both authorized download buttons after the record details on the same row", async t => {
  const { el, panel, api, target, render, click } = await fixture(t);
  const requests = [];
  api.history = async () => ({
    response: [
      { id: 88, state: "Failed", createdAt: target.time, canDownload: true },
      { id: 87, state: "InvalidInput", createdAt: target.time, canDownload: false }
    ]
  });
  api.download = async request => {
    requests.push(request);
    return { response: { files: [] } };
  };

  await render(el(panel.HackHistory, { id: target.id, onChange() {} }));
  const [downloadable, invalid] = document.querySelectorAll(".hack-record-header");
  assert.match(downloadable.firstElementChild.textContent, /#88.*\.state\.Failed/);
  assert.equal(downloadable.firstElementChild.className, "hack-record-details");
  const downloads = downloadable.lastElementChild;
  assert.equal(downloads.className, "hack-record-actions");
  const [input, output] = downloads.querySelectorAll("button");
  assert.deepEqual([input.textContent, output.textContent], [".download_input", ".download_output"]);
  assert.equal(invalid.querySelector("button"), null);

  await click(input);
  await click(output);
  assert.deepEqual(requests, [
    { id: 88, input: true, output: false },
    { id: 88, input: false, output: true }
  ]);
});

test("submission details honor the server decision and only eligible ACs show the Hack form", async t => {
  const { el, panel, api, target, mocks, render, button } = await fixture(t);
  const requests = [];
  let authorized = false;
  api.target = async request => {
    requests.push(request);
    return { response: { target: authorized ? { ...target, inputLimit: 100 } : null } };
  };
  const routes = loadModule(path.resolve(__dirname, "../src/pages/submission/submission/SubmissionPage.tsx"), {
    ...mocks,
    "@/api": {
      default: { submission: { getSubmissionDetail: async () => ({ response: { error: "PERMISSION_DENIED" } }) } },
      __esModule: true
    },
    "@/AppRouter": { defineRoute: load => load, RouteError: Error },
    "@/hack/api": { hackApi: api },
    "@/hack/HackPanel": panel,
    "@/locales": { makeToBeLocalizedText: key => key },
    "../componments/SubmissionItem": {},
    "../common": {}
  });
  await assert.rejects(routes.default({ params: { id: "31" } }), /PERMISSION_DENIED/);
  await assert.rejects(routes.contest({ params: { id: "45", sid: "31" } }), /PERMISSION_DENIED/);
  assert.deepEqual(requests, []);

  const props = { id: target.id, contestId: 45 };
  await render(el(panel.HackSubmissionPanel, { ...props, eligible: false }));
  assert.deepEqual(requests, []);
  assert.equal(document.querySelector("form"), null);
  await render(el(panel.HackSubmissionPanel, { ...props, eligible: true }));
  assert.deepEqual(requests, [{ id: target.id, contestId: 45 }]);
  assert.equal(document.querySelector("form"), null);

  authorized = true;
  await render(el(panel.HackSubmissionPanel, { ...props, eligible: true, key: "authorized-account" }));
  assert.ok(button(".send"));
});

test("Hack input preserves whitespace by default and uses cleaned bytes only when selected", async t => {
  const { el, panel, api, target, render, click, button, setInput } = await fixture(t);
  const input = " \n  é  \t 2 \n \n 3   4  \n\n ";
  const cleaned = "é 2\n3 4\n";
  const writes = [];
  api.create = async request => {
    writes.push(request);
    return { response: { id: 88, targetSubmissionId: target.id, state: "Queued", createdAt: target.time } };
  };

  await render(el(panel.HackSubmissionPanel, { key: "preserve", id: target.id, eligible: true }));
  assert.equal(document.querySelector("#hack-clean-whitespace").checked, false);
  assert.equal(document.querySelectorAll('input[type="checkbox"], input[type="radio"]').length, 1);
  await setInput(input);
  assert.match(document.body.textContent, new RegExp(`${Buffer.byteLength(input)}/100`));
  await click(button(".send"));
  assert.deepEqual(writes, [{ id: target.id, input }]);
  assert.equal(button(".send").disabled, true);
  assert.match(document.body.textContent, /state\.Queued/);

  const limit = Buffer.byteLength(cleaned);
  api.target = async () => ({ response: { target: { ...target, inputLimit: limit } } });
  await render(el(panel.HackSubmissionPanel, { key: "clean", id: target.id, eligible: true }));
  await setInput(input);
  assert.equal(button(".send").disabled, true);
  const checkboxLabel = document.querySelector('label[for="hack-clean-whitespace"]');
  await click(checkboxLabel);
  assert.equal(document.querySelector("#hack-clean-whitespace").checked, true);
  assert.equal(document.querySelector("textarea").value, input);
  assert.match(document.body.textContent, new RegExp(`${limit}/${limit}`));
  assert.equal(button(".send").disabled, false);
  await click(checkboxLabel);
  assert.equal(button(".send").disabled, true);
  await click(checkboxLabel);
  await click(button(".send"));
  assert.deepEqual(writes[1], { id: target.id, input: cleaned });
});
