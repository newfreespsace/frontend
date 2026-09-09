import React from "react";
import { defineRoute } from "@/AppRouter";

export default defineRoute(async () => {
  // Set this before evaluating Excalidraw, including its font loader.
  window.EXCALIDRAW_ASSET_PATH = `${window.publicPath || "/"}static/excalidraw/`;
  const { default: DrawPage } = await import("./DrawPage");
  return <DrawPage />;
});
