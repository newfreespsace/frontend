const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const vm = require("node:vm");
const esbuild = require("esbuild");

test("large legacy chunks retain working SystemJS exports and module context", async () => {
  const pluginPath = path.resolve(__dirname, "../vite/excalidrawLegacy.ts");
  const compiled = esbuild.transformSync(fs.readFileSync(pluginPath, "utf8"), {
    loader: "ts",
    format: "cjs"
  }).code;
  const pluginModule = new Module(pluginPath, module);
  pluginModule.filename = pluginPath;
  pluginModule.paths = module.paths;
  pluginModule._compile(compiled, pluginPath);

  // Cross Babel's automatic compact-output threshold, with both SystemJS
  // wrapper arguments present so Vite must leave execute() untouched.
  const payload = "x".repeat(510000);
  const entry = "legacy-build-regression";
  const { build } = await import("vite");
  const result = await build({
    configFile: false,
    logLevel: "silent",
    publicDir: false,
    plugins: [
      pluginModule.exports.default(),
      {
        name: "legacy-regression-entry",
        resolveId: id => (id === entry ? `\0${entry}` : null),
        load: id =>
          id === `\0${entry}`
            ? `export const payload = ${JSON.stringify(payload)}; export const moduleUrl = import.meta.url;`
            : null
      }
    ],
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: entry,
        preserveEntrySignatures: "strict",
        output: { format: "system" }
      }
    }
  });
  const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
  assert.ok(chunk, "Vite should produce a SystemJS entry");

  const exported = {};
  const moduleUrl = "https://nsoj.test/assets/legacy-regression.js";
  let registration;
  vm.runInNewContext(chunk.code, {
    System: {
      register(dependencies, factory) {
        assert.equal(dependencies.length, 0);
        registration = factory(
          (name, value) => {
            if (typeof name === "string") exported[name] = value;
            else Object.assign(exported, name);
            return value;
          },
          { meta: { url: moduleUrl } }
        );
      }
    }
  });
  assert.ok(registration, "The entry should register with SystemJS");
  await registration.execute();
  assert.ok(exported.payload === payload, "The entry should export its complete payload");
  assert.equal(exported.moduleUrl, moduleUrl);
});
