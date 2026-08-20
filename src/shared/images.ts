import { imageSlots, MAX_IMAGE_DIMENSION, SUPPORTED_IMAGE_MIME_TYPES } from "./constants";
import type { ImageScaleMode, SelectedImagePayload, StatusItem } from "./types";

const supportedExtensions = [".png", ".jpg", ".jpeg"];

export function getImageSlot(slotId: string) {
  return imageSlots.find((slot) => slot.id === slotId);
}

export function isSupportedImageType(fileName: string, mimeType: string): boolean {
  const lowerName = fileName.toLowerCase();
  const hasSupportedExtension = supportedExtensions.some((extension) => lowerName.endsWith(extension));
  const hasSupportedMime = (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
  return hasSupportedExtension && hasSupportedMime;
}

export function isValidScaleMode(value: string): value is ImageScaleMode {
  return value === "FILL" || value === "FIT";
}

export function makeImageSignature(images: SelectedImagePayload[]): string {
  const source = images
    .map((image) => `${image.slotId}:${image.fileName}:${image.mimeType}:${image.byteLength}:${image.width}x${image.height}:${image.scaleMode}`)
    .sort()
    .join("|");

  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33) ^ source.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

export function makeCombinedSignature(jsonText: string, templateId: string, images: SelectedImagePayload[]): string {
  let hash = 5381;
  const source = `${templateId}\n${jsonText}\n${makeImageSignature(images)}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33) ^ source.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

export function countSelectedImages(images: SelectedImagePayload[]): number {
  return images.length;
}

export function validateSelectedImages(images: SelectedImagePayload[]): StatusItem[] {
  const items: StatusItem[] = [];
  const seen = new Set<string>();

  if (images.length === 0) {
    return [{ severity: "info", message: "선택된 이미지 없음 · 텍스트만 생성됩니다." }];
  }

  for (const image of images) {
    const slot = getImageSlot(image.slotId);
    if (!slot) {
      items.push({ severity: "error", message: `${image.slotId} 이미지 슬롯을 찾을 수 없습니다.` });
      continue;
    }

    if (seen.has(image.slotId)) {
      items.push({ severity: "error", message: `${slot.displayName} 이미지가 중복 선택되었습니다.` });
    }
    seen.add(image.slotId);

    if (!isSupportedImageType(image.fileName, image.mimeType)) {
      items.push({
        severity: "error",
        message: `${slot.displayName}: 지원하지 않는 이미지 형식입니다. PNG, JPG 또는 JPEG 파일을 선택해 주세요.`
      });
    }

    if (image.width <= 0 || image.height <= 0 || image.byteLength <= 0 || image.bytes.length === 0) {
      items.push({ severity: "error", message: `${slot.displayName}: 이미지 데이터가 정상적이지 않습니다.` });
    }

    if (image.width > MAX_IMAGE_DIMENSION || image.height > MAX_IMAGE_DIMENSION) {
      items.push({
        severity: "error",
        message: `${slot.displayName}: 이미지 크기가 ${MAX_IMAGE_DIMENSION}px을 초과합니다. 현재 ${image.width}x${image.height}px입니다.`
      });
    }

    if (!isValidScaleMode(image.scaleMode)) {
      items.push({ severity: "error", message: `${slot.displayName}: 이미지 맞춤 방식은 FILL 또는 FIT이어야 합니다.` });
    }
  }

  if (!items.some((item) => item.severity === "error")) {
    items.push({ severity: "success", message: `선택한 이미지 ${images.length}개 검증 완료` });
    items.push({ severity: "info", message: "선택하지 않은 이미지 영역은 기존 이미지가 유지됩니다." });
  }

  return items;
}
