import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { test } from "node:test";
import { build } from "esbuild";

await mkdir(".test-build", { recursive: true });
await build({
  entryPoints: ["src/shared/schema.ts", "src/shared/images.ts", "src/shared/constants.ts"],
  bundle: true,
  outdir: ".test-build",
  outExtension: { ".js": ".mjs" },
  format: "esm",
  platform: "node",
  target: "node20",
  logLevel: "silent"
});

const schema = await import("../.test-build/schema.mjs");
const images = await import("../.test-build/images.mjs");
const constants = await import("../.test-build/constants.mjs");

test("valid HairCamp JSON parses into sections", () => {
  const result = schema.parseJsonText(
    JSON.stringify({
      frameName: "김우진_슬릭펌",
      "Main banner": {
        TXT_HERO_TITLE: "슬릭펌 디자인",
        TXT_HERO_SUBTITLE: ""
      }
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.frameName, "김우진_슬릭펌");
  assert.equal(result.data.sections["Main banner"].TXT_HERO_TITLE, "슬릭펌 디자인");
  assert.equal(schema.countTargets(result.data), 2);
  assert.equal(result.items.some((item) => item.severity === "warning"), true);
});

test("invalid syntax returns readable error", () => {
  const result = schema.parseJsonText("{");

  assert.equal(result.ok, false);
  assert.match(result.items[0].message, /JSON 문법 오류/);
});

test("frameName and TXT_ layer names are required", () => {
  const result = schema.parseJsonText(
    JSON.stringify({
      frameName: "",
      "Main banner": {
        HERO_TITLE: "잘못된 이름",
        TXT_COUNT: 10
      }
    })
  );

  assert.equal(result.ok, false);
  assert.equal(result.items.some((item) => item.message.includes("frameName")), true);
  assert.equal(result.items.some((item) => item.message.includes("TXT_")), true);
  assert.equal(result.items.some((item) => item.message.includes("문자열")), true);
});

test("signature changes when JSON or template changes", () => {
  const first = schema.makeSignature("{\"frameName\":\"A\"}", "haircamp-detail-v1");
  const second = schema.makeSignature("{\"frameName\":\"B\"}", "haircamp-detail-v1");
  const third = schema.makeSignature("{\"frameName\":\"A\"}", "other-template");

  assert.notEqual(first, second);
  assert.notEqual(first, third);
});

test("image slot config contains the expected optional slots", () => {
  assert.equal(constants.imageSlots.length, 11);
  assert.equal(constants.imageSlots.every((slot) => slot.required === false), true);
  assert.equal(constants.imageSlots.find((slot) => slot.id === "hero").layerName, "IMG_HERO");
  assert.equal(constants.imageSlots.find((slot) => slot.id === "curriculum3").sectionName, "Class_6");
});

test("image validation accepts png and jpeg selections", () => {
  const result = images.validateSelectedImages([
    {
      slotId: "hero",
      fileName: "강사님 프로필 최종.jpg",
      mimeType: "image/jpeg",
      byteLength: 12,
      width: 1200,
      height: 900,
      scaleMode: "FILL",
      bytes: [1, 2, 3]
    },
    {
      slotId: "hook1",
      fileName: "KakaoTalk_Photo.png",
      mimeType: "image/png",
      byteLength: 12,
      width: 900,
      height: 1200,
      scaleMode: "FIT",
      bytes: [1, 2, 3]
    }
  ]);

  assert.equal(result.some((item) => item.severity === "error"), false);
  assert.equal(result.some((item) => item.message.includes("선택한 이미지 2개")), true);
});

test("image validation rejects unsupported type and oversize dimensions", () => {
  const result = images.validateSelectedImages([
    {
      slotId: "hero",
      fileName: "hero.webp",
      mimeType: "image/webp",
      byteLength: 12,
      width: 4097,
      height: 900,
      scaleMode: "FILL",
      bytes: [1, 2, 3]
    }
  ]);

  assert.equal(result.some((item) => item.message.includes("지원하지 않는 이미지 형식")), true);
  assert.equal(result.some((item) => item.message.includes("4096px")), true);
});

test("combined signature changes when image selection changes", () => {
  const base = images.makeCombinedSignature("{\"frameName\":\"A\"}", "haircamp-detail-v1", []);
  const withImage = images.makeCombinedSignature("{\"frameName\":\"A\"}", "haircamp-detail-v1", [
    {
      slotId: "hero",
      fileName: "hero.jpg",
      mimeType: "image/jpeg",
      byteLength: 12,
      width: 100,
      height: 100,
      scaleMode: "FILL",
      bytes: [1, 2, 3]
    }
  ]);
  const withFitImage = images.makeCombinedSignature("{\"frameName\":\"A\"}", "haircamp-detail-v1", [
    {
      slotId: "hero",
      fileName: "hero.jpg",
      mimeType: "image/jpeg",
      byteLength: 12,
      width: 100,
      height: 100,
      scaleMode: "FIT",
      bytes: [1, 2, 3]
    }
  ]);

  assert.notEqual(base, withImage);
  assert.notEqual(withImage, withFitImage);
});
