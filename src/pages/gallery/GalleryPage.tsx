import React, { useEffect, useState } from "react";
import { Button, Header, Icon, Progress, Segment } from "semantic-ui-react";

import style from "./GalleryPage.module.less";

import api from "@/api";
import { RouteError } from "@/AppRouter";
import { appState } from "@/appState";
import { makeToBeLocalizedText } from "@/locales";
import copyToClipboard from "@/utils/copyToClipboard";
import formatDateTime from "@/utils/formatDateTime";
import formatFileSize from "@/utils/formatFileSize";
import openUploadDialog from "@/utils/openUploadDialog";
import toast from "@/utils/toast";
import { callApiWithFileUpload, FileUploadApiProgress } from "@/utils/callApiWithFileUpload";
import { useLocalizer, useNavigationChecked } from "@/utils/hooks";
import { useRecaptcha } from "@/utils/hooks/useRecaptcha";

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const compressedImageType = "image/webp";

interface GalleryPageProps {
  images: ApiTypes.GalleryImageDto[];
  quota: ApiTypes.GalleryQuotaDto;
}

async function fetchData(): Promise<GalleryPageProps> {
  const { requestError, response } = await api.gallery.listImages();
  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  if (response.error)
    throw new RouteError(makeToBeLocalizedText(`gallery.error.${response.error}`), { showBack: true });

  return {
    images: response.images,
    quota: response.quota
  };
}

function getImageSize(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

function replaceExtension(filename: string, extension: string): string {
  const index = filename.lastIndexOf(".");
  return (index === -1 ? filename : filename.slice(0, index)) + extension;
}

async function compressImage(file: File, maxSize: number): Promise<File> {
  if (file.type === "image/gif") return file;

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return file;

    let maxSide = Math.min(Math.max(image.naturalWidth, image.naturalHeight), 1920);
    let bestBlob: Blob = null;
    const qualities = [0.86, 0.76, 0.66, 0.56, 0.46];

    for (let scaleTry = 0; scaleTry < 5; scaleTry++) {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (const quality of qualities) {
        // eslint-disable-next-line no-await-in-loop
        const blob = await canvasToBlob(canvas, compressedImageType, quality);
        if (!blob) continue;
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
        if (blob.size <= maxSize && blob.size < file.size) {
          return new File([blob], replaceExtension(file.name, ".webp"), {
            type: compressedImageType,
            lastModified: file.lastModified
          });
        }
      }

      maxSide *= 0.75;
    }

    if (bestBlob && bestBlob.size < file.size) {
      return new File([bestBlob], replaceExtension(file.name, ".webp"), {
        type: compressedImageType,
        lastModified: file.lastModified
      });
    }

    return file;
  } catch (e) {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getPermanentImageUrl(image: ApiTypes.GalleryImageDto): string {
  return `/api/gallery/image/${encodeURIComponent(image.publicId)}/${encodeURIComponent(image.filename)}`;
}

function escapeHtmlAttribute(text: string): string {
  return text.split("&").join("&amp;").split('"').join("&quot;").split("<").join("&lt;").split(">").join("&gt;");
}

const GalleryPage: React.FC<GalleryPageProps> = props => {
  const _ = useLocalizer("gallery");
  const common = useLocalizer("common");
  const navigation = useNavigationChecked();
  const recaptcha = useRecaptcha();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<FileUploadApiProgress>(null);

  useEffect(() => {
    appState.enterNewPage(_(".title"), null, false);
  }, [appState.locale]);

  const usedPercent = props.quota.quotaSize ? Math.min(100, (props.quota.usedSize / props.quota.quotaSize) * 100) : 0;

  async function uploadOne(file: File) {
    if (!(allowedMimeTypes as readonly string[]).includes(file.type)) {
      toast.error(_(".error.INVALID_IMAGE_TYPE"));
      return false;
    }

    const compressedFile = await compressImage(file, props.quota.maxImageSize);
    const imageSize = await getImageSize(compressedFile);
    const result = await callApiWithFileUpload(
      api.gallery.addImage,
      {
        filename: compressedFile.name,
        mimeType: compressedFile.type as ApiTypes.AddGalleryImageRequestDto["mimeType"],
        ...imageSize
      },
      () => recaptcha("gallery_add_image"),
      compressedFile,
      setProgress
    );

    if (result.uploadCancelled) return false;
    if (result.uploadError) {
      toast.error(_(".upload_error"));
      return false;
    }
    if (result.requestError) {
      toast.error(result.requestError(common));
      return false;
    }
    if (result.response.error) {
      toast.error(_(`.error.${result.response.error}`));
      return false;
    }

    return true;
  }

  async function onUpload(files: File[]) {
    if (uploading) return;
    setUploading(true);
    let successCount = 0;
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      if (await uploadOne(file)) successCount++;
    }
    setProgress(null);
    setUploading(false);

    if (successCount > 0) {
      toast.success(_(".upload_success", { count: successCount }));
      navigation.refresh();
    }
  }

  async function onCopyMarkdown(image: ApiTypes.GalleryImageDto) {
    const text = `![${image.filename}](${getPermanentImageUrl(image)})`;
    const success = await copyToClipboard(text);
    if (success) toast.success(_(".copy_success"));
    else toast.error(_(".copy_failed"));
  }

  async function onCopyHtml(image: ApiTypes.GalleryImageDto) {
    const text = `<img src="${escapeHtmlAttribute(getPermanentImageUrl(image))}" alt="${escapeHtmlAttribute(
      image.filename
    )}" />`;
    const success = await copyToClipboard(text);
    if (success) toast.success(_(".copy_html_success"));
    else toast.error(_(".copy_failed"));
  }

  async function onDelete(image: ApiTypes.GalleryImageDto) {
    if (!window.confirm(_(".confirm_delete", { filename: image.filename }))) return;

    const { requestError, response } = await api.gallery.deleteImage({ id: image.id });
    if (requestError) toast.error(requestError(common));
    else if (response.error) toast.error(_(`.error.${response.error}`));
    else {
      toast.success(_(".delete_success"));
      navigation.refresh();
    }
  }

  return (
    <>
      <div className={style.toolbar}>
        <div className={style.quota}>
          <div className={style.quotaText}>
            <span>
              {_(".quota", {
                used: formatFileSize(props.quota.usedSize, 1),
                total: formatFileSize(props.quota.quotaSize, 1)
              })}
            </span>
            <span>
              {_(".accepted_count", {
                count: props.quota.acceptedProblemCount
              })}
            </span>
          </div>
          <Progress percent={usedPercent} size="small" color={usedPercent >= 90 ? "red" : "blue"} />
        </div>
        <Button
          primary
          icon="upload"
          labelPosition="left"
          loading={uploading}
          disabled={uploading}
          content={
            uploading && progress
              ? _(`.progress.${progress.status}`, { percent: Math.floor(progress.progress * 100) })
              : _(".upload")
          }
          onClick={() => openUploadDialog(onUpload, allowedMimeTypes.join(","))}
        />
      </div>

      {props.images.length === 0 ? (
        <Segment placeholder className={style.empty}>
          <Header icon>
            <Icon name="images" />
            {_(".empty")}
          </Header>
        </Segment>
      ) : (
        <div className={style.grid}>
          {props.images.map(image => (
            <div className={style.imageCard} key={image.id}>
              <img className={style.preview} src={getPermanentImageUrl(image)} alt={image.filename} />
              <div className={style.body}>
                <div className={style.filename} title={image.filename}>
                  {image.filename}
                </div>
                <div className={style.meta}>
                  {formatFileSize(image.size, 1)}
                  {image.width && image.height ? ` · ${image.width}x${image.height}` : ""}
                  <br />
                  {formatDateTime(image.createdAt)[1]}
                </div>
                <div className={style.actions}>
                  <Button size="mini" icon="copy" title={_(".copy_markdown")} onClick={() => onCopyMarkdown(image)} />
                  <Button size="mini" icon="code" title={_(".copy_html")} onClick={() => onCopyHtml(image)} />
                  <Button size="mini" icon="trash" title={_(".delete")} onClick={() => onDelete(image)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default GalleryPage;
export const route = fetchData;
