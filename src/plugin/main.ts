import { defaultTemplateId, PLUGIN_VERSION } from "../shared/constants";
import type { PluginToUiMessage, UiToPluginMessage } from "../shared/types";
import { generate } from "./generator";
import { validateAll } from "./validation";

figma.showUI(__html__, { width: 420, height: 680, themeColors: true });

function post(message: PluginToUiMessage): void {
  figma.ui.postMessage(message);
}

post({ type: "file-info", fileName: figma.root.name || "현재 Figma 파일" });

figma.ui.onmessage = async (message: UiToPluginMessage) => {
  if (message.type === "request-file-info") {
    post({ type: "file-info", fileName: figma.root.name || "현재 Figma 파일" });
    return;
  }

  if (message.type === "validate") {
    const result = await validateAll(message.jsonText, message.templateId || defaultTemplateId, message.images);
    post({ type: "validation-result", result });
    return;
  }

  if (message.type === "generate") {
    const result = await generate(message.jsonText, message.templateId || defaultTemplateId, message.signature, message.images);
    post({ type: "generation-result", result });
  }
};

console.info(`HairCamp Figma Generator ${PLUGIN_VERSION} loaded.`);
