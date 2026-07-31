// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const queryDueReviews = createPostApi<
  ApiTypes.QueryProblemReviewsRequestDto,
  ApiTypes.QueryProblemReviewsResponseDto
>("problemReview/queryDueReviews", false);
export const getProblemReview = createPostApi<
  ApiTypes.GetProblemReviewRequestDto,
  ApiTypes.GetProblemReviewResponseDto
>("problemReview/getProblemReview", false);
