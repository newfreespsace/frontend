// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const getPreference = createGetApi<void, ApiTypes.GetSitePreferenceResponseDto>("site-setting/preference");
export const updatePreference = createPostApi<
  ApiTypes.UpdateSitePreferenceRequestDto,
  ApiTypes.UpdateSitePreferenceResponseDto
>("site-setting/preference", false);
