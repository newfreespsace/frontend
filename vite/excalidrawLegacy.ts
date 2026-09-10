import { transformAsync } from "@babel/core";
import type { Plugin } from "vite";

// The existing legacy targets preserve some expressions which regenerator cannot
// handle inside dependency generators. Lower expressions/classes first, leaving
// generator and async conversion to plugin-legacy's normal pass.
export default function excalidrawLegacy(): Plugin {
  return {
    name: "excalidraw-legacy-syntax",
    renderChunk: {
      order: "pre",
      async handler(code, chunk, output) {
        if (output.format !== "system") return null;
        const result = await transformAsync(code, {
          babelrc: false,
          configFile: false,
          // Vite's SystemJS wrapper regex can reach execute() when Babel's
          // automatic compact mode puts chunks larger than 500 KB on one line.
          // Preserve line breaks here; Vite still minifies the final output.
          compact: false,
          sourceMaps: true,
          filename: chunk.fileName,
          presets: [
            [
              "@babel/preset-env",
              {
                targets: { ie: "11" },
                modules: false,
                exclude: [
                  "@babel/plugin-transform-regenerator",
                  "@babel/plugin-transform-async-to-generator",
                  "@babel/plugin-transform-async-generator-functions"
                ]
              }
            ]
          ]
        });
        return { code: result.code, map: result.map };
      }
    }
  };
}
