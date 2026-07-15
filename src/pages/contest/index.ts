import getRoute from "@/utils/getRoute";
import { mount, lazy, redirect } from "navi";

export default {
  c: mount({
    "/new": lazy(() => import("./edit/ContestEditPage")),
    "/:id": mount({
      "/": lazy(() => import("./view/ContestViewPage")),
      "/edit": lazy(() => import("./edit/ContestEditPage")),
      "/ranklist": lazy(() => import("./ranklist/ContestRanklistPage")),
      "/p/:pid": mount({
        "/": getRoute(() => import("@/pages/problem/view/ProblemViewPage"), "contest"),
        "/files": getRoute(() => import("@/pages/problem/files/ProblemFilesPage"), "contest")
      }),
      "/s/:sid": lazy(async () => ({
        default: (await import("@/pages/submission/submission/SubmissionPage")).contest
      }))
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
