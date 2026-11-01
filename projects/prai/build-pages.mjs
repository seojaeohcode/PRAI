// Builds the pages PRAI's own video shows, from real artifacts of the Excalidraw example:
// its prai.json, the real terminal output of the prai commands, its beat sheet and its Codex review ledger.
// Run: node projects/prai/build-pages.mjs   (then: npm run prai -- capture prai)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "..", "..");
const app = path.join(here, "app"); fs.mkdirSync(app, { recursive: true });
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const prai = (...a) => strip(execFileSync(process.execPath, [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), path.join(root, "cli", "index.ts"), ...a], { cwd: root, encoding: "utf8" }));

const css = `
  * { box-sizing: border-box; } body { margin: 0; height: 100vh; background: #0D1117; color: #E6EDF3; font: 22px/1.6 "Cascadia Code", "Consolas", ui-monospace, monospace; display: flex; flex-direction: column; }
  .bar { height: 56px; background: #161B22; border-bottom: 1px solid #30363D; display: flex; align-items: center; gap: 12px; padding: 0 24px; font: 600 18px "Segoe UI", sans-serif; color: #8B949E; }
  .bar b { color: #E6EDF3; } .tab { background: #0D1117; border: 1px solid #30363D; border-bottom: 0; padding: 14px 22px 13px; border-radius: 8px 8px 0 0; margin-top: 10px; color: #E6EDF3; }
  main { flex: 1; overflow: hidden; padding: 28px 40px; }
  .k { color: #79C0FF; } .s { color: #A5D6FF; } .n { color: #FFA657; } .p { color: #8B949E; } .g { color: #7EE787; } .y { color: #E3B341; } .m { color: #D2A8FF; }
  .ln { display: inline-block; width: 46px; color: #484F58; text-align: right; margin-right: 22px; user-select: none; }
  table { border-collapse: collapse; font: 20px/1.5 "Segoe UI", sans-serif; } th, td { border: 1px solid #30363D; padding: 8px 14px; text-align: left; } th { background: #161B22; color: #8B949E; }
  h2 { font: 700 30px "Segoe UI", sans-serif; margin: 0 0 18px; } .row-hit td { background: #1F2D1F; }
  main > div { width: fit-content; } table { width: auto; max-width: 1700px; }   /* boxes hug their text, so the camera can zoom to them */
`;
const page = (file, title, tab, body) => fs.writeFileSync(path.join(app, file), `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>
<div class="bar"><b>PRAI</b> · ${title}<span style="flex:1"></span><span class="tab">${tab}</span></div><main>${body}</main></body></html>`);

// 1. the spec — the real Excalidraw prai.json, laid out compactly so the intro's cues are readable
const S = JSON.parse(fs.readFileSync(path.join(root, "projects", "excalidraw", "prai.json"), "utf8"));
const j = (o) => JSON.stringify(o).replace(/,"/g, ', "').replace(/":/g, '": ').replace(/\{"/g, '{ "').replace(/\}/g, " }");
const lines = [["", "{"], ["video", `  "video": ${j(S.video)},`], ["music", `  "music": ${j({ src: S.music.src, trim: S.music.trim })},`], ["voice", `  "voice": ${j(S.voice)},`], ["", '  "scenes": [']];
const intro = S.scenes[0];
lines.push(["intro", `    { "id": "intro", "type": "motion", "bg": "${intro.bg}", "intensity": "${intro.intensity}", "beats": ${intro.beats},`]);
lines.push(["say", `      "say": ${j(intro.say)},`], ["", '      "cues": [']);
intro.cues.forEach((c, i) => lines.push(["cue", `        ${j(c)}${i < intro.cues.length - 1 ? "," : ""}`]));
lines.push(["", "      ] },"]);
const draw = S.scenes[1];
lines.push(["draw", `    { "id": "draw", "type": "demo", "shot": "${draw.shot}", "headline": "${draw.headline}",`], ["draw", `      "camera": ${j(draw.camera)},`], ["draw", `      "clicks": ${j(draw.clicks)}, "swaps": ${j(draw.swaps)} },`], ["", "    …"], ["", "  ]"], ["", "}"]);
const hl = (l) => esc(l).replace(/("[^"]*")(:)/g, '<span class="k">$1</span>$2').replace(/: ("[^"]*")/g, ': <span class="s">$1</span>').replace(/(\d+(\.\d+)?)/g, '<span class="n">$1</span>');
page("spec.html", "projects/excalidraw/prai.json", "prai.json", lines.map(([c, l], i) => `<div class="${c}" id="L${i + 1}" style="font-size:24px"><span class="ln">${i + 1}</span>${hl(l)}</div>`).join(""));

// 2. the terminal: real output
const runs = [["beat", "excalidraw"], ["voice", "excalidraw"], ["check", "excalidraw"]];
let term = "";
for (const a of runs) {
  const out = prai(...a).trim().split("\n").filter((l) => !/^Passing these|^$/.test(l)).slice(0, 8);
  // one block per command (the command and its output), so a camera key can frame both; long lines wrap
  term += `<div id="cmd-${a[0]}" style="max-width:1500px;white-space:pre-wrap;margin-bottom:26px"><div><span class="g">❯</span> npm run prai -- <span class="y">${a.join(" ")}</span></div>` +
    out.map((l) => `<div class="${a[0] === "beat" ? "m" : "p"}">${esc(l)}</div>`).join("") + "</div>";
}
page("terminal.html", "terminal", "PowerShell", term);

// 3. the beat sheet of the intro (real plan)
const plan = prai("plan", "excalidraw");
const sec = plan.split("## 1. intro — beat sheet")[1]?.split("##")[0] ?? "";
const rows = sec.trim().split("\n").filter((l) => l.startsWith("|") && !l.includes("---")).slice(1, 13)
  .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
page("plan.html", "out/excalidraw/plan.md", "plan.md", `<h2>1. intro — beat sheet · 135 BPM</h2><table><tr><th>beat</th><th>bar:beat</th><th>time</th><th>event</th></tr>` +
  rows.map((r) => `<tr class="${/title|chips|screen/.test(r[3]) ? "row-hit" : ""}">${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + "</table>");

// 4. the review ledger (real, if the Excalidraw project has been reviewed)
const ledger = path.join(root, "projects", "excalidraw", "reviews", "ledger.md");
const led = fs.existsSync(ledger) ? fs.readFileSync(ledger, "utf8") : "# Review ledger\n\n(no review yet)";
const md = (s) => esc(s).replace(/^# (.*)$/gm, "<h2>$1</h2>").replace(/^## (.*)$/gm, '<h3 style="font:700 24px Segoe UI,sans-serif;color:#D2A8FF">$1</h3>')
  .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, '<span class="s">$1</span>');
const tableRows = led.split("\n").filter((l) => l.startsWith("|") && !l.includes("---"));
const head = led.split("\n").filter((l) => !l.startsWith("|")).join("\n");
page("review.html", "projects/excalidraw/reviews/ledger.md", "ledger.md", `<div style="font:20px/1.55 Segoe UI,sans-serif">${md(head).replace(/\n\n/g, "<br><br>")}</div>` +
  (tableRows.length ? `<table id="ledger">${tableRows.slice(0, 9).map((l, i) => `<tr>${l.split("|").slice(1, -1).map((c) => (i ? `<td>${md(c.trim())}</td>` : `<th>${esc(c.trim())}</th>`)).join("")}</tr>`).join("")}</table>` : ""));
console.log("pages:", fs.readdirSync(app).join(", "));
