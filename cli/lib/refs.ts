// The reference library: the videos you (or your users) love, turned into technique cards an agent can choose from.
//   refs add <p> <url> [--note "what I like"]    YouTube/Vimeo title + channel via oEmbed (no key)
//   refs list <p>
//   refs research <p> "<topic>"                   Codex web search → candidate links (status "candidate": unverified)
//   refs frames <p> <video-file> --id r1          frames of a video you have the right to use → a sheet to look at
//   refs brief <p>                                one Markdown brief: product context + refs + catalog + rubric
//   refs check <p>                                validates projects/<p>/style.json against the rules
// Nothing is downloaded from YouTube: agents watch in a browser and write down what they saw (time, technique, frame).
import fs from "node:fs";
import { z } from "zod";
import path from "node:path";
import { run } from "./ffmpeg.ts";
import { ROOT, load, outDir, type Project } from "./project.ts";
import { buildPrompt, runReview } from "./review.ts";

export type Observation = { t: string; technique: string; what: string; frame?: string };
export type Ref = { id: string; url: string; title?: string; author?: string; note?: string; source: "user" | "research" | "catalog";
  status: "candidate" | "viewed" | "analyzed" | "rejected"; why?: string; observations: Observation[] };
export type RefsFile = { refs: Ref[] };
export type Technique = { id: string; name: string; category: string; what: string; why: string; use_when: string; avoid_when: string;
  cost: 1 | 2 | 3; risk: string[]; prai: string; status: "supported" | "combo" | "custom"; conflicts?: string[]; sources?: string[] };
export type StyleFile = {
  signature: { name: string; from_product: string; scenes: string[] };
  adopted: { technique: string; scenes: string[]; role: "primary" | "secondary"; evidence: string[]; why: string; params?: Record<string, unknown> }[];
  rejected: { technique: string; why: string }[];
};

const refsPath = (p: Project) => path.join(p.dir, "refs.json");
export const readRefs = (p: Project): RefsFile => (fs.existsSync(refsPath(p)) ? JSON.parse(fs.readFileSync(refsPath(p), "utf8")) : { refs: [] });
const writeRefs = (p: Project, r: RefsFile) => fs.writeFileSync(refsPath(p), JSON.stringify(r, null, 1) + "\n");
export const catalog = (): Technique[] => JSON.parse(fs.readFileSync(path.join(ROOT, "library", "techniques.json"), "utf8")).techniques;

/** title + uploader from oEmbed. `dead` only when the provider says the video does not exist; anything else is "unknown" */
async function oembed(url: string): Promise<{ title?: string; author?: string; dead?: boolean }> {
  const ep = /youtu\.?be/.test(url) ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
    : /vimeo\.com/.test(url) ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}` : null;
  if (!ep) return {};
  try {
    const r = await fetch(ep, { signal: AbortSignal.timeout(8000) });
    if (r.status === 404 || r.status === 400) return { dead: true };
    if (!r.ok) return {};                                   // 401 private, 429 rate limit, 5xx: keep it, unverified
    const j: any = await r.json();
    return { title: typeof j.title === "string" ? j.title : undefined, author: typeof j.author_name === "string" ? j.author_name : undefined };
  } catch { return {}; }
}
const Found = z.array(z.object({ url: z.string().url(), title: z.string().optional(), why: z.string().optional(), techniques: z.array(z.string()).optional() }).passthrough());
const nextId = (r: RefsFile) => `r${r.refs.reduce((m, x) => Math.max(m, Number(x.id.slice(1)) || 0), 0) + 1}`;

export function brief(p: Project) {
  const r = readRefs(p), cat = catalog(), s = p.spec;
  const L = [`# Reference brief — ${s.video.title}`, "",
    "## The product and the video", "",
    `- language: ${s.video.lang} · ${s.scenes.length} scenes · music: ${s.music ? (s.music.credit ?? s.music.src) : "none"}`,
    ...s.scenes.map((sc) => `- **${sc.id}** (${sc.type})${sc.headline ? ` — “${typeof sc.headline === "string" ? sc.headline : sc.headline.text}”` : ""}${sc.say ? ` · says: ${JSON.stringify(sc.say).slice(0, 140)}` : ""}`),
    "", "## References", ""];
  if (!r.refs.length) L.push("(none yet — `prai refs add <p> <url> --note \"…\"`)");
  for (const x of r.refs) {
    L.push(`### ${x.id} · ${x.title ?? x.url} ${x.author ? `— ${x.author}` : ""}`, `${x.url} · ${x.source} · **${x.status}**${x.note ? ` · liked: ${x.note}` : ""}`);
    for (const o of x.observations) L.push(`- ${o.t} · \`${o.technique}\` · ${o.what}${o.frame ? ` (frame: ${o.frame})` : ""}`);
    if (x.status === "candidate") L.push("- ⚠ unverified: nobody has watched this yet — it cannot be evidence");
    L.push("");
  }
  L.push("## Technique catalog", "", "| id | name | category | cost | PRAI | use when | avoid when | risk |", "|---|---|---|---|---|---|---|---|");
  for (const t of cat) L.push(`| ${t.id} | ${t.name} | ${t.category} | ${t.cost} | ${t.status}: ${t.prai} | ${t.use_when} | ${t.avoid_when} | ${t.risk.join(", ")} |`);
  L.push("", fs.readFileSync(path.join(ROOT, "library", "rubric.md"), "utf8"));
  return L.join("\n");
}

/** the hard rules for style.json (the rubric's must-pass part) */
export function checkStyle(p: Project): string[] {
  const f = path.join(p.dir, "style.json");
  if (!fs.existsSync(f)) return ["no style.json yet (write it after `refs brief`; see library/rubric.md)"];
  const st: StyleFile = JSON.parse(fs.readFileSync(f, "utf8")), cat = new Map(catalog().map((t) => [t.id, t])), refs = readRefs(p);
  const scenes = new Set(p.spec.scenes.map((s) => s.id)), errs: string[] = [];
  if (!st.signature?.name || !st.signature.from_product) errs.push("signature motif missing: name one built from the product's own material (not a reference's design)");
  const perScene = new Map<string, { primary: number; secondary: number }>();
  for (const a of st.adopted ?? []) {
    const t = cat.get(a.technique);
    if (!t) errs.push(`"${a.technique}" is not in library/techniques.json (add a card first, with status "custom" if PRAI has no block for it)`);
    if (!a.evidence?.length) errs.push(`"${a.technique}": no evidence (a ref observation like "r2@0:14" or a catalog source)`);
    for (const ev of a.evidence ?? []) {
      const m = ev.match(/^(r\d+)@(.+)$/);
      if (!m) { if (!/^catalog:/.test(ev)) errs.push(`evidence "${ev}": use "r<id>@<time>" or "catalog:<technique>"`); continue; }
      const ref = refs.refs.find((x) => x.id === m[1]);
      if (!ref) errs.push(`evidence ${ev}: no ref ${m[1]}`);
      else if (ref.status === "candidate" || ref.status === "rejected") errs.push(`evidence ${ev}: ${m[1]} is ${ref.status} (watch it first)`);
      else if (!ref.observations.some((o) => o.t === m[2] && o.what && !/not seen yet/.test(o.what))) errs.push(`evidence ${ev}: ${m[1]} has no observation at "${m[2]}"`);
    }
    for (const s of a.scenes) {
      if (!scenes.has(s)) errs.push(`"${a.technique}": unknown scene "${s}"`);
      const c = perScene.get(s) ?? { primary: 0, secondary: 0 }; c[a.role]++; perScene.set(s, c);
    }
    if (t?.status === "custom" && !/build|custom|implement/i.test(a.why)) errs.push(`"${a.technique}" needs custom code: say in "why" who builds it (or drop it)`);
  }
  for (const [s, c] of perScene) if (c.primary > 1 || c.secondary > 1) errs.push(`scene "${s}": ${c.primary} primary + ${c.secondary} secondary techniques (max 1 + 1: one idea per scene)`);
  if ((st.adopted ?? []).length > p.spec.scenes.length * 2) errs.push("too many techniques for this many scenes — pick fewer");
  if (!(st.rejected ?? []).length) errs.push("no rejected techniques: say what you looked at and did not use, and why");
  return errs;
}

export async function refsCommand(args: string[], flags: Record<string, string | true>) {
  const [sub, name, arg] = args;
  if (!sub || !name) throw new Error("usage: prai refs <add|list|research|frames|brief|check> <project> …");
  const p = load(name), r = readRefs(p);
  switch (sub) {
    case "add": {
      if (!arg) throw new Error("usage: prai refs add <p> <url> [--note \"…\"]");
      const meta = await oembed(arg);
      const ref: Ref = { id: nextId(r), url: arg, ...meta, note: typeof flags.note === "string" ? flags.note : undefined, source: "user", status: "candidate", observations: [] };
      r.refs.push(ref); writeRefs(p, r);
      return console.log(`added ${ref.id}: ${ref.title ?? arg}${ref.author ? ` — ${ref.author}` : ""}\nnext: watch it and add observations (skills/prai-refs/SKILL.md), then set status to "analyzed"`);
    }
    case "list":
      for (const x of r.refs) console.log(`${x.id.padEnd(4)} ${x.status.padEnd(9)} ${x.source.padEnd(8)} ${x.observations.length} obs  ${x.title ?? x.url}`);
      return;
    case "research": {
      if (!arg) throw new Error('usage: prai refs research <p> "<topic>"');
      const res = await runReview(p, "research", buildPrompt("research" as any, { topic: arg, project: p.name, lang: p.spec.video.lang,
        known: r.refs.map((x) => x.url).join(", ") || "(none)" }), [], { effort: typeof flags.effort === "string" ? flags.effort : undefined });
      if (!res.outFile) return;
      const txt = fs.readFileSync(res.outFile, "utf8"), m = txt.match(/```json\s*([\s\S]*?)```/);
      if (!m) return console.log("Codex answered without a JSON block — read it and add links with `refs add`.");
      let found: z.infer<typeof Found>;
      try { found = Found.parse(JSON.parse(m[1])); } catch (e: any) { return console.log(`Codex's JSON did not match the expected list (${String(e.message).slice(0, 120)}) — add links by hand with \`refs add\`.`); }
      let n = 0;
      for (const c of found) {
        if (r.refs.some((x) => x.url === c.url)) continue;
        const meta = await oembed(c.url);
        if (meta.dead) { console.log(`  skipped (the provider says this video does not exist): ${c.url}`); continue; }
        r.refs.push({ id: nextId(r), url: c.url, title: meta.title ?? c.title, author: meta.author, why: c.why, source: "research", status: "candidate",
          observations: (c.techniques ?? []).map((t) => ({ t: "?", technique: t, what: "claimed by research, not seen yet" })) });
        n++;
      }
      writeRefs(p, r);
      return console.log(`${n} candidate reference(s) added — all unverified until someone watches them`);
    }
    case "frames": {
      if (!arg || !fs.existsSync(arg)) throw new Error("usage: prai refs frames <p> <video-file you may use> --id r1 [--every 1]");
      const id = typeof flags.id === "string" ? flags.id : "local", every = Number(flags.every ?? 1);
      const dir = path.join(p.dir, "refs", id); fs.mkdirSync(dir, { recursive: true });
      const sheet = path.join(dir, "sheet.jpg");
      const rr = await run(["-y", "-loglevel", "error", "-i", arg, "-vf", `fps=1/${every},scale=480:-1,tile=6x8`, "-frames:v", "1", "-q:v", "3", sheet], { quiet: true });
      if (rr.code !== 0) throw new Error(rr.stderr);
      return console.log(`frame sheet (every ${every}s, left→right, top→bottom): ${path.relative(ROOT, sheet)}`);
    }
    case "brief": {
      const md = brief(p), f = path.join(outDir(p), "refs-brief.md");
      fs.writeFileSync(f, md);
      return console.log(`brief: ${path.relative(ROOT, f)} (${md.length} chars) — give it to the director, then write projects/${p.name}/style.json`);
    }
    case "check": {
      const errs = checkStyle(p);
      if (!errs.length) return console.log("style.json passes the rubric's hard rules");
      errs.forEach((e) => console.log(`  • ${e}`));
      process.exitCode = 1; return;
    }
    default: throw new Error(`unknown refs command "${sub}"`);
  }
}
