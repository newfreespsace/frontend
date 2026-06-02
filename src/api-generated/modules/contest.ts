// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createPostApi } from "@/api";

export const queryContests = createPostApi<ApiTypes.QueryContestsRequestDto, ApiTypes.QueryContestsResponseDto>(
  "contest/queryContests",
  false
);
export const getContest = createPostApi<ApiTypes.GetContestRequestDto, ApiTypes.GetContestResponseDto>(
  "contest/getContest",
  false
);
export const saveContest = createPostApi<ApiTypes.SaveContestRequestDto, ApiTypes.SaveContestResponseDto>(
  "contest/saveContest",
  false
);
export const getContestRanklist = createPostApi<
  ApiTypes.GetContestRanklistRequestDto,
  ApiTypes.GetContestRanklistResponseDto
>("contest/getContestRanklist", false);
