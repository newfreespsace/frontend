const assert = require("node:assert/strict");
const { test, before, beforeEach, afterEach } = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const Module = require("node:module");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="root"></div>', { url: "https://nsoj.test/" });
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
const { act } = React;
const { createRoot } = require("react-dom/client");
const { Accordion } = require("semantic-ui-react");
let root, PaginatedList, LazyAccordionContent, TestDataFileSelector, SubtasksEditor, SubmissionPage, detect;
const container = document.getElementById("root");
const mocks = {
  "@/utils/hooks": `
    exports.useLocalizer = () => key => key;
    exports.useScreenWidthWithin = () => true;
    exports.useSocket = () => {};
    exports.useNavigationChecked = () => ({});
    exports.useDialog = () => ({element:null,open:()=>{},close:()=>{}});
  `,
  "mobx-react": "exports.observer = component => component;",
  "@/appState": "exports.appState = {enterNewPage:()=>{},currentUser:{id:2}};",
  "@/api": "export default {};",
  "@/AppRouter": "exports.defineRoute = route => route; exports.RouteError = Error;",
  "@/locales": "exports.makeToBeLocalizedText = text => text;",
  "@/utils/CodeFormatter": "export const ready = Promise.resolve();",
  "@/utils/downloadFile": "export default () => {};",
  "@/utils/toast": "export default {};",
  "../componments/SubmissionItem":
    "exports.SubmissionHeader = exports.SubmissionItem = exports.SubmissionItemExtraRows = () => null;",
  "@/components/StatusText": "export default () => null;",
  "@/pages/problem/files/ProblemFilesPage": "exports.downloadProblemFile = () => {};",
  "@/utils/submissionCelebration":
    "exports.consumeSubmissionCelebration = () => false; exports.fireAcceptedSubmissionConfetti = () => {};",
  "@/components/CodeBox":
    "const React = require('react'); exports.OmittableAnsiCodeBox = props => props.ansiMessage ? React.createElement('pre',null,props.ansiMessage) : null;",
  "@/components/EmojiRenderer": "exports.EmojiRenderer = props => props.children;"
};
before(async () => {
  const result = await esbuild.build({
    stdin: {
      contents: `
        export {default as PaginatedList} from './src/components/PaginatedList';
        export {default as LazyAccordionContent} from './src/components/LazyAccordionContent';
        export {default as TestDataFileSelector} from './src/pages/problem/judge-settings/common/TestDataFileSelector';
        export {default as SubtasksEditor} from './src/pages/problem/judge-settings/common/SubtasksEditor';
        export * from './src/pages/problem/judge-settings/common/detect-testcases';
        export {SubmissionPage} from './src/pages/submission/submission/SubmissionPage';
      `,
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
          build.onResolve({ filter: /.*/ }, args => {
            if (mocks[args.path]) return { path: args.path, namespace: "mock" };
            if (/\.less$/.test(args.path)) return { path: args.path, namespace: "style" };
          });
          build.onLoad({ filter: /submission\/SubmissionPage\.tsx$/ }, args => ({
            contents:
              fs.readFileSync(args.path, "utf8").split("export default defineRoute")[0] + "\nexport {SubmissionPage};",
            loader: "tsx"
          }));
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
  ({ PaginatedList, LazyAccordionContent, TestDataFileSelector, SubtasksEditor, SubmissionPage } = compiled.exports);
  detect = compiled.exports;
});
beforeEach(() => {
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});
const render = async element => act(async () => root.render(element));
const click = async element => {
  assert.ok(element, "click target exists");
  await act(async () => element.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
};
const next = () => container.querySelector('.pagination [aria-label="Next item"]');
const file = filename => ({ filename, size: 32 });

test("10,000 testcases render only the current page with global numbering and clamp after deletion", async () => {
  const view = totalCount =>
    React.createElement(PaginatedList, {
      totalCount,
      renderRange: (start, end) =>
        React.createElement(
          "section",
          null,
          Array.from({ length: end - start }, (_, i) =>
            React.createElement("p", { key: start + i }, `testcase ${start + i + 1}`)
          )
        )
    });
  await render(view(10000));
  assert.equal(container.querySelectorAll("p").length, 50);
  await click(next());
  assert.equal(container.querySelector("p").textContent, "testcase 51");
  await render(view(51));
  assert.equal(container.querySelectorAll("p").length, 1);
  await render(view(50));
  assert.equal(container.querySelector("p").textContent, "testcase 1");
  await render(view(0));
  assert.equal(container.querySelectorAll("p").length, 0);
  assert.equal(container.querySelectorAll(".pagination").length, 0);
});

test("collapsed accordion never builds nested testcase lists or output boxes", async () => {
  let builds = 0;
  await render(
    React.createElement(Accordion, {
      panels: [
        {
          key: "subtask",
          title: "subtask",
          content: React.createElement(LazyAccordionContent, {
            renderContent: () => {
              builds++;
              return React.createElement("pre", null, "large output");
            }
          })
        }
      ]
    })
  );
  assert.equal(builds, 0);
  assert.equal(container.querySelector("pre"), null);
  await click(container.querySelector(".title"));
  assert.equal(builds, 1);
  assert.equal(container.querySelector("pre").textContent, "large output");
  await click(container.querySelector(".title"));
  assert.equal(container.querySelector("pre"), null);
});

test("file dropdown renders a bounded menu and searches files beyond the initial 100", async () => {
  const testData = Array.from({ length: 4000 }, (_, i) => file(`case-${i}.in`));
  let chosen;
  await render(
    React.createElement(TestDataFileSelector, {
      type: "ItemSearchDropdown",
      testData,
      value: "case-3999.in",
      placeholder: "file",
      onChange: value => {
        chosen = value;
      }
    })
  );
  assert.equal(container.querySelectorAll(".menu .item").length, 0);
  assert.match(container.querySelector(".text").textContent, /case-3999.in/);
  await click(container.querySelector(".dropdown"));
  assert.equal(container.querySelectorAll(".menu .item:not(.disabled)").length, 100);
  const input = container.querySelector("input.search");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, "case-3998");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  assert.equal(container.querySelectorAll(".menu .item:not(.disabled)").length, 1);
  await click(container.querySelector(".menu .item:not(.disabled)"));
  assert.equal(chosen, "case-3998.in");
});

function editorFixture(count) {
  let current;
  const options = {
    enableTimeMemoryLimit: true,
    enableInputFile: true,
    enableOutputFile: true,
    enableUserOutputFilename: false
  };
  const testData = Array.from({ length: count }, (_, i) => [file(`${i + 1}.in`), file(`${i + 1}.out`)]).flat();
  const raw = {
    subtasks: [
      { testcases: Array.from({ length: count }, (_, i) => ({ inputFile: `${i + 1}.in`, outputFile: `${i + 1}.out` })) }
    ]
  };
  function Editor() {
    const [info, setInfo] = React.useState(() => ({
      ...SubtasksEditor.parseJudgeInfo(raw, testData, options),
      timeLimit: 1000,
      memoryLimit: 256
    }));
    current = info;
    return React.createElement(SubtasksEditor, {
      options,
      judgeInfo: info,
      testData,
      onUpdateJudgeInfo: delta => setInfo(old => ({ ...old, ...delta }))
    });
  }
  return {
    Editor,
    get info() {
      return current;
    },
    options
  };
}

test("all manual testcases stay visible while editing and moving beyond the former page boundary", async () => {
  const fixture = editorFixture(98);
  await render(React.createElement(fixture.Editor));
  assert.equal(container.querySelectorAll(".item.selection.dropdown").length, 196);
  assert.equal(container.querySelectorAll(".pagination").length, 0);
  assert.match(container.textContent, /#21/);
  const clock = container.querySelectorAll(".clock.icon")[21].parentElement.querySelector("input");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(clock, "2345");
    clock.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  assert.equal(fixture.info.subtasks[0].testcases[20].timeLimit, 2345);
  assert.equal(fixture.info.subtasks[0].testcases[0].timeLimit, null);
  const move = [...container.querySelectorAll(".dropdown .menu .item")].filter(
    el => el.textContent === ".subtasks.testcase_options.move_up"
  )[20];
  await click(move);
  assert.equal(fixture.info.subtasks[0].testcases[19].inputFile, "21.in");
  assert.equal(container.querySelectorAll(".pagination").length, 0);
  assert.match(container.textContent, /#98/);
  const normalized = JSON.parse(JSON.stringify(fixture.info));
  SubtasksEditor.normalizeJudgeInfo(normalized, fixture.options);
  assert.equal(normalized.subtasks[0].testcases.length, 98);
  assert.equal(normalized.subtasks[0].testcases[97].inputFile, "98.in");
  assert.equal(normalized.subtasks[0].testcases[19].uuid, undefined);
});

test("automatic detection preserves optional files, case-insensitive matching, output priority and natural ordering", () => {
  const files = ["10.OUT", "2.ans", "2.out", "2.IN", "10.in", "3.in", "4.ans"].map(file);
  assert.deepEqual(detect.detectTestcasesByMatchingInputToOutput(files), [
    { inputFile: "2.IN", outputFile: "2.ans" },
    { inputFile: "10.in", outputFile: "10.OUT" }
  ]);
  assert.deepEqual(detect.detectTestcasesByMatchingInputToOutput(files, true), [
    { inputFile: "2.IN", outputFile: "2.ans" },
    { inputFile: "3.in", outputFile: undefined },
    { inputFile: "10.in", outputFile: "10.OUT" }
  ]);
  assert.equal(detect.detectTestcasesByMatchingOutputToInput(files).length, 3);
  assert.equal(detect.detectTestcasesByMatchingOutputToInput(files, true).length, 4);
  const large = Array.from({ length: 10000 }, (_, i) => [file(`${i}.in`), file(`${i}.out`)]).flat();
  assert.equal(detect.detectTestcasesByMatchingInputToOutput(large).length, 10000);
});

test("submission page renders all 98 results and mounts only the opened output", async () => {
  const testcaseResult = {};
  const testcases = Array.from({ length: 98 }, (_, i) => {
    const hash = `hash-${i}`;
    testcaseResult[hash] = {
      status: "Accepted",
      score: 1,
      time: 1,
      memory: 1,
      testcaseInfo: { timeLimit: 1000, memoryLimit: 256 },
      input: `input ${i + 1}`,
      output: `output ${i + 1}`
    };
    return { testcaseHash: hash };
  });
  const View = props => props.getSubtasksView(() => null);
  await render(
    React.createElement(SubmissionPage, {
      meta: { id: 1, status: "Accepted", submitter: { id: 2 } },
      content: {},
      progress: { progressType: "Finished", testcaseResult, subtasks: [{ testcases, score: 100, fullScore: 100 }] },
      ProblemTypeSubmissionView: View
    })
  );
  assert.equal(container.querySelectorAll(".title").length, 98);
  assert.equal(container.querySelectorAll(".pagination").length, 0);
  assert.match(container.querySelectorAll(".title")[97].textContent, /#98/);
  assert.equal(container.querySelectorAll("pre").length, 0);
  await click(container.querySelector(".title"));
  assert.equal(container.querySelectorAll("pre").length, 2);
  assert.match(container.textContent, /input 1/);
  await click(container.querySelectorAll(".title")[97]);
  assert.equal(container.querySelectorAll("pre").length, 2);
  assert.match(container.textContent, /input 98/);
});

test("automatic testcase preview shows every detected testcase without pagination", async () => {
  const testData = Array.from({ length: 98 }, (_, i) => [file(`${i + 1}.in`), file(`${i + 1}.out`)]).flat();
  await render(
    React.createElement(SubtasksEditor, {
      options: { enableInputFile: true, enableOutputFile: true },
      judgeInfo: { subtasks: null, timeLimit: 1000, memoryLimit: 256 },
      testData,
      onUpdateJudgeInfo: () => {}
    })
  );
  assert.equal(container.querySelectorAll("tbody tr").length, 98);
  assert.equal(container.querySelectorAll(".pagination").length, 0);
  assert.equal(container.querySelector("tbody tr:last-child").textContent, "9898.in98.out");
});

test("judge settings shows all subtasks beyond the former 20-subtask limit", async () => {
  const options = { enableInputFile: true, enableOutputFile: true };
  const judgeInfo = SubtasksEditor.parseJudgeInfo(
    {
      subtasks: Array.from({ length: 21 }, () => ({ testcases: [] }))
    },
    [],
    options
  );
  await render(
    React.createElement(SubtasksEditor, {
      options,
      judgeInfo: { ...judgeInfo, timeLimit: 1000, memoryLimit: 256 },
      testData: [],
      onUpdateJudgeInfo: () => {}
    })
  );
  assert.equal(container.querySelectorAll(".minus.square.icon").length, 0);
  assert.equal(container.querySelectorAll(".circle.outline.icon").length, 21);
  assert.match(container.textContent, /#21/);
  assert.equal(container.querySelectorAll(".pagination").length, 0);
});

test("submission shows every subtask, sample and nested testcase without pagination", async () => {
  const testcaseResult = {};
  const testcases = Array.from({ length: 98 }, (_, i) => {
    const testcaseHash = `nested-${i}`;
    testcaseResult[testcaseHash] = { status: "Accepted", score: 1, time: 1, memory: 1, testcaseInfo: {} };
    return { testcaseHash };
  });
  const View = props => props.getSubtasksView(() => null);
  await render(
    React.createElement(SubmissionPage, {
      meta: { id: 1, status: "Accepted", submitter: { id: 2 } },
      content: {},
      progress: {
        progressType: "Finished",
        testcaseResult,
        samples: testcases,
        subtasks: Array.from({ length: 21 }, () => ({ testcases, score: 100, fullScore: 100 }))
      },
      ProblemTypeSubmissionView: View
    })
  );
  assert.equal(container.querySelectorAll(".title").length, 22);
  await click(container.querySelectorAll(".title")[21]);
  assert.equal(container.querySelectorAll(".title").length, 120);
  assert.match(container.querySelectorAll(".title")[119].textContent, /#98/);
  assert.equal(container.querySelectorAll(".pagination").length, 0);
  await click(container.querySelector(".title"));
  assert.equal(container.querySelectorAll(".title").length, 120);
  assert.match(container.querySelectorAll(".title")[98].textContent, /#98/);
  assert.equal(container.querySelectorAll(".pagination").length, 0);
});
