// A PRAI project on disk: projects/<name>/{prai.json, prai.lock.json, capture.json, refs.json, public/…}
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Spec, type Lock, type Props, type Rects } from "../../src/engine/spec.ts";
import { sayLines, solve, type Timeline } from "../../src/engine/timeline.ts";
import { contentHash, defaultVoice, voiceHash } from "./tts.ts";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export type Project = { name: string; dir: string; pub: string; specFile: string; lockFile: string; spec: Spec; raw: unknown; lock: Lock; rects: Rects };

export function projectDir(name: string) {
  const d = fs.existsSync(name) && fs.statSync(name).isDirectory() && fs.existsSync(path.join(name, "prai.json")) ? path.resolve(name) : path.join(ROOT, "projects", name);
  if (!fs.existsSync(path.join(d, "prai.json"))) throw new Error(`no project "${name}" (expected ${path.join(d, "prai.json")}). Create one with: npm run prai -- init ${name}`);
  return d;
}

export function formatZod(e: any, file: string) {
  if (!e?.issues) return String(e?.message ?? e);
  return `${file} is not valid:\n` + e.issues.map((i: any) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
}

export function load(name: string): Project {
  const dir = projectDir(name), specFile = path.join(dir, "prai.json"), lockFile = path.join(dir, "prai.lock.json");
  const raw = JSON.parse(fs.readFileSync(specFile, "utf8"));
  const r = Spec.safeParse(raw);
  if (!r.success) throw new Error(formatZod(r.error, specFile));
  const lock: Lock = fs.existsSync(lockFile) ? JSON.parse(fs.readFileSync(lockFile, "utf8")) : {};
  // drop measurements that no longer match: another track, a changed file, or a line recorded with other voice settings
  const m = r.data.music, mf = m && path.join(dir, "public", m.src);
  if (lock.music && (!m || lock.music.file !== m.src || !fs.existsSync(mf!) || fileHash(mf!) !== lock.music.hash)) delete lock.music;
  if (lock.voice) {
    const cfg = { ...r.data.voice, voice: r.data.voice.voice ?? defaultVoice(r.data.video.lang) } as any;
    const lines = new Map(r.data.scenes.flatMap((sc) => sayLines(sc, 0, 4)).map((l) => [l.id, l.text]));
    for (const [id, v] of Object.entries(lock.voice)) {
      const text = lines.get(id);
      // also drop takes whose audio is not on disk (voice files are not committed: a fresh clone renders with estimates until `prai voice`)
      const f = path.join(dir, "public", "voice", v.file);
      const want = text === undefined || !fs.existsSync(f) ? null : cfg.provider === "file" ? `${voiceHash(cfg, text)}:${contentHash(f)}` : voiceHash(cfg, text);
      if (want === null || v.hash !== want) delete lock.voice[id];
    }
  }
  const rf = path.join(dir, "public", "shots", "rects.json");
  const rects: Rects = fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, "utf8")) : {};
  return { name: path.basename(dir), dir, pub: path.join(dir, "public"), specFile, lockFile, spec: r.data, raw, lock, rects };
}

export function saveLock(p: Project) { fs.writeFileSync(p.lockFile, JSON.stringify(p.lock, null, 1) + "\n"); }
export const fileHash = (f: string) => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex").slice(0, 12);
export const timeline = (p: Project): Timeline => solve(p.raw as any, p.lock);

/** props for Remotion (the spec as written, so defaults stay visible in one place: the schema) */
export function writeProps(p: Project, extra: Partial<Props> = {}) {
  const dir = path.join(ROOT, ".prai", p.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, extra.sheet ? "sheet.props.json" : "props.json");
  const props: Props = { spec: p.raw as any, lock: p.lock, rects: p.rects, ...extra };
  fs.writeFileSync(file, JSON.stringify(props));
  return file;
}
export const outDir = (p: Project) => { const d = path.join(ROOT, "out", p.name); fs.mkdirSync(d, { recursive: true }); return d; };
