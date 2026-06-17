import { defineRoute } from "@/AppRouter";

import GalleryPage, { route } from "./GalleryPage";

export default defineRoute(async () => {
  const React = await import("react");
  return React.createElement(GalleryPage, await route());
});
