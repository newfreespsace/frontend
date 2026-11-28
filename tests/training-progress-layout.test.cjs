const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");
const less = require("less");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const trainingCommon = path.resolve(__dirname, "../src/pages/training/common");
const styles = {
  trainingProgress: "trainingProgress",
  trainingProgressBar: "trainingProgressBar",
  trainingProgressText: "trainingProgressText"
};

function loadTrainingProgressBar() {
  const source = fs.readFileSync(path.join(trainingCommon, "TrainingProgressBar.tsx"), "utf8");
  const { code } = esbuild.transformSync(source, { loader: "tsx", format: "cjs" });
  const compiled = { exports: {} };
  new Function("require", "module", code)(
    name => (name === "./TrainingPage.module.less" ? styles : require(name)),
    compiled
  );
  return compiled.exports.default;
}

test("training progress can shrink inside the progress cell and wrap its count", async () => {
  const source = fs.readFileSync(path.join(trainingCommon, "TrainingPage.module.less"), "utf8");
  const { css } = await less.render(source.replace(/:global\(([^)]+)\)/g, "$1"));
  const Progress = loadTrainingProgressBar();
  const markup = renderToStaticMarkup(React.createElement(Progress, { acceptedProblemCount: 7, problemCount: 10 }));
  const { window } = new JSDOM(`<style>${css}</style><table><tr><td>${markup}</td><td>参加训练</td></tr></table>`);
  try {
    const container = window.document.querySelector("td .trainingProgress");
    const track = container.querySelector(".ui.progress");
    assert.equal(window.getComputedStyle(container).width, "100%");
    assert.equal(window.getComputedStyle(container).flexWrap, "wrap");
    assert.equal(window.getComputedStyle(track).flexShrink, "1");
    assert.equal(Number.parseFloat(window.getComputedStyle(track).minWidth), 0);
    assert.equal(track.querySelector(".bar").style.width, "70%");
    assert.equal(container.querySelector(".trainingProgressText").textContent, "7 / 10");
  } finally {
    window.close();
  }
});
