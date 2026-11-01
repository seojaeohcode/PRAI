// `prai review <kind>`: hands one review to Codex (read-only) with the right context and images, saves the answer,
// and opens a round in the ledger. The director (Claude Code or you) then writes a decision for every finding:
// accept / partial / reject + why. Rounds are capped: the last round fixes everything it found, then you stop.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, type Project } from "./project.ts";

export const KINDS = ["storyboard", "beats", "frames", "refs", "code"] as const;
export type Kind = (typeof KINDS)[number];

export function findCodex(): string | null {
  const env = process.env.PRAI_CODEX;
  if (env && fs.existsSync(env)) return env;
  const w = spawnSync(process.platform === "win32" ? "where" : "which", ["codex"], { encoding: "utf8" });
  const found = w.status === 0 ? w.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  return found.find((f) => /\.(exe|cmd)$/i.test(f)) ?? found[0] ?? null;
}

/** agents.json: the reviewer's model and the reasoning effort for each kind of review */
export function agents(): { reviewer: { model?: string; effort: Record<string, string> }; rounds: { max: number } } {
  const f = path.join(ROOT, "agents.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : { reviewer: { effort: {} }, rounds: { max: 4 } };
}

export function reviewDir(p: Project) { const d = path.join(p.dir, "reviews"); fs.mkdirSync(d, { recursive: true }); return d; }
/** completed rounds = rounds opened in the ledger after a successful review (dry runs, failures and research don't count) */
export function rounds(p: Project) {
  const f = path.join(reviewDir(p), "ledger.md");
  return fs.existsSync(f) ? (fs.readFileSync(f, "utf8").match(/^## Round \d+/gm) || []).length : 0;
}

export function buildPrompt(kind: Kind, vars: Record<string, string>) {
  const read = (n: string) => fs.readFileSync(path.join(ROOT, "prompts", `${n}.md`), "utf8");
  const tpl = read(kind).replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, n) => read(n));      // {{> _rules}} includes a shared part
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `(no ${k})`);
}

export async function runReview(p: Project, kind: Kind | "research", prompt: string, images: string[], opts: { max?: number; effort?: string; dry?: boolean }) {
  const cfg = agents(), max = opts.max ?? cfg.rounds.max;
  let effort = opts.effort ?? cfg.reviewer.effort[kind] ?? "high";
  const model = process.env.PRAI_CODEX_MODEL ?? cfg.reviewer.model;
  const research = kind === "research", n = rounds(p) + 1;
  if (!research && n === max) effort = opts.effort ?? cfg.reviewer.effort.final ?? "xhigh";       // the last round looks hardest
  if (!research && n > max) throw new Error(`review round cap reached (${max}). Fix what the last round found, record the rest as known limits in reviews/ledger.md, and ship. (--max to change)`);
  const dir = research ? path.join(reviewDir(p), "research") : reviewDir(p);
  fs.mkdirSync(dir, { recursive: true });
  const stem = research ? `research-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}` : `${String(n).padStart(2, "0")}-${kind}`;
  const promptFile = path.join(dir, `${stem}.prompt.md`), outFile = path.join(dir, `${stem}.md`);
  fs.writeFileSync(promptFile, prompt);
  const ledger = path.join(reviewDir(p), "ledger.md");
  if (!fs.existsSync(ledger)) fs.writeFileSync(ledger, `# Review ledger — ${p.name}\n\nEvery finding gets a decision: **accept**, **partial** or **reject**, with the reason and how it was checked.\nRound cap: ${max}. The last round fixes everything it raised (side effects included); what is left becomes a known limit.\n`);
  const codex = findCodex();
  if (opts.dry || !codex) {
    console.log(codex ? `dry run: prompt written to ${path.relative(ROOT, promptFile)}` : `Codex CLI not found (install it or set PRAI_CODEX). The prompt is ready to paste: ${path.relative(ROOT, promptFile)}`);
    return { promptFile, outFile: null as string | null };
  }
  const args = ["exec", ...(model ? ["-m", model] : []), "-c", `model_reasoning_effort=${effort}`,
    "-s", "read-only", "-C", ROOT, "--skip-git-repo-check", "--ephemeral", "-o", outFile, ...images.flatMap((i) => ["-i", i]), "--", "-"];   // "--": "-" is the stdin prompt, not another image
  console.log(`Codex review #${n} (${kind}, ${model ?? "Codex default model"}, effort ${effort}) running…`);
  await new Promise<void>((resolve, reject) => {
    // a .cmd/.bat shim (npm on Windows) needs a shell; then every argument is quoted. Binaries run without one.
    const shim = /\.(cmd|bat)$/i.test(codex), q = (a: string) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
    const c = shim ? spawn(q(codex), args.map(q), { stdio: ["pipe", "ignore", "pipe"], shell: true }) : spawn(codex, args, { stdio: ["pipe", "ignore", "pipe"] });
    let err = ""; c.stderr.on("data", (d) => (err += d));
    c.stdin.on("error", () => { /* reported through the exit code */ });
    c.on("error", reject);
    c.on("close", (code) => (code === 0 && fs.existsSync(outFile) ? resolve() : reject(new Error(`codex exited with ${code}: ${err.trim().split("\n").slice(-3).join(" ")}\n` +
      "PRAI never switches models on failure: fix the cause (quota, plan, login) or change reviewer.model in agents.json on purpose."))));
    c.stdin.end(prompt);
  });
  if (research) { console.log(`saved ${path.relative(ROOT, outFile)}`); return { promptFile, outFile }; }
  fs.appendFileSync(ledger, `\n## Round ${n} — ${kind} (${new Date().toISOString().slice(0, 10)})\n\nCodex: [${stem}.md](${stem}.md)\n\n| # | finding | decision | why / how checked |\n|---|---|---|---|\n| 1 | | | |\n`);
  console.log(`saved ${path.relative(ROOT, outFile)} — now record a decision for each finding in ${path.relative(ROOT, ledger)}`);
  return { promptFile, outFile };
}
