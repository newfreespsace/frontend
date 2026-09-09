import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

// Generate the same self-hosted assets for vite dev and production builds.
export default function excalidrawFonts(): Plugin {
  return {
    name: "excalidraw-local-fonts",
    configResolved(config) {
      const source = path.resolve(config.root, "node_modules/@excalidraw/excalidraw/dist/prod/fonts");
      const target = path.resolve(config.publicDir, "static/excalidraw/fonts");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(source, target, { recursive: true });
    }
  };
}
