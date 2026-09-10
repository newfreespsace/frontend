const assert = require("node:assert/strict");
const { test, before, after, beforeEach, afterEach } = require("node:test");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");
const { IDBFactory } = require("fake-indexeddb");
const dom = new JSDOM('<div id="root"></div>', { url: "https://nsoj.test/draw" });
Object.assign(global, {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true
});
const React = require("react");
const { createRoot } = require("react-dom/client");
const { act } = React;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let root, Page, storage, state;
const scene = (text = "test") => ({
  type: "excalidraw",
  version: 2,
  elements: [{ id: text, type: "rectangle" }],
  appState: {},
  files: { picture: { dataURL: "data:image/png;base64,aGVsbG8=" } }
});
const mocks = {
  axios: "exports.post = (...args) => globalThis.__whiteboardTest.axios(...args);",
  "@/appState": "exports.appState = globalThis.__whiteboardTest.appState;",
  "@/utils/hooks":
    "exports.useConfirmNavigation = () => [false, value => { globalThis.__whiteboardTest.confirm = value; }];",
  "mobx-react": "exports.observer = component => component;",
  "board-api":
    "exports.boardsApi = globalThis.__whiteboardTest.api; exports.BoardError = globalThis.__whiteboardTest.BoardError; exports.createLibraryApi = () => ({get: async () => ({libraryItems:[]}), save: async () => ({libraryItems:[]})});",
  "@excalidraw/excalidraw": `
    const React = require('react');
    exports.Excalidraw = props => { globalThis.__whiteboardTest.editor = props; return React.createElement('div', {'data-editor':true}, props.children); };
    const Item = () => null; exports.MainMenu = Object.assign(Item,{Item,Separator:Item,DefaultItems:new Proxy({},{get:()=>Item})});
    exports.restore = data => data;
    exports.useHandleLibrary = opts => { globalThis.__whiteboardTest.libraryOptions = opts; };
    exports.serializeAsJSON = (elements,appState,files) => JSON.stringify({type:'excalidraw',version:2,elements,appState,files});
  `
};
async function compile(entry, mock = false) {
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, entry)],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    packages: "external",
    jsx: "transform",
    plugins: [
      {
        name: "test-boundaries",
        setup(build) {
          build.onResolve({ filter: /.*/ }, args => {
            const key = args.path === "./api" && mock ? "board-api" : args.path;
            if (mock && mocks[key]) return { path: key, namespace: "test" };
            if (/\.(css|less)$/.test(args.path)) return { path: args.path, namespace: "style" };
          });
          build.onLoad({ filter: /.*/, namespace: "test" }, args => ({
            contents: mocks[args.path],
            loader: "js",
            resolveDir: path.resolve(__dirname, "..")
          }));
          build.onLoad({ filter: /.*/, namespace: "style" }, () => ({ contents: "export default {}", loader: "js" }));
        }
      }
    ]
  });
  const mod = new Module(path.resolve(__dirname, "compiled.cjs"), module);
  mod.filename = path.resolve(__dirname, "compiled.cjs");
  mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, mod.filename);
  return mod.exports;
}
before(async () => {
  global.indexedDB = new IDBFactory();
  storage = await compile("../src/pages/draw/storage.ts");
});

test("library API keeps an in-flight request tied to its original account and rejects old queued saves", async () => {
  const requests = [];
  let respond;
  state.appState.token = "account-one";
  state.axios = (...args) => {
    requests.push(args);
    return new Promise(resolve => {
      respond = resolve;
    });
  };
  const { createLibraryApi } = await compile("../src/pages/draw/api.ts", true);
  const remote = createLibraryApi(state.appState.currentUser.id);
  const pending = remote.save([]);
  state.appState.currentUser = { id: state.appState.currentUser.id + 1 };
  state.appState.token = "account-two";
  assert.equal(requests[0][2].headers.Authorization, "Bearer account-one");
  await assert.rejects(remote.save([]), error => error.status === 401);
  assert.equal(requests.length, 1);
  respond({ status: 200, data: { libraryItems: [] } });
  await pending;
});

test("switching accounts remounts the editor and its account library adapter", async () => {
  const previous = state.libraryOptions.adapter;
  state.appState.currentUser = { id: state.appState.currentUser.id + 1 };
  await act(async () => {
    root.render(React.createElement(Page));
    await sleep(50);
  });
  assert.notEqual(state.libraryOptions.adapter, previous);
  assert.deepEqual(state.editor.initialData.elements, []);
});
beforeEach(async () => {
  state = global.__whiteboardTest = {
    appState: { currentUser: { id: 100 + Math.floor(Math.random() * 1000000) }, theme: "pure", enterNewPage() {} },
    BoardError: class extends Error {
      constructor(status, message) {
        super(message);
        this.status = status;
      }
    },
    saves: [],
    confirm: false,
    api: {
      list: async () => [],
      get: async () => {
        throw new Error("offline");
      },
      delete: async () => {},
      save: async value => {
        state.saves.push(value);
        return { ...value, version: value.version + 1 };
      }
    }
  };
  global.indexedDB = new IDBFactory();
  Page = (await compile("../src/pages/draw/DrawPage.tsx", true)).default;
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root"));
  await act(async () => {
    root.render(React.createElement(Page));
  });
  await act(async () => {
    await sleep(50);
  });
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
    await sleep(10);
  });
});
after(() => dom.window.close());
async function draw(text = "one") {
  const s = scene(text);
  await act(async () => {
    state.editor.onChange(s.elements, s.appState, s.files);
    await sleep(350);
  });
}
async function click(label) {
  const button = [...document.querySelectorAll("button")].find(el => el.textContent === label);
  assert.ok(button, `button ${label}`);
  await act(async () => {
    button.click();
    await sleep(20);
  });
}

test("IndexedDB round-trips images and isolates users", async () => {
  const draft = {
    localId: "one",
    userId: 1,
    id: "cloud",
    title: "图",
    version: 0,
    scene: JSON.stringify(scene()),
    dirty: true,
    savedAt: 1
  };
  await storage.putDraft(draft);
  assert.deepEqual(await storage.listDrafts(1), [draft]);
  assert.deepEqual(await storage.listDrafts(2), []);
  await storage.deleteDraft("one");
  assert.deepEqual(await storage.listDrafts(1), []);
});
test("local autosave completes before claiming saved; reload restores the scene", async () => {
  await draw();
  assert.match(document.body.textContent, /已保存到本机/);
  assert.equal(state.confirm, false);
  await act(async () => {
    root.unmount();
    await sleep(10);
  });
  root = createRoot(document.getElementById("root"));
  await act(async () => {
    root.render(React.createElement(Page));
  });
  await act(async () => {
    await sleep(50);
  });
  assert.equal(state.editor.initialData.elements[0].id, "one");
  assert.equal(state.editor.initialData.files.picture.dataURL, scene().files.picture.dataURL);
});
test("edits during an in-flight save are sent with the next cloud version", async () => {
  let resolveFirst;
  state.api.save = value => {
    state.saves.push(value);
    return state.saves.length === 1
      ? new Promise(resolve => {
          resolveFirst = resolve;
        })
      : Promise.resolve({ ...value, version: value.version + 1 });
  };
  await draw("first");
  await click("保存到云端");
  await draw("second");
  await act(async () => {
    resolveFirst({ version: 1 });
    await sleep(30);
  });
  await act(async () => {
    await sleep(1900);
  });
  assert.equal(state.saves.length, 2);
  assert.equal(state.saves[1].version, 1);
  assert.equal(JSON.parse(state.saves[1].scene).elements[0].id, "second");
  assert.match(document.body.textContent, /已保存到云端/);
});
test("offline edits stay local and retry after the online event", async () => {
  state.api.save = async () => {
    throw new state.BoardError(0, "网络不可用");
  };
  await draw("offline");
  await click("保存到云端");
  assert.match(document.body.textContent, /网络不可用/);
  state.api.save = async value => {
    state.saves.push(value);
    return { version: 1 };
  };
  await act(async () => {
    window.dispatchEvent(new window.Event("online"));
    await sleep(40);
  });
  assert.equal(JSON.parse(state.saves[0].scene).elements[0].id, "offline");
  assert.match(document.body.textContent, /已保存到云端/);
});
test("conflicts pause autosave and copy creates a new cloud board", async () => {
  state.api.save = async value => {
    state.saves.push(value);
    throw new state.BoardError(409, "冲突，请另存副本");
  };
  await draw("original");
  await click("保存到云端");
  const oldId = state.saves[0].id;
  await draw("local edit");
  await act(async () => {
    await sleep(1900);
  });
  assert.equal(state.saves.length, 1);
  state.api.save = async value => {
    state.saves.push(value);
    return { version: 1 };
  };
  await click("另存为云端副本");
  await act(async () => {
    await sleep(1900);
  });
  assert.notEqual(state.saves[1].id, oldId);
  assert.equal(state.saves[1].version, 0);
  assert.equal(JSON.parse(state.saves[1].scene).elements[0].id, "local edit");
});
test("import creates a separate board and preserves the previous recovery draft", async () => {
  await draw("previous");
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [{ name: "导入.excalidraw", size: 200, text: async () => JSON.stringify(scene("imported")) }]
  });
  await act(async () => {
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await sleep(50);
  });
  assert.equal(document.querySelector('input[aria-label="画板名称"]').value, "导入");
  assert.equal(state.editor.initialData.elements[0].id, "imported");
  await click("我的画板");
  assert.match(document.body.textContent, /未命名画板/);
  assert.match(document.body.textContent, /导入/);
});
