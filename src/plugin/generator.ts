import { countTargets, makeSignature, parseJsonText } from "../shared/schema";
import { error, success } from "../shared/messages";
import type { StatusItem, ValidationResult } from "../shared/types";
import { collectTargets, findUniqueSourceFrame, placeCloneBesideSource } from "./figma-search";
import { getTemplate, validateAll } from "./validation";
import { loadFontsForTargets } from "./font-loader";

export async function generate(jsonText: string, templateId: string, expectedSignature: string): Promise<ValidationResult> {
  const template = getTemplate(templateId);
  const signature = makeSignature(jsonText, template.id);
  if (signature !== expectedSignature) {
    return {
      ok: false,
      signature,
      items: [error("JSON 또는 Template이 변경되었습니다. 다시 Validate를 실행해 주세요.")]
    };
  }

  const validation = await validateAll(jsonText, template.id);
  if (!validation.ok || !validation.data) {
    return validation;
  }

  const parsed = parseJsonText(jsonText);
  if (!parsed.ok || !parsed.data) return parsed;

  const sourceResult = findUniqueSourceFrame(template);
  if (!sourceResult.node) {
    return { ok: false, data: parsed.data, signature, items: sourceResult.items };
  }

  const source = sourceResult.node;
  const items: StatusItem[] = [success("Generate 전 원본 DETAIL_PAGE를 다시 확인했습니다.")];
  let clone: SceneNode | undefined;

  try {
    clone = source.clone();
    clone.name = parsed.data.frameName;
    placeCloneBesideSource(clone, source, template);
    items.push(success("DETAIL_PAGE 복제본을 생성했습니다."));
    items.push(success("복제본 Frame 이름을 변경했습니다."));

    const targetResult = collectTargets(clone, parsed.data);
    items.push(...targetResult.items);

    const expectedCount = countTargets(parsed.data);
    if (targetResult.targets.size !== expectedCount) {
      throw new Error(`대상 텍스트 레이어 ${expectedCount}개 중 ${targetResult.targets.size}개만 확인했습니다.`);
    }

    const fontItems = await loadFontsForTargets(targetResult.targets.values());
    items.push(...fontItems);
    const fontError = fontItems.find((item) => item.severity === "error");
    if (fontError) {
      throw new Error(fontError.message);
    }

    let changedCount = 0;
    for (const [sectionName, layers] of Object.entries(parsed.data.sections)) {
      for (const [layerName, value] of Object.entries(layers)) {
        const target = targetResult.targets.get(`${sectionName}\u0000${layerName}`);
        if (!target) {
          throw new Error(`${sectionName}.${layerName} 레이어를 찾을 수 없습니다.`);
        }
        target.characters = value;
        changedCount += 1;
      }
    }

    items.push(success(`${changedCount}개 텍스트를 입력했습니다.`));
    items.push(success("원본 DETAIL_PAGE 보호를 확인했습니다."));

    figma.currentPage.selection = [clone];
    figma.viewport.scrollAndZoomIntoView([clone]);
    figma.notify("HairCamp 상세페이지 생성이 완료되었습니다.");

    items.push(success("HairCamp 상세페이지 초안이 생성되었습니다."));
    return { ok: true, data: parsed.data, items, signature, targetCount: changedCount };
  } catch (caught) {
    if (clone) {
      clone.remove();
    }
    const message = caught instanceof Error ? caught.message : "알 수 없는 Generate 오류";
    figma.notify("생성에 실패했습니다. 복제본을 삭제했습니다.", { error: true });
    return {
      ok: false,
      data: parsed.data,
      items: [...items, error(message), success("실패한 복제본을 삭제했고 원본은 유지했습니다.")],
      signature
    };
  }
}
