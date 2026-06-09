import { mount, lazy } from "navi";

export default {
  t: mount({ "/": lazy(() => import("./training-set/TrainingSetPage")) })
};
