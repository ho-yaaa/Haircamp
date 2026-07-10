import { templates } from "../shared/constants";
import { countTargets, makeSignature, parseJsonText } from "../shared/schema";
import { error, success } from "../shared/messages";
import type { StatusItem, ValidationResult } from "../shared/types";
import { collectTargets, findUniqueSourceFrame } from "./figma-search";
import { loadFontsForTargets } from "./font-loader";

export function getTemplate(templateId: string) {
  return templates.find((template) => template.id === templateId) ?? templates[0];
}

export async function validateAll(jsonText: string, templateId: string): Promise<ValidationResult> {
  const template = getTemplate(templateId);
  const parsed = parseJsonText(jsonText);
  const signature = makeSignature(jsonText, template.id);
  const items: StatusItem[] = [...parsed.items];

  if (!parsed.ok || !parsed.data) {
    return { ok: false, items, signature };
  }

  const sourceResult = findUniqueSourceFrame(template);
  items.push(...sourceResult.items);
  if (!sourceResult.node) {
    return { ok: false, data: parsed.data, items, signature };
  }

  const targetResult = collectTargets(sourceResult.node, parsed.data);
  items.push(...targetResult.items);

  const expectedCount = countTargets(parsed.data);
  if (targetResult.targets.size === expectedCount) {
    items.push(success(`총 ${targetResult.targets.size}개의 텍스트 레이어를 확인했습니다.`));
  } else {
    items.push(error(`대상 텍스트 레이어 ${expectedCount}개 중 ${targetResult.targets.size}개만 확인했습니다.`));
  }

  const fontItems = await loadFontsForTargets(targetResult.targets.values());
  items.push(...fontItems);

  const ok = !items.some((item) => item.severity === "error");
  if (ok) {
    items.push(success("Generate를 실행할 수 있습니다."));
  }

  return {
    ok,
    data: parsed.data,
    items,
    signature,
    targetCount: targetResult.targets.size
  };
}
