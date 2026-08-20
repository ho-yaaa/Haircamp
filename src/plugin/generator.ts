import { countTargets, parseJsonText } from "../shared/schema";
import { getImageSlot, makeCombinedSignature, validateSelectedImages } from "../shared/images";
import { error, success } from "../shared/messages";
import type { SelectedImagePayload, StatusItem, ValidationResult } from "../shared/types";
import { collectImageTargets, collectTargets, findUniqueSourceFrame, placeCloneBesideSource } from "./figma-search";
import { getTemplate, validateAll } from "./validation";
import { loadFontsForTargets } from "./font-loader";

export async function generate(jsonText: string, templateId: string, expectedSignature: string, images: SelectedImagePayload[] = []): Promise<ValidationResult> {
  const template = getTemplate(templateId);
  const signature = makeCombinedSignature(jsonText, template.id, images);
  if (signature !== expectedSignature) {
    return {
      ok: false,
      signature,
      imageCount: images.length,
      items: [error("JSON, Template 또는 이미지 선택 상태가 변경되었습니다. 다시 Validate를 실행해 주세요.")]
    };
  }

  const validation = await validateAll(jsonText, template.id, images);
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
    const imageFileItems = validateSelectedImages(images);
    const imageFileError = imageFileItems.find((item) => item.severity === "error");
    if (imageFileError) {
      throw new Error(imageFileError.message);
    }

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

    let changedImageCount = 0;
    if (images.length > 0) {
      items.push(success("이미지 적용을 시작합니다."));
      const imageTargetResult = collectImageTargets(clone, images);
      items.push(...imageTargetResult.items);
      if (imageTargetResult.targets.size !== images.length) {
        throw new Error(`선택한 이미지 슬롯 ${images.length}개 중 ${imageTargetResult.targets.size}개만 확인했습니다.`);
      }

      for (const selectedImage of images) {
        const slot = getImageSlot(selectedImage.slotId);
        const target = imageTargetResult.targets.get(selectedImage.slotId);
        if (!slot || !target) {
          throw new Error(`${selectedImage.slotId} 이미지 슬롯을 적용할 수 없습니다.`);
        }
        const image = figma.createImage(new Uint8Array(selectedImage.bytes));
        target.fills = [
          {
            type: "IMAGE",
            imageHash: image.hash,
            scaleMode: selectedImage.scaleMode
          }
        ];
        items.push(success(`${slot.displayName} 이미지를 적용했습니다.`));
        changedImageCount += 1;
      }
      items.push(success(`${changedImageCount}개 이미지를 적용했습니다.`));
    } else {
      items.push(success("선택된 이미지 없음 · 텍스트만 생성했습니다."));
    }

    items.push(success("원본 DETAIL_PAGE 보호를 확인했습니다."));

    figma.currentPage.selection = [clone];
    figma.viewport.scrollAndZoomIntoView([clone]);
    figma.notify("HairCamp 상세페이지 생성이 완료되었습니다.");

    items.push(success("HairCamp 상세페이지 초안이 생성되었습니다."));
    return { ok: true, data: parsed.data, items, signature, targetCount: changedCount, imageCount: changedImageCount };
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
      signature,
      imageCount: images.length
    };
  }
}
