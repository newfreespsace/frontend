const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");

test("an eligible target can be challenged without source access and pending work disables a second request", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://nsoj.test/p/12" });
  Object.assign(global, {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT: true
  });
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const sent = [];
  let rows = [];
  global.__hackFixture = {
    appState: { currentUser: { id: 4 } },
    hackApi: {
      targets: async () => ({
        response: {
          enabled: true,
          inputLimit: 1048576,
          targets: [{ id: 31, language: "cpp", time: "2026-11-27T00:00:00Z" }]
        }
      }),
      mine: async () => ({ response: rows }),
      create: async request => {
        sent.push(request);
        rows = [{ id: 88, targetSubmissionId: 31, state: "Queued", createdAt: "2026-11-27T00:00:00Z" }];
        return { response: rows[0] };
      }
    }
  };
  const filename = path.resolve(__dirname, "../src/hack/HackPanel.tsx");
  const source = esbuild.transformSync(fs.readFileSync(filename, "utf8"), { loader: "tsx", format: "cjs" }).code;
  const el = React.createElement;
  const container = ({ children }) => el("div", null, children);
  const Form = ({ children, onSubmit }) =>
    el(
      "form",
      {
        onSubmit: e => {
          e.preventDefault();
          onSubmit();
        }
      },
      children
    );
  Form.Dropdown = ({ value, options, onChange }) =>
    el("select", { value, onChange: e => onChange(e, { value: e.target.value }) }, [
      el("option", { value: "", key: "none" }, ""),
      ...options.map(option => el("option", { key: option.key, value: option.value }, option.text))
    ]);
  Form.TextArea = ({ value, onChange }) =>
    el("textarea", { value, onChange: e => onChange(e, { value: e.target.value }) });
  const mocks = {
    "semantic-ui-react": {
      Form,
      Button: ({ children, disabled, onClick, type }) => el("button", { disabled, onClick, type }, children),
      Header: ({ content }) => el("h3", null, content),
      Message: ({ content }) => el("p", null, content),
      Label: container,
      Segment: container
    },
    "@/appState": global.__hackFixture,
    "@/utils/hooks": { useLocalizer: () => key => key },
    "@/components/StatusText": { default: () => null, __esModule: true },
    "./api": global.__hackFixture
  };
  const localModule = new Module(filename, module);
  localModule.paths = module.paths;
  const nativeRequire = localModule.require.bind(localModule);
  localModule.require = name => mocks[name] || nativeRequire(name);
  localModule._compile(source, filename);
  const root = createRoot(document.getElementById("root"));
  try {
    await React.act(async () => root.render(el(localModule.exports.HackProblemPanel, { problemId: 12 })));
    const dropdown = document.querySelector("select");
    assert.match(dropdown.textContent, /#31/);
    assert.doesNotMatch(document.body.textContent, /source|author/);
    await React.act(async () => {
      dropdown.value = "31";
      dropdown.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    const send = [...document.querySelectorAll("button")].find(button => button.textContent === ".send");
    assert.equal(send.disabled, false);
    await React.act(async () => send.click());
    assert.deepEqual(sent, [{ id: 31, input: "" }]);
    assert.equal(send.disabled, true);
    assert.match(document.body.textContent, /state\.Queued/);
  } finally {
    await React.act(async () => root.unmount());
    delete global.__hackFixture;
    dom.window.close();
  }
});
