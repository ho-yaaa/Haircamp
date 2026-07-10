import { readFile, writeFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir("dist", { recursive: true });

await build({
  entryPoints: ["src/plugin/main.ts"],
  bundle: true,
  outfile: "dist/code.js",
  format: "iife",
  target: "es2020",
  platform: "browser",
  logLevel: "info"
});

const uiResult = await build({
  entryPoints: ["src/ui/main.ts"],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2020",
  platform: "browser",
  logLevel: "silent"
});

const css = await readFile("src/ui/styles.css", "utf8");
const js = uiResult.outputFiles[0].text;

await writeFile(
  "dist/ui.html",
  `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HairCamp Figma Generator</title>
    <style>${css}</style>
  </head>
  <body>
    <div id="app"></div>
    <script>${js}</script>
  </body>
</html>
`,
  "utf8"
);
