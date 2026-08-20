import { defaultTemplateId, imageSlots, PLUGIN_VERSION, templates } from "../shared/constants";
import { makeCombinedSignature, validateSelectedImages } from "../shared/images";
import type {
  ImageScaleMode,
  PluginToUiMessage,
  SelectedImagePayload,
  Severity,
  StatusItem,
  UiToPluginMessage,
  ValidationResult
} from "../shared/types";

type UiState = "idle" | "has-json" | "validating" | "valid" | "invalid" | "generating" | "generated" | "failed";

type SelectedImageState = SelectedImagePayload & {
  thumbnailUrl: string;
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root not found");
const appRoot = app;

let jsonText = "";
let selectedTemplateId = defaultTemplateId;
let fileName = "현재 Figma 파일";
let uiState: UiState = "idle";
let statusItems: StatusItem[] = [];
let lastValidSignature = "";
let lastValidationOk = false;
let selectedImages: Record<string, SelectedImageState | undefined> = {};
let scaleModes: Record<string, ImageScaleMode> = Object.fromEntries(imageSlots.map((slot) => [slot.id, slot.defaultScaleMode]));

function post(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function getSelectedImagePayloads(): SelectedImagePayload[] {
  return imageSlots.flatMap((slot) => {
    const image = selectedImages[slot.id];
    if (!image) return [];
    return [
      {
        slotId: image.slotId,
        fileName: image.fileName,
        mimeType: image.mimeType,
        byteLength: image.byteLength,
        width: image.width,
        height: image.height,
        scaleMode: scaleModes[slot.id] ?? image.scaleMode,
        bytes: image.bytes
      }
    ];
  });
}

function currentSignature(): string {
  return makeCombinedSignature(jsonText, selectedTemplateId, getSelectedImagePayloads());
}

function severityMark(severity: Severity): string {
  if (severity === "success") return "✓";
  if (severity === "warning") return "!";
  if (severity === "error") return "×";
  return "•";
}

function setStatusFromResult(result: ValidationResult, validState: UiState, invalidState: UiState): void {
  statusItems = result.items;
  lastValidSignature = result.ok && result.signature ? result.signature : "";
  lastValidationOk = result.ok;
  uiState = result.ok ? validState : invalidState;
  render();
}

async function readJsonFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".json")) {
    statusItems = [{ severity: "error", message: ".json 파일만 업로드할 수 있습니다." }];
    uiState = "failed";
    render();
    return;
  }
  jsonText = await file.text();
  resetValidation([{ severity: "info", message: `${file.name} 파일 내용을 불러왔습니다.` }]);
}

function resetValidation(nextItems: StatusItem[] = []): void {
  lastValidSignature = "";
  lastValidationOk = false;
  statusItems = nextItems;
  uiState = jsonText.length > 0 ? "has-json" : "idle";
  render();
}

function readImageDimensions(file: File): Promise<{ width: number; height: number; thumbnailUrl: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxPreviewSize = 96;
      const ratio = Math.min(maxPreviewSize / image.width, maxPreviewSize / image.height, 1);
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.75);
      URL.revokeObjectURL(url);
      resolve({ width: image.width, height: image.height, thumbnailUrl });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지 파일을 읽을 수 없습니다."));
    };
    image.src = url;
  });
}

async function readImageFile(slotId: string, file: File): Promise<void> {
  const slot = imageSlots.find((item) => item.id === slotId);
  if (!slot) return;

  try {
    const { width, height, thumbnailUrl } = await readImageDimensions(file);
    const bytes = [...new Uint8Array(await file.arrayBuffer())];
    const image: SelectedImageState = {
      slotId,
      fileName: file.name,
      mimeType: file.type,
      byteLength: file.size,
      width,
      height,
      scaleMode: scaleModes[slotId] ?? slot.defaultScaleMode,
      bytes,
      thumbnailUrl
    };

    const validationItems = validateSelectedImages([image]);
    const errorItem = validationItems.find((item) => item.severity === "error");
    if (errorItem) {
      statusItems = [errorItem];
      uiState = "failed";
      render();
      return;
    }

    selectedImages = { ...selectedImages, [slotId]: image };
    resetValidation([{ severity: "info", message: `${slot.displayName}: ${file.name} 이미지를 선택했습니다.` }]);
  } catch (caught) {
    statusItems = [{ severity: "error", message: `${slot.displayName}: ${caught instanceof Error ? caught.message : "이미지 파일을 읽을 수 없습니다."}` }];
    uiState = "failed";
    render();
  }
}

function clearImage(slotId: string): void {
  const slot = imageSlots.find((item) => item.id === slotId);
  selectedImages = { ...selectedImages, [slotId]: undefined };
  resetValidation([{ severity: "info", message: `${slot?.displayName ?? slotId} 선택을 취소했습니다.` }]);
}

function renderStatus(): string {
  if (statusItems.length === 0) {
    return `<div class="empty-status">JSON을 입력한 뒤 Validate를 실행하세요.</div>`;
  }
  return statusItems
    .map((item) => `<div class="status-item ${item.severity}"><span>${severityMark(item.severity)}</span><p>${escapeHtml(item.message)}</p></div>`)
    .join("");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function renderImageGroups(isBusy: boolean): string {
  const groupNames = [...new Set(imageSlots.map((slot) => slot.groupName))];
  return groupNames
    .map((groupName) => {
      const slots = imageSlots.filter((slot) => slot.groupName === groupName);
      return `
        <details class="image-group" open>
          <summary>${escapeHtml(groupName)}</summary>
          <div class="image-slot-list">
            ${slots.map((slot) => renderImageSlot(slot.id, isBusy)).join("")}
          </div>
        </details>
      `;
    })
    .join("");
}

function renderImageSlot(slotId: string, isBusy: boolean): string {
  const slot = imageSlots.find((item) => item.id === slotId);
  if (!slot) return "";
  const image = selectedImages[slotId];
  const scaleMode = scaleModes[slotId] ?? slot.defaultScaleMode;
  return `
    <div class="image-slot">
      <div class="image-thumb ${image ? "" : "empty"}">
        ${image ? `<img src="${image.thumbnailUrl}" alt="" />` : `<span>IMG</span>`}
      </div>
      <div class="image-meta">
        <strong>${escapeHtml(slot.displayName)}</strong>
        <span>${escapeHtml(slot.sectionName)} · ${escapeHtml(slot.layerName)}</span>
        <small>${image ? `${escapeHtml(image.fileName)} · ${image.width}x${image.height}px` : "선택 안 함 · 기존 이미지 유지"}</small>
      </div>
      <div class="image-controls">
        <label class="file-button">
          사진 선택
          <input class="image-file-input" data-slot-id="${slot.id}" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" ${isBusy ? "disabled" : ""} />
        </label>
        <select class="scale-select" data-slot-id="${slot.id}" ${isBusy ? "disabled" : ""}>
          <option value="FILL" ${scaleMode === "FILL" ? "selected" : ""}>FILL</option>
          <option value="FIT" ${scaleMode === "FIT" ? "selected" : ""}>FIT</option>
        </select>
        <button class="ghost clear-image-btn" data-slot-id="${slot.id}" ${isBusy || !image ? "disabled" : ""}>취소</button>
      </div>
    </div>
  `;
}

function render(): void {
  const isBusy = uiState === "validating" || uiState === "generating";
  const canValidate = jsonText.length > 0 && !isBusy;
  const canGenerate = lastValidationOk && lastValidSignature === currentSignature() && !isBusy;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const selectedImageCount = getSelectedImagePayloads().length;

  appRoot.innerHTML = `
    <main>
      <header class="topbar">
        <div>
          <h1>HairCamp Figma Generator</h1>
          <span>${PLUGIN_VERSION}</span>
        </div>
        <span class="state-pill">${stateLabel(uiState)}</span>
      </header>

      <section class="band">
        <h2>현재 Figma 파일</h2>
        <div class="file-row">
          <strong>${escapeHtml(fileName)}</strong>
          <span class="connected"><i></i>연결됨</span>
        </div>
      </section>

      <section class="band">
        <div class="section-title">
          <h2>JSON 데이터</h2>
          <button id="clearBtn" class="ghost" ${isBusy || jsonText.length === 0 ? "disabled" : ""}>입력 내용 지우기</button>
        </div>
        <textarea id="jsonInput" spellcheck="false" placeholder="ChatGPT가 작성한 HairCamp JSON을 붙여넣으세요." ${isBusy ? "disabled" : ""}>${escapeHtml(jsonText)}</textarea>
        <div id="dropZone" class="drop-zone">
          <input id="fileInput" type="file" accept=".json,application/json" ${isBusy ? "disabled" : ""} />
          <span>JSON 파일 업로드 또는 드래그 앤 드롭</span>
        </div>
      </section>

      <section class="band image-upload-band">
        <div class="section-title">
          <h2>이미지 업로드 · 선택사항</h2>
          <span class="image-count">${selectedImageCount}/11 선택됨</span>
        </div>
        <p class="helper-text">각 영역에서 사진을 직접 선택하면 파일명을 변경하지 않아도 됩니다. 이미지를 선택하지 않은 영역은 템플릿의 기존 이미지가 유지됩니다.</p>
        ${renderImageGroups(isBusy)}
      </section>

      <section class="band compact">
        <h2>Template</h2>
        <select id="templateSelect" ${isBusy ? "disabled" : ""}>
          ${templates.map((template) => `<option value="${template.id}" ${template.id === selectedTemplate.id ? "selected" : ""}>${template.displayName}</option>`).join("")}
        </select>
      </section>

      <section class="actions">
        <button id="validateBtn" class="primary" ${canValidate ? "" : "disabled"}>${uiState === "validating" ? "검사 중..." : "Validate"}</button>
        <button id="generateBtn" class="accent" ${canGenerate ? "" : "disabled"}>${uiState === "generating" ? "생성 중..." : "Generate"}</button>
      </section>

      <section class="band status-band">
        <h2>검사 및 작업 상태</h2>
        <div class="status-list">${renderStatus()}</div>
      </section>
    </main>
  `;

  bindEvents();
}

function stateLabel(state: UiState): string {
  const labels: Record<UiState, string> = {
    idle: "기본",
    "has-json": "JSON 입력됨",
    validating: "검사 중",
    valid: "검사 성공",
    invalid: "검사 실패",
    generating: "생성 중",
    generated: "생성 성공",
    failed: "생성 실패"
  };
  return labels[state];
}

function bindEvents(): void {
  document.querySelector<HTMLTextAreaElement>("#jsonInput")?.addEventListener("input", (event) => {
    jsonText = (event.target as HTMLTextAreaElement).value;
    resetValidation();
  });

  document.querySelector<HTMLButtonElement>("#clearBtn")?.addEventListener("click", () => {
    jsonText = "";
    resetValidation();
  });

  document.querySelector<HTMLSelectElement>("#templateSelect")?.addEventListener("change", (event) => {
    selectedTemplateId = (event.target as HTMLSelectElement).value;
    resetValidation();
  });

  document.querySelector<HTMLInputElement>("#fileInput")?.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) await readJsonFile(file);
  });

  document.querySelectorAll<HTMLInputElement>(".image-file-input").forEach((input) => {
    input.addEventListener("change", async (event) => {
      const target = event.target as HTMLInputElement;
      const slotId = target.dataset.slotId;
      const file = target.files?.[0];
      if (slotId && file) await readImageFile(slotId, file);
    });
  });

  document.querySelectorAll<HTMLSelectElement>(".scale-select").forEach((select) => {
    select.addEventListener("change", (event) => {
      const target = event.target as HTMLSelectElement;
      const slotId = target.dataset.slotId;
      const value = target.value === "FIT" ? "FIT" : "FILL";
      if (!slotId) return;
      scaleModes = { ...scaleModes, [slotId]: value };
      const image = selectedImages[slotId];
      if (image) {
        selectedImages = { ...selectedImages, [slotId]: { ...image, scaleMode: value } };
      }
      resetValidation([{ severity: "info", message: "이미지 맞춤 방식이 변경되었습니다. 다시 Validate를 실행해 주세요." }]);
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".clear-image-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const slotId = button.dataset.slotId;
      if (slotId) clearImage(slotId);
    });
  });

  const dropZone = document.querySelector<HTMLDivElement>("#dropZone");
  dropZone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
  dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
  dropZone?.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
    const file = event.dataTransfer?.files?.[0];
    if (file) await readJsonFile(file);
  });

  document.querySelector<HTMLButtonElement>("#validateBtn")?.addEventListener("click", () => {
    uiState = "validating";
    statusItems = [{ severity: "info", message: "JSON, 텍스트 레이어, 선택 이미지 슬롯을 검사하고 있습니다." }];
    render();
    post({ type: "validate", jsonText, templateId: selectedTemplateId, signature: currentSignature(), images: getSelectedImagePayloads() });
  });

  document.querySelector<HTMLButtonElement>("#generateBtn")?.addEventListener("click", () => {
    uiState = "generating";
    const imageCount = getSelectedImagePayloads().length;
    statusItems = [
      {
        severity: "info",
        message: imageCount > 0 ? "복제본을 생성하고 텍스트와 이미지를 적용하고 있습니다." : "복제본을 생성하고 텍스트를 입력하고 있습니다."
      }
    ];
    render();
    post({ type: "generate", jsonText, templateId: selectedTemplateId, signature: lastValidSignature, images: getSelectedImagePayloads() });
  });
}

window.onmessage = (event: MessageEvent<{ pluginMessage?: PluginToUiMessage }>) => {
  const message = event.data.pluginMessage;
  if (!message) return;

  if (message.type === "file-info") {
    fileName = message.fileName;
    render();
    return;
  }

  if (message.type === "validation-result") {
    setStatusFromResult(message.result, "valid", "invalid");
    return;
  }

  if (message.type === "generation-result") {
    setStatusFromResult(message.result, "generated", "failed");
  }
};

post({ type: "request-file-info" });
render();
