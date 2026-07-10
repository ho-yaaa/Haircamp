"use strict";
(() => {
  // src/shared/constants.ts
  var PLUGIN_VERSION = "v1.0";
  var TEXT_LAYER_PREFIX = "TXT_";
  var templates = [
    {
      id: "haircamp-detail-v1",
      displayName: "HairCamp DETAIL_PAGE",
      sourceFrameName: "DETAIL_PAGE",
      duplicateGap: 200
    }
  ];
  var defaultTemplateId = templates[0].id;

  // src/shared/schema.ts
  var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  function makeSignature(jsonText, templateId) {
    let hash = 5381;
    const source = `${templateId}
${jsonText}`;
    for (let index = 0; index < source.length; index += 1) {
      hash = hash * 33 ^ source.charCodeAt(index);
    }
    return (hash >>> 0).toString(16);
  }
  function parseJsonText(jsonText) {
    const items = [];
    if (jsonText.length === 0) {
      return {
        ok: false,
        items: [{ severity: "error", message: "JSON \uC785\uB825\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4." }]
      };
    }
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
      items.push({ severity: "success", message: "JSON \uD615\uC2DD\uC774 \uC815\uC0C1\uC785\uB2C8\uB2E4." });
    } catch (error2) {
      return {
        ok: false,
        items: [
          {
            severity: "error",
            message: `JSON \uBB38\uBC95 \uC624\uB958: ${error2 instanceof Error ? error2.message : "\uC54C \uC218 \uC5C6\uB294 \uC624\uB958"}`
          }
        ]
      };
    }
    if (!isRecord(parsed)) {
      return {
        ok: false,
        items: [...items, { severity: "error", message: "JSON \uCD5C\uC0C1\uC704 \uAC12\uC740 \uAC1D\uCCB4\uC5EC\uC57C \uD569\uB2C8\uB2E4." }]
      };
    }
    const frameName = parsed.frameName;
    if (typeof frameName !== "string" || frameName.length === 0) {
      items.push({ severity: "error", message: "frameName\uC740 \uD544\uC218 \uBB38\uC790\uC5F4\uC785\uB2C8\uB2E4." });
    } else {
      items.push({ severity: "success", message: "frameName\uC744 \uD655\uC778\uD588\uC2B5\uB2C8\uB2E4." });
    }
    const sections = {};
    for (const [sectionName, sectionValue] of Object.entries(parsed)) {
      if (sectionName === "frameName") continue;
      if (!isRecord(sectionValue)) {
        items.push({ severity: "error", message: `${sectionName} Section \uAC12\uC740 \uAC1D\uCCB4\uC5EC\uC57C \uD569\uB2C8\uB2E4.` });
        continue;
      }
      const layerEntries = Object.entries(sectionValue);
      if (layerEntries.length === 0) {
        items.push({ severity: "warning", message: `${sectionName} Section\uC5D0 \uC785\uB825\uD560 \uB808\uC774\uC5B4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.` });
      }
      sections[sectionName] = {};
      for (const [layerName, textValue] of layerEntries) {
        if (!layerName.startsWith(TEXT_LAYER_PREFIX)) {
          items.push({ severity: "error", message: `${layerName} \uB808\uC774\uC5B4 \uC774\uB984\uC740 TXT_\uB85C \uC2DC\uC791\uD574\uC57C \uD569\uB2C8\uB2E4.` });
        }
        if (typeof textValue !== "string") {
          items.push({ severity: "error", message: `${sectionName}.${layerName} \uAC12\uC740 \uBB38\uC790\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.` });
          continue;
        }
        if (textValue.length === 0) {
          items.push({ severity: "warning", message: `${sectionName}.${layerName} \uAC12\uC774 \uBE48 \uBB38\uC790\uC5F4\uC785\uB2C8\uB2E4.` });
        }
        sections[sectionName][layerName] = textValue;
      }
    }
    if (Object.keys(sections).length === 0) {
      items.push({ severity: "error", message: "frameName \uC678\uC5D0 Section \uB370\uC774\uD130\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." });
    }
    const hasError = items.some((item) => item.severity === "error");
    return {
      ok: !hasError,
      data: !hasError ? { frameName, sections } : void 0,
      items
    };
  }
  function countTargets(data) {
    return Object.values(data.sections).reduce((sum, section) => sum + Object.keys(section).length, 0);
  }

  // src/shared/messages.ts
  var success = (message) => ({ severity: "success", message });
  var error = (message) => ({ severity: "error", message });

  // src/plugin/figma-search.ts
  var hasChildren = (node) => "children" in node;
  function walk(node, visit) {
    visit(node);
    if (!hasChildren(node)) return;
    for (const child of node.children) {
      walk(child, visit);
    }
  }
  function findSourceFrames(template) {
    const matches = [];
    for (const child of figma.currentPage.children) {
      if (child.name === template.sourceFrameName) {
        matches.push(child);
      }
    }
    return matches;
  }
  function findUniqueSourceFrame(template) {
    const matches = findSourceFrames(template);
    if (matches.length === 0) {
      return { items: [error(`${template.sourceFrameName} \uC6D0\uBCF8 Frame\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`)] };
    }
    if (matches.length > 1) {
      return { items: [error(`${template.sourceFrameName} \uC6D0\uBCF8 Frame\uC774 ${matches.length}\uAC1C \uBC1C\uACAC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`)] };
    }
    if (!hasChildren(matches[0])) {
      return { items: [error(`${template.sourceFrameName}\uC740 \uB0B4\uBD80 \uB808\uC774\uC5B4\uB97C \uAC00\uC9C4 Frame \uB610\uB294 \uCEE8\uD14C\uC774\uB108\uC5EC\uC57C \uD569\uB2C8\uB2E4.`)] };
    }
    return { node: matches[0], items: [success(`${template.sourceFrameName}\uB97C \uCC3E\uC558\uC2B5\uB2C8\uB2E4.`)] };
  }
  function findSection(root, sectionName) {
    const matches = [];
    if (!hasChildren(root)) {
      return { items: [error(`${root.name} \uB0B4\uBD80\uB97C \uAC80\uC0C9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`)] };
    }
    for (const child of root.children) {
      walk(child, (node) => {
        if (node.name === sectionName && hasChildren(node)) {
          matches.push(node);
        }
      });
    }
    if (matches.length === 0) {
      return { items: [error(`${sectionName} Section\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`)] };
    }
    if (matches.length > 1) {
      return { items: [error(`${sectionName} Section\uC774 ${matches.length}\uAC1C \uBC1C\uACAC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`)] };
    }
    return { node: matches[0], items: [success(`${sectionName} Section\uC744 \uCC3E\uC558\uC2B5\uB2C8\uB2E4.`)] };
  }
  function findTextLayer(section, layerName) {
    const matches = [];
    if (!hasChildren(section)) {
      return { items: [error(`${section.name} \uB0B4\uBD80\uB97C \uAC80\uC0C9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`)] };
    }
    walk(section, (node) => {
      if (node !== section && node.name === layerName) {
        matches.push(node);
      }
    });
    if (!layerName.startsWith(TEXT_LAYER_PREFIX)) {
      return { items: [error(`${layerName} \uB808\uC774\uC5B4 \uC774\uB984\uC740 TXT_\uB85C \uC2DC\uC791\uD574\uC57C \uD569\uB2C8\uB2E4.`)] };
    }
    if (matches.length === 0) {
      return { items: [error(`${section.name}.${layerName} \uB808\uC774\uC5B4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`)] };
    }
    if (matches.length > 1) {
      return { items: [error(`${section.name}.${layerName} \uB808\uC774\uC5B4\uAC00 ${matches.length}\uAC1C \uBC1C\uACAC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`)] };
    }
    if (matches[0].type !== "TEXT") {
      return { items: [error(`${section.name}.${layerName}\uC740 Text Layer\uAC00 \uC544\uB2D9\uB2C8\uB2E4.`)] };
    }
    return { node: matches[0], items: [success(`${layerName} Text Layer\uB97C \uCC3E\uC558\uC2B5\uB2C8\uB2E4.`)] };
  }
  function collectTargets(root, data) {
    const targets = /* @__PURE__ */ new Map();
    const items = [];
    for (const [sectionName, layers] of Object.entries(data.sections)) {
      const sectionResult = findSection(root, sectionName);
      items.push(...sectionResult.items);
      if (!sectionResult.node) continue;
      for (const layerName of Object.keys(layers)) {
        const layerResult = findTextLayer(sectionResult.node, layerName);
        items.push(...layerResult.items);
        if (layerResult.node) {
          targets.set(`${sectionName}\0${layerName}`, layerResult.node);
        }
      }
    }
    return { targets, items };
  }
  function placeCloneBesideSource(clone, source, template) {
    if ("x" in clone && "x" in source && "width" in source) {
      clone.x = source.x + source.width + template.duplicateGap;
    }
    if ("y" in clone && "y" in source) {
      clone.y = source.y;
    }
  }

  // src/plugin/font-loader.ts
  var fontKey = (font) => `${font.family}\0${font.style}`;
  function fontLabel(font) {
    return `${font.family} ${font.style}`;
  }
  function getTextFonts(node) {
    const fonts = /* @__PURE__ */ new Map();
    if (node.characters.length > 0) {
      for (const font of node.getRangeAllFontNames(0, node.characters.length)) {
        fonts.set(fontKey(font), font);
      }
    } else if (node.fontName !== figma.mixed) {
      fonts.set(fontKey(node.fontName), node.fontName);
    }
    return [...fonts.values()];
  }
  async function loadFontsForTargets(targets) {
    const seen = /* @__PURE__ */ new Set();
    const items = [];
    for (const target of targets) {
      for (const font of getTextFonts(target)) {
        const key = fontKey(font);
        if (seen.has(key)) continue;
        seen.add(key);
        try {
          await figma.loadFontAsync(font);
          items.push(success(`${fontLabel(font)} \uD3F0\uD2B8\uB97C \uBD88\uB7EC\uC654\uC2B5\uB2C8\uB2E4.`));
        } catch {
          items.push(error(`${target.name}: ${fontLabel(font)} \uD3F0\uD2B8\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`));
        }
      }
    }
    return items;
  }

  // src/plugin/validation.ts
  function getTemplate(templateId) {
    return templates.find((template) => template.id === templateId) ?? templates[0];
  }
  async function validateAll(jsonText, templateId) {
    const template = getTemplate(templateId);
    const parsed = parseJsonText(jsonText);
    const signature = makeSignature(jsonText, template.id);
    const items = [...parsed.items];
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
      items.push(success(`\uCD1D ${targetResult.targets.size}\uAC1C\uC758 \uD14D\uC2A4\uD2B8 \uB808\uC774\uC5B4\uB97C \uD655\uC778\uD588\uC2B5\uB2C8\uB2E4.`));
    } else {
      items.push(error(`\uB300\uC0C1 \uD14D\uC2A4\uD2B8 \uB808\uC774\uC5B4 ${expectedCount}\uAC1C \uC911 ${targetResult.targets.size}\uAC1C\uB9CC \uD655\uC778\uD588\uC2B5\uB2C8\uB2E4.`));
    }
    const fontItems = await loadFontsForTargets(targetResult.targets.values());
    items.push(...fontItems);
    const ok = !items.some((item) => item.severity === "error");
    if (ok) {
      items.push(success("Generate\uB97C \uC2E4\uD589\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."));
    }
    return {
      ok,
      data: parsed.data,
      items,
      signature,
      targetCount: targetResult.targets.size
    };
  }

  // src/plugin/generator.ts
  async function generate(jsonText, templateId, expectedSignature) {
    const template = getTemplate(templateId);
    const signature = makeSignature(jsonText, template.id);
    if (signature !== expectedSignature) {
      return {
        ok: false,
        signature,
        items: [error("JSON \uB610\uB294 Template\uC774 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC Validate\uB97C \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.")]
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
    const items = [success("Generate \uC804 \uC6D0\uBCF8 DETAIL_PAGE\uB97C \uB2E4\uC2DC \uD655\uC778\uD588\uC2B5\uB2C8\uB2E4.")];
    let clone;
    try {
      clone = source.clone();
      clone.name = parsed.data.frameName;
      placeCloneBesideSource(clone, source, template);
      items.push(success("DETAIL_PAGE \uBCF5\uC81C\uBCF8\uC744 \uC0DD\uC131\uD588\uC2B5\uB2C8\uB2E4."));
      items.push(success("\uBCF5\uC81C\uBCF8 Frame \uC774\uB984\uC744 \uBCC0\uACBD\uD588\uC2B5\uB2C8\uB2E4."));
      const targetResult = collectTargets(clone, parsed.data);
      items.push(...targetResult.items);
      const expectedCount = countTargets(parsed.data);
      if (targetResult.targets.size !== expectedCount) {
        throw new Error(`\uB300\uC0C1 \uD14D\uC2A4\uD2B8 \uB808\uC774\uC5B4 ${expectedCount}\uAC1C \uC911 ${targetResult.targets.size}\uAC1C\uB9CC \uD655\uC778\uD588\uC2B5\uB2C8\uB2E4.`);
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
          const target = targetResult.targets.get(`${sectionName}\0${layerName}`);
          if (!target) {
            throw new Error(`${sectionName}.${layerName} \uB808\uC774\uC5B4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`);
          }
          target.characters = value;
          changedCount += 1;
        }
      }
      items.push(success(`${changedCount}\uAC1C \uD14D\uC2A4\uD2B8\uB97C \uC785\uB825\uD588\uC2B5\uB2C8\uB2E4.`));
      items.push(success("\uC6D0\uBCF8 DETAIL_PAGE \uBCF4\uD638\uB97C \uD655\uC778\uD588\uC2B5\uB2C8\uB2E4."));
      figma.currentPage.selection = [clone];
      figma.viewport.scrollAndZoomIntoView([clone]);
      figma.notify("HairCamp \uC0C1\uC138\uD398\uC774\uC9C0 \uC0DD\uC131\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      items.push(success("HairCamp \uC0C1\uC138\uD398\uC774\uC9C0 \uCD08\uC548\uC774 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4."));
      return { ok: true, data: parsed.data, items, signature, targetCount: changedCount };
    } catch (caught) {
      if (clone) {
        clone.remove();
      }
      const message = caught instanceof Error ? caught.message : "\uC54C \uC218 \uC5C6\uB294 Generate \uC624\uB958";
      figma.notify("\uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uBCF5\uC81C\uBCF8\uC744 \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4.", { error: true });
      return {
        ok: false,
        data: parsed.data,
        items: [...items, error(message), success("\uC2E4\uD328\uD55C \uBCF5\uC81C\uBCF8\uC744 \uC0AD\uC81C\uD588\uACE0 \uC6D0\uBCF8\uC740 \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4.")],
        signature
      };
    }
  }

  // src/plugin/main.ts
  figma.showUI(__html__, { width: 420, height: 680, themeColors: true });
  function post(message) {
    figma.ui.postMessage(message);
  }
  post({ type: "file-info", fileName: figma.root.name || "\uD604\uC7AC Figma \uD30C\uC77C" });
  figma.ui.onmessage = async (message) => {
    if (message.type === "request-file-info") {
      post({ type: "file-info", fileName: figma.root.name || "\uD604\uC7AC Figma \uD30C\uC77C" });
      return;
    }
    if (message.type === "validate") {
      const result = await validateAll(message.jsonText, message.templateId || defaultTemplateId);
      post({ type: "validation-result", result });
      return;
    }
    if (message.type === "generate") {
      const result = await generate(message.jsonText, message.templateId || defaultTemplateId, message.signature);
      post({ type: "generation-result", result });
    }
  };
  console.info(`HairCamp Figma Generator ${PLUGIN_VERSION} loaded.`);
})();
