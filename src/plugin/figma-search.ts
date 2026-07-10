import { error, success } from "../shared/messages";
import type { HairCampJson, StatusItem, TemplateConfig } from "../shared/types";
import { TEXT_LAYER_PREFIX } from "../shared/constants";

type ContainerNode = SceneNode & ChildrenMixin;

const hasChildren = (node: SceneNode): node is ContainerNode => "children" in node;

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

export function placeCloneBesideSource(clone: SceneNode, source: SceneNode, template: TemplateConfig): void {
  if ("x" in clone && "x" in source && "width" in source) {
    clone.x = source.x + source.width + template.duplicateGap;
  }
  if ("y" in clone && "y" in source) {
    clone.y = source.y;
  }
}
