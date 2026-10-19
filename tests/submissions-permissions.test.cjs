const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const Module = require("node:module");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");

test("qualified ordinary users see others' submission rows and can clear the personal submission filter", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://nsoj.test/s" });
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
  const state = {
    enterNewPage() {},
    currentUser: { id: 3, username: "viewer", isAdmin: false },
    serverPreference: { pagination: { submissions: 20 } }
  };
  const context = {
    state,
    mobile: false,
    navigation: {
      navigate(value) {
        context.destination = value;
      }
    }
  };
  global.__submissionsTest = context;
  const mocks = {
    "@/api": "export default {};",
    "@/AppRouter": "exports.defineRoute=route=>route; exports.RouteError=Error;",
    "@/appState": "exports.appState=global.__submissionsTest.state;",
    "@/utils/hooks": `
      exports.useLocalizer=()=>key=>key;
      exports.useFieldCheckSimple=()=>[()=>true,null];
      exports.useSocket=()=>{};
      exports.useScreenWidthWithin=min=>min===0?global.__submissionsTest.mobile:!global.__submissionsTest.mobile;
      exports.useNavigationChecked=()=>global.__submissionsTest.navigation;
    `,
    "@/utils/toast": "export default {error(){}};",
    "@/components/StatusText": "export default ()=>null;",
    "@/components/Pagination": "exports.SimplePagination=()=>null;",
    "../componments/SubmissionItem": `
      const React=require('react');
      exports.SubmissionHeader=exports.SubmissionHeaderMobile=()=>React.createElement('tr',null,React.createElement('th',null,'submissions'));
      exports.SubmissionItem=exports.SubmissionItemMobile=({submission})=>React.createElement('tr',{'data-submitter':submission.submitter.username},React.createElement('td',null,submission.id));
    `,
    "mobx-react": "exports.observer=component=>component;"
  };
  const result = await esbuild.build({
    stdin: {
      contents:
        fs
          .readFileSync(path.resolve(__dirname, "../src/pages/submission/submissions/SubmissionsPage.tsx"), "utf8")
          .split("export default defineRoute")[0] + "\nexport {SubmissionsPage};",
      resolveDir: path.resolve(__dirname, "../src/pages/submission/submissions"),
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
          build.onResolve({ filter: /.*/ }, args => {
            if (mocks[args.path]) return { path: args.path, namespace: "mock" };
            if (/\.less$/.test(args.path)) return { path: args.path, namespace: "style" };
          });
          build.onLoad({ filter: /.*/, namespace: "mock" }, args => ({
            contents: mocks[args.path],
            loader: "js",
            resolveDir: path.resolve(__dirname, "..")
          }));
          build.onLoad({ filter: /.*/, namespace: "style" }, () => ({ contents: "export default {}", loader: "js" }));
        }
      }
    ]
  });
  const compiled = new Module(__filename, module);
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, __filename);
  const container = document.getElementById("root");
  const root = createRoot(container);
  const View = compiled.exports.SubmissionsPage;
  const render = async (key, query, permissionViewOthers) =>
    React.act(async () =>
      root.render(
        React.createElement(View, {
          key,
          query,
          canViewGroupSubmissions: false,
          queryResult: {
            permissionViewOthers,
            submissions: [{ id: 100, submitter: { id: 2, username: "other-user" }, status: "Accepted" }]
          }
        })
      )
    );
  try {
    for (const mobile of [false, true]) {
      context.mobile = mobile;
      await render(`qualified-${mobile}`, {}, true);
      assert.ok(container.querySelector('tr[data-submitter="other-user"]'));
      assert.ok(container.querySelector('input[placeholder=".query.submitter"]'));
    }
    await render("below-threshold", {}, false);
    assert.equal(container.querySelector('input[placeholder=".query.submitter"]'), null);
    context.mobile = false;
    await render("personal-filter", { submitter: "viewer" }, true);
    const input = container.querySelector('input[placeholder=".query.submitter"]');
    assert.equal(input.value, "viewer");
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, "");
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    const search = [...container.querySelectorAll("button")].find(button => button.textContent === ".query.filter");
    await React.act(async () => search.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
    assert.deepEqual(context.destination.query, {});
  } finally {
    await React.act(async () => root.unmount());
    delete global.__submissionsTest;
    dom.window.close();
  }
});
