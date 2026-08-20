import { error, success } from "../shared/messages";
import type { HairCampJson, ImageSlotConfig, SelectedImagePayload, StatusItem, TemplateConfig } from "../shared/types";
import { IMAGE_LAYER_PREFIX, TEXT_LAYER_PREFIX } from "../shared/constants";
import { getImageSlot } from "../shared/images";

type ContainerNode = SceneNode & ChildrenMixin;
export type FillableImageNode = SceneNode & MinimalFillsMixin;

const hasChildren = (node: SceneNode): node is ContainerNode => "children" in node;
const hasFills = (node: SceneNode): node is FillableImageNode => "fills" in node && node.type !== "TEXT";

function walk(node: SceneNode, visit: (node: SceneNode) => void): void {
  visit(node);
  if (!hasChildren(node)) return;
  for (const child of node.children) {
    walk(child, visit);
  }
}

export function findSourceFrames(template: TemplateConfig): SceneNode[] {
  const matches: SceneNode[] = [];
  for (const child of figma.currentPage.children) {
    if (child.name === template.sourceFrameName) {
      matches.push(child);
    }
  }
  return matches;
}

export function findUniqueSourceFrame(template: TemplateConfig): { node?: SceneNode; items: StatusItem[] } {
  const matches = findSourceFrames(template);
  if (matches.length === 0) {
    return { items: [error(`${template.sourceFrameName} 원본 Frame을 찾을 수 없습니다.`)] };
  }
  if (matches.length > 1) {
    return { items: [error(`${template.sourceFrameName} 원본 Frame이 ${matches.length}개 발견되었습니다.`)] };
  }
  if (!hasChildren(matches[0])) {
    return { items: [error(`${template.sourceFrameName}은 내부 레이어를 가진 Frame 또는 컨테이너여야 합니다.`)] };
  }
  return { node: matches[0], items: [success(`${template.sourceFrameName}를 찾았습니다.`)] };
}

export function findSection(root: SceneNode, sectionName: string): { node?: SceneNode; items: StatusItem[] } {
  const matches: SceneNode[] = [];
  if (!hasChildren(root)) {
    return { items: [error(`${root.name} 내부를 검색할 수 없습니다.`)] };
  }

  for (const child of root.children) {
    walk(child, (node) => {
      if (node.name === sectionName && hasChildren(node)) {
        matches.push(node);
      }
    });
  }

  if (matches.length === 0) {
    return { items: [error(`${sectionName} Section을 찾을 수 없습니다.`)] };
  }
  if (matches.length > 1) {
    return { items: [error(`${sectionName} Section이 ${matches.length}개 발견되었습니다.`)] };
  }
  return { node: matches[0], items: [success(`${sectionName} Section을 찾았습니다.`)] };
}

export function findTextLayer(section: SceneNode, layerName: string): { node?: TextNode; items: StatusItem[] } {
  const matches: SceneNode[] = [];
  if (!hasChildren(section)) {
    return { items: [error(`${section.name} 내부를 검색할 수 없습니다.`)] };
  }

  walk(section, (node) => {
    if (node !== section && node.name === layerName) {
      matches.push(node);
    }
  });

  if (!layerName.startsWith(TEXT_LAYER_PREFIX)) {
    return { items: [error(`${layerName} 레이어 이름은 TXT_로 시작해야 합니다.`)] };
  }
  if (matches.length === 0) {
    return { items: [error(`${section.name}.${layerName} 레이어를 찾을 수 없습니다.`)] };
  }
  if (matches.length > 1) {
    return { items: [error(`${section.name}.${layerName} 레이어가 ${matches.length}개 발견되었습니다.`)] };
  }
  if (matches[0].type !== "TEXT") {
    return { items: [error(`${section.name}.${layerName}은 Text Layer가 아닙니다.`)] };
  }
  return { node: matches[0], items: [success(`${layerName} Text Layer를 찾았습니다.`)] };
}

export function findImageLayer(section: SceneNode, slot: ImageSlotConfig): { node?: FillableImageNode; items: StatusItem[] } {
  const matches: SceneNode[] = [];
  if (!hasChildren(section)) {
    return { items: [error(`${section.name} 내부를 검색할 수 없습니다.`)] };
  }

  walk(section, (node) => {
    if (node !== section && node.name === slot.layerName) {
      matches.push(node);
    }
  });

  if (!slot.layerName.startsWith(IMAGE_LAYER_PREFIX)) {
    return { items: [error(`${slot.layerName} 레이어 이름은 IMG_로 시작해야 합니다.`)] };
  }
  if (matches.length === 0) {
    return { items: [error(`${slot.sectionName} 안에서 ${slot.layerName} 레이어를 찾을 수 없습니다.`)] };
  }
  if (matches.length > 1) {
    return { items: [error(`${slot.sectionName} 안에 ${slot.layerName} 레이어가 ${matches.length}개 발견되었습니다. 레이어 이름을 확인해 주세요.`)] };
  }
  if (!hasFills(matches[0]) || matches[0].fills === figma.mixed) {
    return { items: [error(`${slot.layerName}은 이미지를 적용할 수 있는 레이어가 아닙니다. 사진 Fill이 적용된 도형 또는 프레임인지 확인해 주세요.`)] };
  }

  return { node: matches[0], items: [success(`${slot.displayName} 대상 레이어를 찾았습니다.`)] };
}

export function collectTargets(root: SceneNode, data: HairCampJson): { targets: Map<string, TextNode>; items: StatusItem[] } {
  const targets = new Map<string, TextNode>();
  const items: StatusItem[] = [];

  for (const [sectionName, layers] of Object.entries(data.sections)) {
    const sectionResult = findSection(root, sectionName);
    items.push(...sectionResult.items);
    if (!sectionResult.node) continue;

    for (const layerName of Object.keys(layers)) {
      const layerResult = findTextLayer(sectionResult.node, layerName);
      items.push(...layerResult.items);
      if (layerResult.node) {
        targets.set(`${sectionName}\u0000${layerName}`, layerResult.node);
      }
    }
  }

  return { targets, items };
}

export function collectImageTargets(root: SceneNode, images: SelectedImagePayload[]): { targets: Map<string, FillableImageNode>; items: StatusItem[] } {
  const targets = new Map<string, FillableImageNode>();
  const items: StatusItem[] = [];

  for (const image of images) {
    const slot = getImageSlot(image.slotId);
    if (!slot) {
      items.push(error(`${image.slotId} 이미지 슬롯을 찾을 수 없습니다.`));
      continue;
    }

    const sectionResult = findSection(root, slot.sectionName);
    items.push(...sectionResult.items);
    if (!sectionResult.node) continue;

    const layerResult = findImageLayer(sectionResult.node, slot);
    items.push(...layerResult.items);
    if (layerResult.node) {
      targets.set(slot.id, layerResult.node);
    }
  }

  return { targets, items };
}

export function placeCloneBesideSource(clone: SceneNode, source: SceneNode, template: TemplateConfig): void {
  if ("x" in clone && "x" in source && "width" in source) {
    clone.x = source.x + source.width + template.duplicateGap;
  }
  if ("y" in clone && "y" in source) {
    clone.y = source.y;
  }
}
