import { defaultTemplateId, PLUGIN_VERSION, templates } from "../shared/constants";
import { makeSignature } from "../shared/schema";
import type { PluginToUiMessage, Severity, StatusItem, UiToPluginMessage, ValidationResult } from "../shared/types";

type UiState = "idle" | "has-json" | "validating" | "valid" | "invalid" | "generating" | "generated" | "failed";

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

function post(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
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

function render(): void {
  const isBusy = uiState === "validating" || uiState === "generating";
  const currentSignature = makeSignature(jsonText, selectedTemplateId);
  const canValidate = jsonText.length > 0 && !isBusy;
  const canGenerate = lastValidationOk && lastValidSignature === currentSignature && !isBusy;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];

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
    statusItems = [{ severity: "info", message: "JSON과 Figma 템플릿을 검사하고 있습니다." }];
    render();
    post({ type: "validate", jsonText, templateId: selectedTemplateId, signature: makeSignature(jsonText, selectedTemplateId) });
  });

  document.querySelector<HTMLButtonElement>("#generateBtn")?.addEventListener("click", () => {
    uiState = "generating";
    statusItems = [{ severity: "info", message: "복제본을 생성하고 텍스트를 입력하고 있습니다." }];
    render();
    post({ type: "generate", jsonText, templateId: selectedTemplateId, signature: lastValidSignature });
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
