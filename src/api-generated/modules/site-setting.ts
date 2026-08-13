// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const getPreference = createGetApi<void, ApiTypes.GetSitePreferenceResponseDto>("site-setting/preference");
export const updatePreference = createPostApi<
  ApiTypes.UpdateSitePreferenceRequestDto,
  ApiTypes.UpdateSitePreferenceResponseDto
>("site-setting/preference", false);
export const startTrainingPointRecalculation = createPostApi<
  ApiTypes.StartTrainingPointRecalculationRequestDto,
  ApiTypes.StartTrainingPointRecalculationResponseDto
>("site-setting/training-points/recalculate", false);
export const getTrainingPointRecalculation = createPostApi<
  ApiTypes.GetTrainingPointRecalculationRequestDto,
  ApiTypes.GetTrainingPointRecalculationResponseDto
>("site-setting/training-points/recalculation-status", false);
