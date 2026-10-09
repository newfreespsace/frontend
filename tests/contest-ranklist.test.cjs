const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");
const { renderToStaticMarkup } = require("react-dom/server");
const { JSDOM } = require("jsdom");

function loadModule(code, filename) {
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  mod._compile(code, filename);
  return mod.exports;
}

const helperPath = path.resolve(__dirname, "../src/pages/contest/ranklist/ranklistScore.ts");
const { getFirstSolvedRows } = loadModule(
  esbuild.transformSync(fs.readFileSync(helperPath, "utf8"), { loader: "ts", format: "cjs" }).code,
  helperPath
);
const contest = { id: 1, title: "ACM", type: "acm", startTime: "2026-10-09T01:00:00Z" };
const problems = [{ meta: { id: 101 } }, { meta: { id: 102 } }];

function accepted(submissionId, acceptedTime, contestPhase = "official") {
  return {
    accepted: true,
    acceptedTime,
    submissionId,
    unacceptedCount: 1,
    submissions: { [submissionId]: { submissionId, time: acceptedTime, accepted: true, contestPhase } }
  };
}

function row(userId, scoreDetails) {
  return { user: { id: userId }, rank: userId, score: 1, timeSpent: 1800, scoreDetails };
}

const earlier = accepted(10, "2026-10-09T01:10:00Z");
const later = accepted(20, "2026-10-09T01:20:00Z");

test("each problem chooses its earliest AC rather than the highest-ranked player", () => {
  const rows = [row(1, { 101: later, 102: earlier }), row(2, { 101: earlier, 102: later })];
  assert.deepEqual(getFirstSolvedRows(contest, problems, rows), { 101: 1, 102: 0 });
});

test("equal timestamps use submission IDs regardless of row order", () => {
  const rows = [row(1, { 101: accepted(20, earlier.acceptedTime) }), row(2, { 101: earlier })];
  for (const ordered of [rows, [...rows].reverse()]) {
    const index = getFirstSolvedRows(contest, problems, ordered)[101];
    assert.equal(ordered[index].user.id, 2);
  }
});

test("unsolved cells and missing or invalid acceptance times cannot win", () => {
  const rows = [
    row(1, { 101: { accepted: false, acceptedTime: "2026-10-09T01:01:00Z" } }),
    row(2, { 101: { accepted: true } }),
    row(3, { 101: accepted(3, "invalid") }),
    row(4, { 101: earlier })
  ];
  assert.deepEqual(getFirstSolvedRows(contest, problems, rows), { 101: 3, 102: -1 });
  assert.deepEqual(getFirstSolvedRows(contest, problems, []), { 101: -1, 102: -1 });
});

test("rejudging or removing an AC moves the marker to the next accepted player", () => {
  const rows = [row(1, { 101: earlier }), row(2, { 101: later })];
  assert.equal(getFirstSolvedRows(contest, problems, rows)[101], 0);
  rows[0].scoreDetails[101] = { ...earlier, accepted: false };
  assert.equal(getFirstSolvedRows(contest, problems, rows)[101], 1);
  delete rows[0].scoreDetails[101];
  assert.equal(getFirstSolvedRows(contest, problems, rows)[101], 1);
});

test("first solves are calculated separately from the rows of each ranklist scope", () => {
  const officialRows = [row(1, { 102: earlier })];
  const combinedRows = [
    row(1, { 102: earlier }),
    row(2, { 101: accepted(30, "2026-10-09T05:00:00Z", "post_contest") })
  ];
  assert.equal(getFirstSolvedRows(contest, problems, officialRows)[101], -1);
  assert.equal(getFirstSolvedRows(contest, problems, combinedRows)[101], 1);
});

test("IOI and NOI continue to highlight full scores using the selected submission time", () => {
  const rows = [row(1, { 101: { ...earlier, score: 99 } }), row(2, { 101: { ...later, score: 100 } })];
  for (const type of ["ioi", "noi"]) {
    assert.equal(getFirstSolvedRows({ ...contest, type }, problems, rows)[101], 1);
  }
});

const pagePromise = esbuild
  .build({
    entryPoints: [path.resolve(__dirname, "../src/pages/contest/ranklist/ContestRanklistPage.tsx")],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    packages: "external",
    plugins: [
      {
        name: "ranklist-test-dependencies",
        setup(build) {
          const mocks = {
            "@/api":
              "export default { contest: { getContestRanklist: async () => ({ response: globalThis.__ranklistResponse }) } };",
            "@/appState": 'export const appState = {locale: "zh_CN", enterNewPage() {}};',
            "@/AppRouter": "export const defineRoute = route => route; export class RouteError extends Error {}",
            "@/locales": "export const makeToBeLocalizedText = text => text;",
            "@/utils/hooks": `import React from "react";
            export const useLocalizer = () => key => key;
            export const Link = ({children, ...props}) => React.createElement("a", props, children);`,
            "@/components/UserLink": `import React from "react";
            export default ({user}) => React.createElement("a", {href: "/u/" + user.id}, "User " + user.id);`,
            "@/components/ScoreText": `import React from "react";
            export default ({score, children}) => React.createElement("span", null, children ?? score);`,
            "mobx-react": "export const observer = component => component;"
          };
          build.onResolve({ filter: /.*/ }, args => {
            if (Object.hasOwn(mocks, args.path)) return { path: args.path, namespace: "mock" };
            if (args.path.endsWith(".module.less")) return { path: args.path, namespace: "styles" };
            if (args.path === "react") return { path: args.path, external: true };
          });
          build.onLoad({ filter: /.*/, namespace: "mock" }, args => ({ contents: mocks[args.path], loader: "js" }));
          build.onLoad({ filter: /.*/, namespace: "styles" }, () => ({
            contents: "export default new Proxy({}, {get: (_, name) => name});",
            loader: "js"
          }));
        }
      }
    ]
  })
  .then(result => loadModule(result.outputFiles[0].text, path.resolve(__dirname, "ranklist.compiled.cjs")).default);

async function renderPage(rows, overrides = {}) {
  globalThis.__ranklistResponse = { meta: contest, problems, rows, ranklistScope: "official", ...overrides };
  const route = await pagePromise;
  const element = await route({ mountpath: "/ranklist", params: { id: "1" } });
  return new JSDOM(renderToStaticMarkup(element)).window.document;
}

test("ACM renders exactly one highlighted badge per solved problem and preserves submission links", async () => {
  const document = await renderPage([row(1, { 101: later }), row(2, { 101: earlier })]);
  const highlighted = document.querySelectorAll("td.firstSolved");
  assert.equal(highlighted.length, 1);
  assert.equal(highlighted[0].querySelector(".firstSolvedBadge").textContent, ".first_solved");
  assert.equal(highlighted[0].querySelector("a").getAttribute("href"), "/c/1/s/10");
  assert.equal(document.querySelectorAll(".firstSolvedBadge").length, 1);
  assert.ok(document.querySelector(".firstSolvedLegend"));
});

test("post-contest first-solve badges coexist with the post-contest result label", async () => {
  const document = await renderPage([row(1, { 101: accepted(30, later.acceptedTime, "post_contest") })], {
    ranklistScope: "combined"
  });
  const cell = document.querySelector("td.firstSolved");
  assert.ok(cell.querySelector(".firstSolvedBadge"));
  assert.equal(cell.querySelector(".label").textContent, ".post_contest_result");
});

test("empty ACM boards and other contest types have no ACM badge or legend", async () => {
  for (const document of [
    await renderPage([]),
    await renderPage([row(1, { 101: { ...earlier, score: 100 } })], { meta: { ...contest, type: "ioi" } })
  ]) {
    assert.equal(document.querySelector(".firstSolvedBadge"), null);
    assert.equal(document.querySelector(".firstSolvedLegend"), null);
  }
});
