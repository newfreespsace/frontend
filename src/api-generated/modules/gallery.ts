// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createPostApi } from "@/api";

export const listImages = createPostApi<void, ApiTypes.ListGalleryImagesResponseDto>("gallery/listImages", false);
export const getQuota = createPostApi<void, ApiTypes.GetGalleryQuotaResponseDto>("gallery/getQuota", false);
export const addImage = createPostApi<ApiTypes.AddGalleryImageRequestDto, ApiTypes.AddGalleryImageResponseDto>(
  "gallery/addImage",
  true
);
export const deleteImage = createPostApi<ApiTypes.DeleteGalleryImageRequestDto, ApiTypes.DeleteGalleryImageResponseDto>(
  "gallery/deleteImage",
  false
);
