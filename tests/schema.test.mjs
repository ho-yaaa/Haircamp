import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { test } from "node:test";
import { build } from "esbuild";

await mkdir(".test-build", { recursive: true });
await build({
  entryPoints: ["src/shared/schema.ts"],
  bundle: true,
  outfile: ".test-build/schema.mjs",
  format: "esm",
  platform: "node",
  target: "node20",
  logLevel: "silent"
});

const schema = await import("../.test-build/schema.mjs");

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
