// Rebuilds the README media from the rendered examples (run after `npm run prai -- render <p>` for each):
//   node scripts/readme-media.mjs
// GIFs and the banner come from PRAI's own commands, so the README always shows what PRAI actually rendered.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const media = path.join(root, "docs", "media");
fs.mkdirSync(media, { recursive: true });
const prai = (...a) => execFileSync(process.execPath, [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), path.join(root, "cli", "index.ts"), ...a], { cwd: root, stdio: "inherit" });

prai("gif", "prai", "--from", "0", "--to", "11", "--width", "880", "--fps", "12", "--out", path.join(media, "prai.gif"));
prai("gif", "excalidraw", "--from", "8.8", "--to", "21.5", "--width", "640", "--fps", "12", "--out", path.join(media, "excalidraw.gif"));
prai("gif", "quickstart", "--from", "8.5", "--to", "23.5", "--width", "640", "--fps", "12", "--out", path.join(media, "quickstart.gif"));
prai("still", "prai", "--time", "9.6", "--out", path.join(media, "banner-full.png"));
for (const p of ["prai", "excalidraw", "quickstart"]) fs.copyFileSync(path.join(root, "out", p, `${p}.mp4`), path.join(media, `${p}.mp4`));
const ff = createRequire(import.meta.url)("ffmpeg-static");
// a wide banner from the frame where the logo, the name and the tagline are all on screen
execFileSync(ff, ["-y", "-loglevel", "error", "-i", path.join(media, "banner-full.png"), "-vf", "crop=1920:760:0:170,scale=1600:-1", path.join(media, "banner.png")]);
fs.rmSync(path.join(media, "banner-full.png"));
execFileSync(ff, ["-y", "-loglevel", "error", "-i", path.join(root, "out", "excalidraw", "sheet.png"), "-vf", "scale=iw/2:-1", path.join(media, "excalidraw-sheet.png")]);
for (const f of fs.readdirSync(media)) console.log(`  ${f.padEnd(24)} ${(fs.statSync(path.join(media, f)).size / 1e6).toFixed(1)} MB`);
