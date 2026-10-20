const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const Module = require("node:module");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");

test("site settings display the saved threshold, validate input and save a configurable value", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://nsoj.test/", pretendToBeVisual: true });
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
  let saved;
  let savedSession;
  let sessionUpdates = 0;
  const state = { enterNewPage() {}, locale: "zh-CN" };
  global.__siteSettingsTest = {
    state,
    remoteStatus: {
      atcoderSessionConfigured: true,
      atcoderSessionSource: "site",
      atcoderSessionStatus: "expired",
      atcoderSessionLastCheckedAt: "2026-10-21T00:00:00Z"
    },
    updatePreference: async request => {
      saved = request;
      return { response: { preference: request.preference } };
    },
    updateRemoteSettings: async request => {
      savedSession = request;
      sessionUpdates++;
      return {
        response: {
          settings: {
            atcoderSessionConfigured: !request.clearAtcoderSession,
            atcoderSessionSource: request.clearAtcoderSession ? "none" : "site"
          }
        }
      };
    }
  };
  const remoteMock =
    "exports.remoteAdminApi={getSettings:async()=>({response:{settings:global.__siteSettingsTest.remoteStatus}}),updateSettings:request=>global.__siteSettingsTest.updateRemoteSettings(request)};";
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
  mocks["@/remote-judge/admin-api"] = remoteMock;
  mocks["./admin-api"] = remoteMock;
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
          },
          remoteJudgeSettings: global.__siteSettingsTest.remoteStatus
        })
      )
    );
    const input = container.querySelector('input[type="number"]');
    assert.match(container.querySelector('[role="alert"]').textContent, /atcoder_session_expired/);
    assert.ok(container.querySelector('a[href="https://atcoder.jp/login"]'));
    assert.match(container.textContent, /atcoder_session_checked_at/);
    global.__siteSettingsTest.remoteStatus = {
      ...global.__siteSettingsTest.remoteStatus,
      atcoderSessionStatus: "unavailable",
      atcoderSessionError: "REMOTE_RATE_LIMITED"
    };
    await React.act(async () => document.dispatchEvent(new window.Event("visibilitychange")));
    assert.match(container.querySelector('[role="alert"]').textContent, /atcoder_session_unavailable/);
    assert.doesNotMatch(container.textContent, /atcoder_session_expired/);
    global.__siteSettingsTest.remoteStatus = {
      ...global.__siteSettingsTest.remoteStatus, atcoderSessionStatus: "valid", atcoderSessionError: undefined
    };
    await React.act(async () => document.dispatchEvent(new window.Event("visibilitychange")));
    assert.ok(container.querySelector(".positive.message"));
    assert.equal(container.querySelector('[role="alert"]'), null);
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
    const sessionInput = container.querySelector('input[type="password"]');
    const saveSession = [...container.querySelectorAll("button")].find(
      button => button.textContent === ".atcoder_session_save"
    );
    const clearSession = [...container.querySelectorAll("button")].find(
      button => button.textContent === ".atcoder_session_clear"
    );
    assert.equal(sessionInput.value, "");
    assert.doesNotMatch(container.textContent, /atcoder_session_expired/);
    assert.equal(saveSession.disabled, true);
    assert.equal(clearSession.disabled, false);
    async function changeSession(value) {
      await React.act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(sessionInput, value);
        sessionInput.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
    }
    await changeSession("invalid; extra=cookie");
    assert.equal(saveSession.disabled, true);
    await changeSession(" REVEL_SESSION=test-session-new ");
    assert.equal(saveSession.disabled, false);
    await React.act(async () => saveSession.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
    assert.deepEqual(savedSession, { atcoderSession: "test-session-new" });
    assert.equal(sessionInput.value, "");
    assert.doesNotMatch(container.innerHTML, /test-session-new/);
    assert.doesNotMatch(JSON.stringify(state.serverPreference), /test-session-new|atcoderSession/);
    assert.equal(sessionUpdates, 1);
    await React.act(async () => button.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
    assert.equal(sessionUpdates, 1);
    await React.act(async () => clearSession.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
    assert.deepEqual(savedSession, { clearAtcoderSession: true });
    assert.equal(sessionUpdates, 2);
    assert.equal(clearSession.disabled, true);
    assert.match(container.textContent, /atcoder_session_missing/);
  } finally {
    await React.act(async () => root.unmount());
    delete global.__siteSettingsTest;
    dom.window.close();
  }
});
