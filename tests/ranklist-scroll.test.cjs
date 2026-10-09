const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");
const Module = require("node:module");
const fs = require("node:fs");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");
const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");

function load(code, filename) {
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  mod._compile(code, filename);
  return mod.exports;
}

const labelPath = path.resolve(__dirname, "../src/utils/contestProblemLabel.ts");
const { getContestProblemLabel } = load(
  esbuild.transformSync(fs.readFileSync(labelPath, "utf8"), { loader: "ts", format: "cjs" }).code,
  labelPath
);

test("problem labels stay consistent across alphabet boundaries", () => {
  assert.deepEqual([0, 25, 26, 51, 52, 701, 702].map(getContestProblemLabel), [
    "A",
    "Z",
    "AA",
    "AZ",
    "BA",
    "ZZ",
    "AAA"
  ]);
});

test("top and table scroll positions synchronize and adapt when the viewport or content changes", async () => {
  const dom = new JSDOM("<div id='mount'></div>", { url: "https://nsoj.test" });
  const saved = Object.fromEntries(
    ["window", "document", "ResizeObserver", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, global[key]])
  );
  global.window = dom.window;
  global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const observers = [];
  global.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.targets = [];
      observers.push(this);
    }
    observe(element) {
      this.targets.push(element);
    }
    disconnect() {
      this.disconnected = true;
    }
  };
  let contentWidth = 6176;
  let viewportWidth = 800;
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollWidth", {
    get() {
      return contentWidth;
    }
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", {
    get() {
      return viewportWidth;
    }
  });
  const filename = path.resolve(__dirname, "ranklist-scroll.compiled.cjs");
  const compiled = await esbuild.build({
    entryPoints: [path.resolve(__dirname, "../src/pages/contest/ranklist/RanklistScrollArea.tsx")],
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    write: false,
    plugins: [
      {
        name: "test-styles",
        setup(build) {
          build.onResolve({ filter: /\.module\.less$/ }, args => ({ path: args.path, namespace: "styles" }));
          build.onLoad({ filter: /.*/, namespace: "styles" }, () => ({
            contents: "export default new Proxy({}, {get: (_, name) => name});",
            loader: "js"
          }));
        }
      }
    ]
  });
  const ScrollArea = load(compiled.outputFiles[0].text, filename).default;
  const root = createRoot(document.getElementById("mount"));
  try {
    await act(async () =>
      root.render(
        React.createElement(
          ScrollArea,
          { scrollLabel: "Scroll problems", tableLabel: "Ranklist" },
          React.createElement("table")
        )
      )
    );
    let top = document.querySelector(".topScroll");
    const wrap = document.querySelector(".tableWrap");
    assert.ok(top, "wide tables should expose the top scrollbar");
    assert.equal(top.firstElementChild.style.width, "6176px");
    assert.equal(top.getAttribute("aria-label"), "Scroll problems");
    assert.equal(wrap.tabIndex, 0);
    assert.equal(observers[0].targets.length, 2, "measure both the viewport and the table");

    await act(async () => {
      top.scrollLeft = 900;
      top.dispatchEvent(new window.Event("scroll"));
    });
    assert.equal(wrap.scrollLeft, 900);
    await act(async () => {
      wrap.scrollLeft = 1200;
      wrap.dispatchEvent(new window.Event("scroll"));
    });
    assert.equal(top.scrollLeft, 1200);

    contentWidth = 1000;
    wrap.scrollLeft = 200;
    await act(async () => observers[0].callback());
    top = document.querySelector(".topScroll");
    assert.equal(top.firstElementChild.style.width, "1000px");
    assert.equal(top.scrollLeft, 200);

    viewportWidth = 1100;
    await act(async () => window.dispatchEvent(new window.Event("resize")));
    assert.equal(document.querySelector(".topScroll"), null, "hide the extra scrollbar when all columns fit");
    viewportWidth = 375;
    await act(async () => window.dispatchEvent(new window.Event("resize")));
    assert.ok(document.querySelector(".topScroll"));
  } finally {
    await act(async () => root.unmount());
    assert.ok(observers.every(observer => observer.disconnected));
    dom.window.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }
});
