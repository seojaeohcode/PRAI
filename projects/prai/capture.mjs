// Screens for PRAI's own video: pages built from real artifacts (build-pages.mjs) and a real Remotion Studio
// session on the Excalidraw example. Studio is started here and stopped by its own PID afterwards.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "..", "..");
const file = (p) => pathToFileURL(path.join(here, "app", p)).href;
const box = (x1, y1, x2, y2) => ({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });

export default async function ({ page, shot }) {
  spawnSync(process.execPath, [path.join(here, "build-pages.mjs")], { stdio: "inherit" });
  await page.goto(file("spec.html")); await page.waitForTimeout(400);
  await shot("spec", { music: ".music", voice: ".voice", intro: [".intro", ".say"], cues: ".cue", draw: ".draw" });
  await page.goto(file("terminal.html")); await page.waitForTimeout(400);
  await shot("terminal", { beat: "#cmd-beat", voice: "#cmd-voice", check: "#cmd-check", main: "main" });
  await page.goto(file("plan.html")); await page.waitForTimeout(400);
  await shot("plan", { table: "table", hits: "tr.row-hit", head: "h2" });
  await page.goto(file("review.html")); await page.waitForTimeout(400);
  await shot("review", { ledger: "#ledger", head: "h2", main: "main" });

  // Remotion Studio on the Excalidraw project
  const props = path.join(root, ".prai", "excalidraw", "props.json");
  const cli = path.join(root, "node_modules", "@remotion", "cli", "remotion-cli.js");
  const studio = spawn(process.execPath, [cli, "studio", "src/index.ts", `--props=${props}`, `--public-dir=${path.join(root, "projects", "excalidraw", "public")}`, "--port=3123"],
    { cwd: root, env: { ...process.env, BROWSER: "none" }, stdio: "ignore" });
  try {
    for (let i = 0; i < 90; i++) { try { const r = await fetch("http://localhost:3123"); if (r.ok) break; } catch {} await page.waitForTimeout(1000); }
    await page.goto("http://localhost:3123/PRAI"); await page.waitForTimeout(9000);
    for (let i = 0; i < 12; i++) { await page.keyboard.press("Shift+ArrowRight"); await page.waitForTimeout(120); }
    await page.waitForTimeout(4000);
    await shot("studio", { canvas: "#remotion-canvas, .__remotion-player, [data-remotion-canvas]", timeline: ".__remotion-timeline, #timeline" }, { preview: box(330, 60, 1590, 760) });
  } finally {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(studio.pid), "/T", "/F"], { stdio: "ignore" }); else studio.kill();
  }
}
