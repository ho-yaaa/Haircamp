import type { TemplateConfig } from "./types";

export const PLUGIN_VERSION = "v1.0";
export const TEXT_LAYER_PREFIX = "TXT_";

export const templates: TemplateConfig[] = [
  {
    id: "haircamp-detail-v1",
    displayName: "HairCamp DETAIL_PAGE",
    sourceFrameName: "DETAIL_PAGE",
    duplicateGap: 200
  }
];

export const defaultTemplateId = templates[0].id;
