const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const Module = require("node:module");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");

test("site settings display the saved threshold, validate input and save a configurable value", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://nsoj.test/", pretendToBeVisual: true });
  Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
  Object.assign(global, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT: true
  });
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  let saved;
  const state = { enterNewPage() {}, locale: "zh-CN" };
  global.__siteSettingsTest = {
    state,
    updatePreference: async request => {
      saved = request;
      return { response: { preference: request.preference } };
    }
  };
  const mocks = {
    "@/api":
      "export default {siteSetting:{updatePreference:request=>global.__siteSettingsTest.updatePreference(request)}};",
    "@/AppRouter": "exports.defineRoute=route=>route; exports.RouteError=Error;",
    "@/appState": "exports.appState=global.__siteSettingsTest.state;",
    "@/locales": "exports.makeToBeLocalizedText=text=>text;",
    "@/utils/hooks": "exports.useLocalizer=()=>key=>key;",
    "@/utils/toast": "export default {success(){},error(){}};",
    "mobx-react": "exports.observer=component=>component;"
  };
  const result = await esbuild.build({
    stdin: {
      contents:
        fs
          .readFileSync(path.resolve(__dirname, "../src/pages/site-settings/index.tsx"), "utf8")
          .split("export default defineRoute")[0] + "\nexport {SiteSettingsPage};",
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
        name: "test-boundaries",
        setup(build) {
          build.onResolve({ filter: /.*/ }, args =>
            mocks[args.path] ? { path: args.path, namespace: "mock" } : undefined
          );
          build.onLoad({ filter: /.*/, namespace: "mock" }, args => ({ contents: mocks[args.path], loader: "js" }));
        }
      }
    ]
  });
  const compiled = new Module(__filename, module);
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, __filename);
  const container = document.getElementById("root");
  const root = createRoot(container);
  try {
    await React.act(async () =>
      root.render(
        React.createElement(compiled.exports.SiteSettingsPage, {
          preference: {
            security: {
              allowRegister: true,
              hideSubmissionTestcaseDetailsForNormalUsers: false,
              otherSubmissionCodeMinAcceptedProblems: 450
            }
          }
        })
      )
    );
    const input = container.querySelector('input[type="number"]');
    assert.equal(container.querySelector("#atcoder-sync-session"), null);
    assert.equal(container.querySelector('a[href="https://atcoder.jp/login"]'), null);
    const button = container.querySelector("button");
    assert.equal(input.value, "450");
    async function change(value) {
      await React.act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
    }
    for (const value of ["", "-1", "0.5"]) {
      await change(value);
      assert.equal(button.disabled, true);
    }
    for (const value of ["0", "600"]) {
      await change(value);
      assert.equal(button.disabled, false);
      await React.act(async () => button.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
      assert.equal(saved.preference.security.otherSubmissionCodeMinAcceptedProblems, Number(value));
      assert.equal(saved.preference.security.allowRegister, true);
      assert.equal(state.serverPreference.security.otherSubmissionCodeMinAcceptedProblems, Number(value));
    }
  } finally {
    await React.act(async () => root.unmount());
    delete global.__siteSettingsTest;
    dom.window.close();
  }
});
