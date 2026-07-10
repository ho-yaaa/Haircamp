import { TEXT_LAYER_PREFIX } from "./constants";
import type { HairCampJson, StatusItem, ValidationResult } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function makeSignature(jsonText: string, templateId: string): string {
  let hash = 5381;
  const source = `${templateId}\n${jsonText}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33) ^ source.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

export function parseJsonText(jsonText: string): ValidationResult {
  const items: StatusItem[] = [];

  if (jsonText.length === 0) {
    return {
      ok: false,
      items: [{ severity: "error", message: "JSON 입력이 비어 있습니다." }]
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
    items.push({ severity: "success", message: "JSON 형식이 정상입니다." });
  } catch (error) {
    return {
      ok: false,
      items: [
        {
          severity: "error",
          message: `JSON 문법 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
        }
      ]
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      items: [...items, { severity: "error", message: "JSON 최상위 값은 객체여야 합니다." }]
    };
  }

  const frameName = parsed.frameName;
  if (typeof frameName !== "string" || frameName.length === 0) {
    items.push({ severity: "error", message: "frameName은 필수 문자열입니다." });
  } else {
    items.push({ severity: "success", message: "frameName을 확인했습니다." });
  }

  const sections: HairCampJson["sections"] = {};
  for (const [sectionName, sectionValue] of Object.entries(parsed)) {
    if (sectionName === "frameName") continue;

    if (!isRecord(sectionValue)) {
      items.push({ severity: "error", message: `${sectionName} Section 값은 객체여야 합니다.` });
      continue;
    }

    const layerEntries = Object.entries(sectionValue);
    if (layerEntries.length === 0) {
      items.push({ severity: "warning", message: `${sectionName} Section에 입력할 레이어가 없습니다.` });
    }

    sections[sectionName] = {};
    for (const [layerName, textValue] of layerEntries) {
      if (!layerName.startsWith(TEXT_LAYER_PREFIX)) {
        items.push({ severity: "error", message: `${layerName} 레이어 이름은 TXT_로 시작해야 합니다.` });
      }
      if (typeof textValue !== "string") {
        items.push({ severity: "error", message: `${sectionName}.${layerName} 값은 문자열이어야 합니다.` });
        continue;
      }
      if (textValue.length === 0) {
        items.push({ severity: "warning", message: `${sectionName}.${layerName} 값이 빈 문자열입니다.` });
      }
      sections[sectionName][layerName] = textValue;
    }
  }

  if (Object.keys(sections).length === 0) {
    items.push({ severity: "error", message: "frameName 외에 Section 데이터가 필요합니다." });
  }

  const hasError = items.some((item) => item.severity === "error");
  return {
    ok: !hasError,
    data: !hasError ? { frameName: frameName as string, sections } : undefined,
    items
  };
}

export function countTargets(data: HairCampJson): number {
  return Object.values(data.sections).reduce((sum, section) => sum + Object.keys(section).length, 0);
}
