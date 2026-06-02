import { mount, lazy, redirect } from "navi";

export default {
  c: mount({
    "/new": lazy(() => import("./edit/ContestEditPage")),
    "/:id": mount({
      "/": lazy(() => import("./view/ContestViewPage")),
      "/edit": lazy(() => import("./edit/ContestEditPage")),
      "/ranklist": lazy(() => import("./ranklist/ContestRanklistPage"))
    }),
    "/": lazy(() => import("./contests/ContestsPage"))
  }),
  contest: mount({
    "/:id/edit": redirect(request => `/c/${request.params.id}/edit`),
    "/:id/ranklist": redirect(request => `/c/${request.params.id}/ranklist`),
    "/:id": redirect(request => `/c/${request.params.id}`)
  }),
  contests: redirect("/c")
};
