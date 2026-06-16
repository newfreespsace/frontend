// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const queryTrainingSet = createPostApi<void, ApiTypes.QueryTrainingSetResponseDto>(
  "training/queryTrainingSet",
  false
);
export const createTraining = createPostApi<ApiTypes.CreateTrainingDto, ApiTypes.TrainingMetaDto>(
  "training/createTraining",
  false
);
export const getTrainingById = createPostApi<ApiTypes.GetTrainingRequestDto, ApiTypes.TrainingMetaDto>(
  "training/getTrainingById",
  false
);
export const updateTraining = createPostApi<ApiTypes.UpdateTrainingDto, ApiTypes.TrainingMetaDto>(
  "training/updateTraining",
  false
);
export const delTrainingById = createPostApi<ApiTypes.DeleteByIdRequestDto, void>("training/delTrainingById", false);
export const reorderTrainings = createPostApi<ApiTypes.ReorderTrainingsDto, void>("training/reorderTrainings", false);
export const setCurrentTraining = createPostApi<ApiTypes.SetCurrentTrainingDto, ApiTypes.SetCurrentTrainingResponseDto>(
  "training/setCurrentTraining",
  false
);
export const queryChapterSetByTrainingId = createPostApi<ApiTypes.QueryChapterByTrainingIdDto, void>(
  "training/chapter/queryChapterSetByTrainingId",
  false
);
export const createChapter = createPostApi<ApiTypes.CreateChapterDto, ApiTypes.ChapterMetaDto>(
  "training/chapter/createChapter",
  false
);
export const updateChapter = createPostApi<ApiTypes.UpdateChapterDto, ApiTypes.ChapterMetaDto>(
  "training/chapter/updateChapter",
  false
);
export const getChapterById = createPostApi<ApiTypes.GetChapterByIdDto, ApiTypes.ChapterMetaDto>(
  "training/chapter/getChapterById",
  false
);
export const delChapterById = createPostApi<ApiTypes.DeleteByIdRequestDto, void>(
  "training/chapter/delChapterById",
  false
);
export const reorderChapters = createPostApi<ApiTypes.ReorderChaptersDto, void>(
  "training/chapter/reorderChapters",
  false
);
export const querySectionSetByChapterId = createPostApi<ApiTypes.QuerySectionByChapterIdDto, void>(
  "training/chapter/section/querySectionSetByChapterId",
  false
);
export const createSection = createPostApi<ApiTypes.CreateSectionDto, ApiTypes.SectionMetaDto>(
  "training/chapter/section/createSection",
  false
);
export const updateSection = createPostApi<ApiTypes.UpdateSectionDto, ApiTypes.SectionMetaDto>(
  "training/chapter/section/updateSection",
  false
);
export const getSectionById = createPostApi<ApiTypes.GetSectionByIdDto, ApiTypes.GetSectionByIdResponseDto>(
  "training/chapter/section/getSectionById",
  false
);
export const setSectionProblems = createPostApi<ApiTypes.SetSectionProblemsDto, ApiTypes.SetSectionProblemsResponseDto>(
  "training/chapter/section/setSectionProblems",
  false
);
export const delSectionById = createPostApi<ApiTypes.DeleteByIdRequestDto, void>(
  "training/chapter/section/delSectionById",
  false
);
export const reorderSections = createPostApi<ApiTypes.ReorderSectionsDto, void>(
  "training/chapter/section/reorderSections",
  false
);
export const querySectionGroupRanklist = createPostApi<
  ApiTypes.QuerySectionGroupRanklistDto,
  ApiTypes.QuerySectionGroupRanklistResponseDto
>("training/chapter/section/querySectionGroupRanklist", false);
