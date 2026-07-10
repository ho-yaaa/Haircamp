export type TemplateConfig = {
  id: string;
  displayName: string;
  sourceFrameName: string;
  duplicateGap: number;
};

export type HairCampJson = {
  frameName: string;
  sections: Record<string, Record<string, string>>;
};

export type Severity = "success" | "warning" | "error" | "info";

export type StatusItem = {
  severity: Severity;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  data?: HairCampJson;
  items: StatusItem[];
  signature?: string;
  targetCount?: number;
};

export type UiToPluginMessage =
  | { type: "validate"; jsonText: string; templateId: string; signature: string }
  | { type: "generate"; jsonText: string; templateId: string; signature: string }
  | { type: "request-file-info" };

export type PluginToUiMessage =
  | { type: "file-info"; fileName: string }
  | { type: "validation-result"; result: ValidationResult }
  | { type: "generation-result"; result: ValidationResult };
