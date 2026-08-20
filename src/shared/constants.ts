import type { ImageSlotConfig, TemplateConfig } from "./types";

export const PLUGIN_VERSION = "v1.1";
export const TEXT_LAYER_PREFIX = "TXT_";
export const IMAGE_LAYER_PREFIX = "IMG_";
export const MAX_IMAGE_DIMENSION = 4096;
export const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg"] as const;

export const templates: TemplateConfig[] = [
  {
    id: "haircamp-detail-v1",
    displayName: "HairCamp DETAIL_PAGE",
    sourceFrameName: "DETAIL_PAGE",
    duplicateGap: 200
  }
];

export const defaultTemplateId = templates[0].id;

export const imageSlots: ImageSlotConfig[] = [
  {
    id: "hero",
    displayName: "클래스 커버 이미지",
    groupName: "클래스 커버",
    sectionName: "Main banner",
    layerName: "IMG_HERO",
    required: false,
    defaultScaleMode: "FILL"
  },
  {
    id: "hook1",
    displayName: "후킹 이미지 1",
    groupName: "후킹 이미지",
    sectionName: "Class_2",
    layerName: "IMG_HOOK1",
    required: false,
    defaultScaleMode: "FILL"
  },
  {
    id: "hook2",
    displayName: "후킹 이미지 2",
    groupName: "후킹 이미지",
    sectionName: "Class_2",
    layerName: "IMG_HOOK2",
    required: false,
    defaultScaleMode: "FILL"
  },
  {
    id: "hook3",
    displayName: "후킹 이미지 3",
    groupName: "후킹 이미지",
    sectionName: "Class_2",
    layerName: "IMG_HOOK3",
    required: false,
    defaultScaleMode: "FILL"
  },
  {
    id: "hook4",
    displayName: "후킹 이미지 4",
    groupName: "후킹 이미지",
    sectionName: "Class_2",
    layerName: "IMG_HOOK4",
    required: false,
    defaultScaleMode: "FILL"
  },
  {
    id: "feature1",
    displayName: "강의 특징 이미지 1",
    groupName: "강의 특징 이미지",
    sectionName: "Class_3",
    layerName: "IMG_FEATURE1",
    required: false,
    defaultScaleMode: "FILL"
  },
  {
    id: "feature2",
    displayName: "강의 특징 이미지 2",
    groupName: "강의 특징 이미지",
    sectionName: "Class_3",
    layerName: "IMG_FEATURE2",
    required: false,
    defaultScaleMode: "FILL"
  },
  {
    id: "feature3",
    displayName: "강의 특징 이미지 3",
    groupName: "강의 특징 이미지",
    sectionName: "Class_3",
    layerName: "IMG_FEATURE3",
    required: false,
    defaultScaleMode: "FILL"
  },
  {
    id: "curriculum1",
    displayName: "커리큘럼 이미지 1",
    groupName: "커리큘럼 이미지",
    sectionName: "Class_6",
    layerName: "IMG_CURRICULUM1",
    required: false,
    defaultScaleMode: "FILL"
  },
  {
    id: "curriculum2",
    displayName: "커리큘럼 이미지 2",
    groupName: "커리큘럼 이미지",
    sectionName: "Class_6",
    layerName: "IMG_CURRICULUM2",
    required: false,
    defaultScaleMode: "FILL"
  },
  {
    id: "curriculum3",
    displayName: "커리큘럼 이미지 3",
    groupName: "커리큘럼 이미지",
    sectionName: "Class_6",
    layerName: "IMG_CURRICULUM3",
    required: false,
    defaultScaleMode: "FILL"
  }
];
