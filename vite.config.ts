import { defineConfig, Plugin } from "vite";
import fs from "fs";
import path from "path";

// Vite plugins
import react from "@vitejs/plugin-react";
import compileTime from "vite-plugin-compile-time";
import legacy from "@vitejs/plugin-legacy";
import { ViteEjsPlugin as ejs } from "vite-plugin-ejs";
import { prismjsPlugin as prismjs } from "vite-plugin-prismjs";
import minifyHtml from "vite-plugin-html-minifier-terser";
import svgo from "./vite/svgo";
import publicPath from "vite-plugin-public-path";
import { viteExternalsPlugin as externals } from "vite-plugin-externals";
import { visualizer } from "rollup-plugin-visualizer";

// Node polyfill
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import rollupNodePolyFill from "rollup-plugin-node-polyfills";

// Others
import getGitCommitInfo from "git-commit-info";
import { Options as HtmlMinifierOptions } from "html-minifier-terser";
import { browsersWithSupportForFeatures, normalizeBrowserslist } from "browserslist-generator";
import { resolveToEsbuildTarget } from "esbuild-plugin-browserslist";

import tsconfig from "./tsconfig.json";

const isDev = process.env.NODE_ENV !== "production";

const tsconfigPathAliases = Object.fromEntries(
  Object.entries(tsconfig.compilerOptions.paths).map(([key, values]) => {
    let value = values[0];
    if (key.endsWith("/*")) {
      key = key.slice(0, -2);
      value = value.slice(0, -2);
    }

    const nodeModulesPrefix = "node_modules/";
    if (value.startsWith(nodeModulesPrefix)) {
      value = value.replace(nodeModulesPrefix, "");
    } else {
      value = path.join(__dirname, value);
    }

    return [key, value];
  })
);

const modernTargets = browsersWithSupportForFeatures(
  "es6-module-dynamic-import",
  "javascript.statements.import_meta",
  "javascript.operators.await.top_level"
).filter(browser => !(browser.includes("safari") || browser.includes("ios_saf")));

const enabledNodePolyfills = {
  util: "rollup-plugin-node-polyfills/polyfills/util",
  path: "rollup-plugin-node-polyfills/polyfills/path",
  buffer: "rollup-plugin-node-polyfills/polyfills/buffer-es6"
};

const semanticUiCssComponents = [
  "accordion",
  "breadcrumb",
  "button",
  "checkbox",
  "comment",
  "container",
  "dimmer",
  "divider",
  "dropdown",
  "flag",
  "form",
  "grid",
  "header",
  "icon",
  "image",
  "input",
  "item",
  "label",
  "list",
  "loader",
  "menu",
  "message",
  "modal",
  "placeholder",
  "popup",
  "progress",
  "reset",
  "search",
  "segment",
  "sidebar",
  "statistic",
  "table",
  "tab",
  "text",
  "transition"
];

// These packages are simply loaded in HTML with the JS path
const baseExternalPackages: Record<
  string,
  {
    cdnjsName?: string;
    globalVariableName?: string;
    devScript?: string | string[];
    prodScript?: string | string[];
    css?: string | string[];
  }
> = {
  react: {
    globalVariableName: "React",
    devScript: "umd/react.development.js",
    prodScript: "umd/react.production.min.js"
  },
  "react-dom": {
    globalVariableName: "ReactDOM",
    devScript: "umd/react-dom.development.js",
    prodScript: "umd/react-dom.production.min.js"
  },
  mobx: { globalVariableName: "mobx", devScript: "mobx.umd.development.js", prodScript: "mobx.umd.production.min.js" },
  axios: { globalVariableName: "axios", devScript: "axios.min.js" },
  noty: { globalVariableName: "Noty", devScript: "noty.min.js", css: "noty.min.css" },
  "semantic-ui-react": { globalVariableName: "semanticUIReact", devScript: "semantic-ui-react.min.js" },
  "fomantic-ui-css": {
    cdnjsName: "fomantic-ui",
    css: semanticUiCssComponents.map(component => `components/${component}.min.css`)
  }
};

const externalPackageVersions = Object.fromEntries(
  [
    // These packages are loaded separatedly in JS code when needed
    "monaco-editor",
    "mathjax-full",
    "twemoji",
    "prismjs",

    ...Object.keys(baseExternalPackages)
  ].map(packageName => [
    baseExternalPackages[packageName]?.cdnjsName || packageName,
    require(`${packageName}/package.json`).version
  ])
);

const devBundledPackages = ["react", "react-dom", "mobx", "axios", "noty", "semantic-ui-react"];

const externalPackagesForVite = Object.entries(baseExternalPackages)
  .filter(([packageName, { globalVariableName }]) => {
    if (!globalVariableName) return false;
    if (isDev && devBundledPackages.includes(packageName)) return false;
    return true;
  })
  .map(([packageName, { globalVariableName }]) => [packageName, globalVariableName]);

const externalPackagesForHtml = Object.entries(baseExternalPackages).map(
  ([packageName, { cdnjsName, devScript, prodScript, css }]) => [
    cdnjsName || packageName,
    isDev && devBundledPackages.includes(packageName) ? null : !isDev && prodScript ? prodScript : devScript,
    css
  ]
);

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      // 匹配所有以 /api 开头的请求路径
      "/api": {
        target: "http://localhost:2002", // 目标后端服务地址
        changeOrigin: true // 允许跨域
      }
    }
  },
  plugins: [
    react({
      babel: {
        plugins: [["@babel/plugin-proposal-decorators", { legacy: true }], ["@babel/plugin-transform-class-properties"]]
      }
    }),
    compileTime(),
    ejs({
      gitCommitInfo: getGitCommitInfo(),
      externalPackages: externalPackagesForHtml,
      externalPackageVersions
    }),
    svgo({
      plugins: [
        "preset-default",
        {
          name: "sortAttrs",
          params: {
            xmlnsOrder: "alphabetical"
          } as any
        }
      ]
    }),
    legacy({
      modernPolyfills: true,
      ignoreBrowserslistConfig: true,
      targets: [
        // Default
        ">0.2%",
        "not dead",
        "not op_mini all",

        // Don't support IE
        "not IE 11",

        // Windows XP
        "Firefox 52"
      ],
      modernTargets,
      modernFeatureTestExtraCode: "await 0;if(navigator.vendor.includes('Apple'))throw 0;"
    }),
    publicPath({
      publicPathExpression: "window.publicPath",
      html: {
        functionNameAddLinkTag: "addLinkTag",
        addLinkTagsPlaceholder: "// __add_link_tags__",
        functionNameAddScriptTag: "addScriptTag",
        addScriptTagsPlaceholder: "// __add_script_tags__"
      }
    }),
    minifyHtml(<HtmlMinifierOptions>{
      includeAutoGeneratedTags: true,
      removeAttributeQuotes: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      sortClassName: true,
      useShortDoctype: true,
      collapseWhitespace: true,
      removeComments: true,
      ignoreCustomComments: [/Menci/],
      minifyJS: {
        parse: {
          ecma: 8
        },
        compress: {
          ecma: 5,
          warnings: false,
          comparisons: false,
          inline: 2
        },
        mangle: {
          safari10: true
        },
        output: {
          ecma: 5,
          comments: false
        }
      },
      minifyCSS: true
    }),
    prismjs({
      languages: fs.readFileSync(".prism-languages", "utf-8").trim().split("\n")
    }),

    externals({
      "monaco-editor": "Monaco",
      ...Object.fromEntries(externalPackagesForVite)
    }),
    visualizer()
  ],
  base: isDev ? "/" : "/__vite_base__/",
  resolve: {
    alias: {
      ...enabledNodePolyfills,
      ...tsconfigPathAliases
    }
  },
  build: {
    minify: "terser",
    target: resolveToEsbuildTarget(normalizeBrowserslist(modernTargets), { printUnknownTargets: false }),
    rollupOptions: {
      plugins: [rollupNodePolyFill()]
    }
  },
  esbuild: {
    supported: {
      "top-level-await": true
    }
  },
  define: {
    EXTERNAL_PACKAGE_VERSION: JSON.stringify(externalPackageVersions)
  },
  optimizeDeps: {
    exclude: ["mobx-utils/mobx-utils.module.js"],
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: "globalThis",
        process: '{ "env": {} }'
      },
      plugins: [
        // Enable esbuild polyfill plugins
        NodeModulesPolyfillPlugin()
      ]
    }
  }
});
