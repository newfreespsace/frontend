const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");
const { JSDOM } = require("jsdom");

const dom = new JSDOM('<div id="root"></div><button id="outside">Outside</button>', {
  url: "https://nsoj.test/c/1/edit"
});
Object.assign(global, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true
});
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
const React = require("react");
const { act } = React;
const { Simulate } = require("react-dom/test-utils");
const { createRoot } = require("react-dom/client");
const ui = require("semantic-ui-react");
const container = document.getElementById("root");
let root;

function fixture() {
  const problems = [1, 2, 3].map(id => ({ meta: { id }, title: `Problem ${id}` }));
  const saved = [];
  const navigation = { navigate() {}, subscribe: () => ({ unsubscribe() {} }) };
  const messages = Object.fromEntries(
    ["contest_edit", "training"].map(name => [
      name,
      new Function(fs.readFileSync(path.resolve(__dirname, `../src/locales/messages/zh-CN/${name}.js`), "utf8"))()
    ])
  );
  const mocks = {
    "semantic-ui-react": ui,
    "mobx-react": { observer: component => component },
    "@/api": {
      problem: { queryProblemSet: async () => ({ response: { result: problems } }) },
      contest: {
        getContest: async () => ({
          response: {
            permissions: { manage: true },
            meta: { title: "Contest", startTime: "2026-11-13T01:00:00Z", endTime: "2026-11-13T03:00:00Z" },
            problems: problems.slice(0, 2)
          }
        }),
        saveContest: async request => {
          saved.push(request);
          return { response: { contestId: 1 } };
        }
      }
    },
    "@/appState": {
      appState: { locale: "zh-CN", enterNewPage() {}, serverPreference: { pagination: { searchProblemsPreview: 10 } } }
    },
    "@/AppRouter": { defineRoute: factory => factory, RouteError: Error },
    "@/locales": { makeToBeLocalizedText: key => key },
    "@/utils/hooks": {
      Link: React.forwardRef(({ children }, ref) => React.createElement("a", { ref }, children)),
      useLocalizer: scope => key => messages[scope]?.[key.replace(/^\./, "")] || key,
      useNavigationChecked: () => navigation,
      useScreenWidthWithin: () => false,
      useAsyncCallbackPending: callback => [false, callback]
    },
    "@/utils/toast": { error: assert.fail },
    "@/components/UserSearch": () => null,
    "@/components/UserLink": () => null,
    "@/components/GroupSearch": () => null,
    "@/pages/problem/utils": { getProblemDisplayName: (meta, title) => title },
    "./EmojiRenderer": { EmojiRenderer: ({ children }) => children }
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    vm.runInNewContext(transformSync(fs.readFileSync(filename, "utf8"), { loader: "tsx", format: "cjs" }).code, {
      module,
      console,
      require: name => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name.endsWith(".less")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
        if (name.startsWith(".") || name.startsWith("@/")) {
          const base = name.startsWith("@/")
            ? path.resolve(__dirname, "../src", name.slice(2))
            : path.resolve(path.dirname(filename), name);
          return load([base, `${base}.tsx`, `${base}.ts`].find(candidate => fs.existsSync(candidate)));
        }
        return require(name);
      }
    });
    cache.set(filename, module.exports);
    return module.exports;
  }
  const route = load(path.resolve(__dirname, "../src/pages/contest/edit/ContestEditPage.tsx")).default;
  return { route, saved, load };
}

afterEach(async () => {
  await act(async () => root?.unmount());
});

async function renderPage() {
  const f = fixture();
  root = createRoot(container);
  await act(async () => root.render(await f.route({ params: { id: "1" } })));
  return f;
}

async function click(element) {
  assert.ok(element, "click target exists");
  await act(async () => {
    element.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true }));
    element.click();
  });
}

async function search(input, value) {
  await act(async () => {
    input.focus();
    Simulate.change(input, { target: { value } });
  });
  await act(async () => new Promise(resolve => setTimeout(resolve, 550)));
}

const results = () => [...container.querySelectorAll(".ui.search .result")];
const rows = () => [...container.querySelectorAll(".listItem")];
const visible = () => !!container.querySelector(".ui.search .results.visible");

test("contest selection stays open, marks chosen problems, and updates after removal", async () => {
  await renderPage();
  const input = container.querySelector(".ui.search input");
  await search(input, "Problem");
  assert.equal(visible(), true);
  assert.deepEqual(
    results().map(result => !!result.querySelector(".green.check.icon")),
    [true, true, false]
  );

  await click(results()[2]);
  assert.equal(visible(), true);
  assert.equal(input.value, "Problem");
  assert.equal(document.activeElement, input);
  assert.equal(rows().length, 3);
  assert.ok(results()[2].querySelector(".green.check.icon"));
  await click(results()[2]);
  assert.equal(rows().length, 3);
  await act(async () => {
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  await act(async () => {
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  assert.equal(visible(), true);
  assert.equal(input.value, "Problem");
  assert.equal(rows().length, 3);

  await click(rows()[1].querySelector("button > .trash.icon").parentElement);
  await click(input);
  assert.equal(results()[1].querySelector(".green.check.icon"), null);
  await click(results()[1]);
  assert.equal(rows().length, 3);

  await act(async () => input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(visible(), false);
  await click(input);
  assert.equal(visible(), true);
  await act(async () => document.getElementById("outside").focus());
  assert.equal(visible(), false);
  await search(input, "");
  assert.equal(visible(), false);
});

test("contest problems move one position and save in the displayed order", async () => {
  const f = await renderPage();
  assert.equal(rows()[0].querySelector('[title="上移"]').disabled, true);
  assert.equal(rows()[1].querySelector('[title="下移"]').disabled, true);
  await click(rows()[1].querySelector('[title="上移"]'));
  assert.deepEqual(
    rows().map(row => row.querySelector(".problemTitle").textContent),
    ["A. Problem 2", "B. Problem 1"]
  );
  await click(rows()[0].querySelector('[title="下移"]'));
  assert.deepEqual(
    rows().map(row => row.querySelector(".problemTitle").textContent),
    ["A. Problem 1", "B. Problem 2"]
  );
  await click(rows()[1].querySelector('[title="上移"]'));
  assert.equal(f.saved.length, 0);
  await click(container.querySelector(".formActions .primary.button"));
  assert.deepEqual([...f.saved[0].problemIds], [2, 1]);
});

test("ordinary preview searches still close after selection", async () => {
  const f = fixture();
  const PreviewSearch = f.load(path.resolve(__dirname, "../src/components/PreviewSearch.tsx")).default;
  root = createRoot(container);
  await act(async () =>
    root.render(
      React.createElement(PreviewSearch, {
        placeholder: "Search",
        noResultsMessage: "None",
        onGetResultKey: item => item.id,
        onSearch: async () => [{ id: 1, title: "Result" }],
        onRenderResult: item => item.title,
        onResultSelect() {}
      })
    )
  );
  await search(container.querySelector("input"), "Result");
  assert.equal(visible(), true);
  await click(results()[0]);
  assert.equal(visible(), false);
});
