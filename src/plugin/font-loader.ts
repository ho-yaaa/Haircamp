import { error, success } from "../shared/messages";
import type { StatusItem } from "../shared/types";

const fontKey = (font: FontName): string => `${font.family}\u0000${font.style}`;

function fontLabel(font: FontName): string {
  return `${font.family} ${font.style}`;
}

export function getTextFonts(node: TextNode): FontName[] {
  const fonts = new Map<string, FontName>();

  if (node.characters.length > 0) {
    for (const font of node.getRangeAllFontNames(0, node.characters.length)) {
      fonts.set(fontKey(font), font);
    }
  } else if (node.fontName !== figma.mixed) {
    fonts.set(fontKey(node.fontName), node.fontName);
  }

  return [...fonts.values()];
}

export async function loadFontsForText(node: TextNode): Promise<StatusItem[]> {
  const fonts = getTextFonts(node);
  if (fonts.length === 0) {
    return [error(`${node.name} 레이어의 기존 폰트를 확인할 수 없습니다.`)];
  }

  const items: StatusItem[] = [];
  for (const font of fonts) {
    try {
      await figma.loadFontAsync(font);
      items.push(success(`${node.name}: ${fontLabel(font)} 폰트를 불러왔습니다.`));
    } catch {
      items.push(error(`${node.name}: ${fontLabel(font)} 폰트를 불러올 수 없습니다.`));
    }
  }
  return items;
}

export async function loadFontsForTargets(targets: Iterable<TextNode>): Promise<StatusItem[]> {
  const seen = new Set<string>();
  const items: StatusItem[] = [];

  for (const target of targets) {
    for (const font of getTextFonts(target)) {
      const key = fontKey(font);
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        await figma.loadFontAsync(font);
        items.push(success(`${fontLabel(font)} 폰트를 불러왔습니다.`));
      } catch {
        items.push(error(`${target.name}: ${fontLabel(font)} 폰트를 불러올 수 없습니다.`));
      }
    }
  }

  return items;
}
