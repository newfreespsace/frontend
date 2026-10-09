const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");
const Module = require("node:module");
const fs = require("node:fs");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

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

test("the entire ranklist has one scroll container and no top scrollbar", async () => {
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
  const document = new JSDOM(
    renderToStaticMarkup(
      React.createElement(
        ScrollArea,
        { tableLabel: "Ranklist" },
        React.createElement(
          "table",
          null,
          React.createElement(
            "tbody",
            null,
            React.createElement(
              "tr",
              null,
              ...["Rank", "User", "Solved", "Penalty", "A", "B"].map(label =>
                React.createElement("td", { key: label }, label)
              )
            )
          )
        )
      )
    )
  ).window.document;
  const regions = document.querySelectorAll('[role="region"]');
  assert.equal(regions.length, 1);
  assert.equal(regions[0].getAttribute("aria-label"), "Ranklist");
  assert.equal(regions[0].tabIndex, 0);
  assert.equal(document.querySelector("table").parentElement, regions[0]);
  assert.equal(regions[0].querySelectorAll("td").length, 6);
  assert.equal(document.querySelector(".topScroll"), null);
});
