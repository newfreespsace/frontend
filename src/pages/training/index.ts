import { mount, lazy } from "navi";

export default {
  t: mount({
    "/:trainingId": mount({
      "/:chapterId": mount({
        "/:sectionId": lazy(() => import("./section-view/SectionViewPage")),
        "/": lazy(() => import("./chapter-view/ChapterViewPage"))
      }),
      "/": lazy(() => import("./training-view/TrainingViewPage"))
    }),
    "/": lazy(() => import("./training-set/TrainingSetPage"))
  })
};
