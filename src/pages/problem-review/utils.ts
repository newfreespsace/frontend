import { getProblemUrl } from "@/pages/problem/utils";

export function getProblemReviewUrl(review: ApiTypes.ProblemReviewMetaDto): string {
  const problemUrl =
    review.contestId && review.contestProblemIndex
      ? `/c/${review.contestId}/p/${review.contestProblemIndex}`
      : getProblemUrl(review.problem);
  return `${problemUrl}?review=true`;
}
