// frontend/scripts/build-local-cdn.js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const nm = path.join(root, "node_modules");
const out = path.join(root, "public/static/cdnjs");

function version(pkg) {
  return require(path.join(nm, pkg, "package.json")).version;
}

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function pkgDir(name, cdnName = name) {
  return path.join(out, cdnName, version(name));
}

copy(path.join(nm, "react/umd"), path.join(pkgDir("react"), "umd"));
copy(path.join(nm, "react-dom/umd"), path.join(pkgDir("react-dom"), "umd"));

copy(path.join(nm, "mobx/dist/mobx.umd.production.min.js"), path.join(pkgDir("mobx"), "mobx.umd.production.min.js"));
copy(path.join(nm, "mobx/dist/mobx.umd.development.js"), path.join(pkgDir("mobx"), "mobx.umd.development.js"));

copy(path.join(nm, "axios/dist/axios.min.js"), path.join(pkgDir("axios"), "axios.min.js"));

copy(path.join(nm, "noty/lib/noty.min.js"), path.join(pkgDir("noty"), "noty.min.js"));
copy(path.join(nm, "noty/lib/noty.css"), path.join(pkgDir("noty"), "noty.min.css"));

copy(
  path.join(nm, "semantic-ui-react/dist/umd/semantic-ui-react.min.js"),
  path.join(pkgDir("semantic-ui-react"), "semantic-ui-react.min.js")
);

copy(path.join(nm, "fomantic-ui-css/components"), path.join(pkgDir("fomantic-ui-css", "fomantic-ui"), "components"));
copy(path.join(nm, "fomantic-ui-css/themes"), path.join(pkgDir("fomantic-ui-css", "fomantic-ui"), "themes"));

copy(path.join(nm, "monaco-editor/min/vs"), path.join(pkgDir("monaco-editor"), "min/vs"));

copy(path.join(nm, "prismjs/components"), path.join(pkgDir("prismjs", "prism"), "components"));
copy(path.join(nm, "prismjs/plugins/autoloader"), path.join(pkgDir("prismjs", "prism"), "plugins/autoloader"));

copy(path.join(nm, "mathjax-full/es5"), path.join(pkgDir("mathjax-full", "mathjax"), "es5"));

console.log(`Local CDN generated at ${out}`);
console.warn(
  "twemoji SVG assets are not included in node_modules; prepare /static/cdnjs/twemoji/14.0.2/svg separately."
);
