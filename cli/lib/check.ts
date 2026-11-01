// `prai check`: what a reviewer would catch first, measured instead of eyeballed.
// 1) spec lint against the solved timeline  2) loudness of the rendered file  3) how visual changes sit on the beat.
// Passing these does not mean the video is good — a person still has to watch it with sound.
import fs from "node:fs";
import path from "node:path";
import { beatValue } from "../../src/engine/spec.ts";
import { frameTarget, pad } from "../../src/engine/geometry.ts";
import { pageOf, resolveRef, type Timeline } from "../../src/engine/timeline.ts";
import { frameOfBeat } from "../../src/engine/beat.ts";
import { run } from "./ffmpeg.ts";
import type { Project } from "./project.ts";

export type Finding = { level: "error" | "warn" | "info"; where: string; msg: string };

export function lint(p: Project, tl: Timeline): Finding[] {
  const out: Finding[] = tl.warnings.map((w) => ({ level: "warn" as const, where: "timeline", msg: w }));
  const meter = tl.grid.beatsPerBar, ko = /^(ko|ja|zh)/.test(tl.spec.video.lang), page = pageOf(p.rects);
  const shotFile = (s: string) => path.join(p.pub, "shots", `${s}.png`);
  if (tl.spec.music && !fs.existsSync(path.join(p.pub, tl.spec.music.src))) out.push({ level: "error", where: "music", msg: `missing ${tl.spec.music.src} (run \`prai music\`)` });
  for (const s of tl.scenes) {
    const sc = s.scene, at = (t: any) => beatValue(t, meter);
    const head = typeof sc.headline === "string" ? sc.headline : sc.headline?.text;
    if (head && head.length > (ko ? 20 : 38)) out.push({ level: "warn", where: sc.id, msg: `headline is ${head.length} characters — hard to read in one beat-cut (aim ≤ ${ko ? 20 : 38})` });
    for (const c of sc.cues) {
      if (at(c.at) >= s.beats) out.push({ level: "error", where: sc.id, msg: `cue "${c.block}" at beat ${at(c.at)} is after the scene's end (${s.beats} beats)` });
      if (c.until !== undefined && at(c.until) <= at(c.at)) out.push({ level: "error", where: sc.id, msg: `cue "${c.block}" ends (until ${at(c.until)}) before it starts (at ${at(c.at)})` });
      if (c.block === "screen" && !fs.existsSync(shotFile(c.shot))) out.push({ level: "error", where: sc.id, msg: `missing shot ${c.shot}.png for the screen block` });
      const logo = c.block === "logo" ? c.src ?? tl.spec.theme.logo : undefined;
      if (logo && !fs.existsSync(path.join(p.pub, logo))) out.push({ level: "error", where: sc.id, msg: `missing logo ${logo}` });
      // reading time, counted from the first chunk's landing (word cuts are read as they arrive):
      // about max(1.2 s, characters ÷ 8 for Korean/Japanese/Chinese, ÷ 15 otherwise), and ≥ 0.8 s after the last chunk
      if ((c.block === "title" || c.block === "tagline") && c.until !== undefined) {
        const chunks = c.block === "title" ? c.text.split("|") : [c.text], step = c.block === "title" ? beatValue(c.step, meter, 1) : 0;
        const plain = c.text.replace(/\|/g, " "), spb = 60 / tl.grid.bpm;
        const hold = (at(c.until) - at(c.at)) * spb, tailHold = (at(c.until) - at(c.at) - (chunks.length - 1) * step) * spb;
        const need = Math.max(1.2, plain.length / (ko ? 8 : 15));
        if (hold < need - 0.05 || tailHold < 0.8) out.push({ level: "warn", where: sc.id, msg: `"${plain}" is on screen ${hold.toFixed(1)} s (${tailHold.toFixed(1)} s after its last word) — about ${need.toFixed(1)} s is needed to read it` });
      }
    }
    for (const x of sc.sfx) if (!fs.existsSync(path.join(p.pub, x.src))) out.push({ level: "error", where: sc.id, msg: `missing sound ${x.src}` });
    for (const v of s.voices) {
      const n = ko ? (v.text.match(/[\uac00-\ud7a3]/g) || []).length : v.text.length, rate = n / v.seconds;
      if (!v.estimated && rate > (ko ? 8.5 : 19)) out.push({ level: "warn", where: v.id, msg: `fast speech: ${rate.toFixed(1)} ${ko ? "syllables" : "chars"}/s — subtitles will be hard to follow` });
    }
    if (sc.type !== "demo") continue;
    for (const sh of [sc.shot, ...sc.swaps.map((x) => x.shot)]) if (!fs.existsSync(shotFile(sh))) out.push({ level: "error", where: sc.id, msg: `missing shot ${sh}.png (run \`prai capture\`)` });
    const refs: [string, any][] = [...sc.camera.filter((k) => k.to !== "full").map((k) => ["camera", k.to] as [string, any]), ...sc.marks.map((m) => ["mark", m.on] as [string, any]), ...sc.clicks.map((c) => ["click", c.on] as [string, any])];
    for (const [kind, r] of refs) {
      try {
        const b = resolveRef(r, p.rects, sc.shot);
        if (b.x < 0 || b.y < 0 || b.x + b.w > page.w || b.y + b.h > page.h) out.push({ level: "warn", where: sc.id, msg: `${kind} target ${JSON.stringify(r)} is partly off the screenshot` });
        if (kind === "camera") {
          const w = frameTarget(pad(b, 36), page, 16 / 9, { room: 0.22 });
          if (w.w < page.w * 0.24) out.push({ level: "warn", where: sc.id, msg: `camera zooms ${Math.round(page.w / w.w)}× on ${JSON.stringify(r)} — text may look soft` });
        }
      } catch (e: any) { out.push({ level: "error", where: sc.id, msg: e.message }); }
    }
    const keys = sc.camera.map((k) => at(k.at)).sort((a, b) => a - b);
    for (let i = 1; i < keys.length; i++) {
      const move = beatValue(sc.camera[i].move, meter, 1);
      if (keys[i] - move - keys[i - 1] < 1 && keys[i] - keys[i - 1] > 0) out.push({ level: "warn", where: sc.id, msg: `camera rests less than one beat before moving again (beats ${keys[i - 1]} → ${keys[i]}): no time to read` });
    }
    const cf = sc.clicks.map((c) => frameOfBeat(tl.grid, s.start + at(c.at))).sort((a, b) => a - b);
    for (let i = 1; i < cf.length; i++) if (cf[i] - cf[i - 1] < 3) out.push({ level: "error", where: sc.id, msg: `two clicks ${cf[i] - cf[i - 1]} frame(s) apart — the cursor cannot travel; space them out` });
    for (const t of sc.typing) if (t.done !== undefined && at(t.done) <= at(t.at)) out.push({ level: "error", where: sc.id, msg: `typing "done" (${at(t.done)}) must come after "at" (${at(t.at)})` });
    for (const m of sc.marks) {
      const a = at(m.at), z = m.until !== undefined ? at(m.until) : s.beats;
      const live = sc.marks.filter((o) => at(o.at) <= a && (o.until !== undefined ? at(o.until) : s.beats) > a).length;
      if (live > 2) out.push({ level: "warn", where: sc.id, msg: `${live} marks on screen at beat ${a}: one focus at a time reads better` });
      if (z <= a) out.push({ level: "error", where: sc.id, msg: `mark at beat ${a} ends before it starts` });
    }
  }
  for (const v of tl.voices) if (v.file && !fs.existsSync(path.join(p.pub, "voice", v.file))) out.push({ level: "error", where: v.id, msg: `voice file ${v.file} is missing (run \`prai voice\`)` });
  return out;
}

export async function loudness(file: string) {
  const { stderr } = await run(["-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { quiet: true });
  const sum = stderr.slice(stderr.lastIndexOf("Summary:"));
  const I = sum.match(/I:\s*(-?[\d.]+) LUFS/), P = sum.match(/Peak:\s*(-?[\d.]+) dBFS/);
  return I ? { lufs: +I[1], peak: P ? +P[1] : NaN } : null;
}

/** frames where the picture changes sharply, and how far each is from the nearest beat (in frames) */
export async function beatAlignment(file: string, tl: Timeline) {
  const W = 96, H = 54;
  const { stdout, code } = await run(["-loglevel", "error", "-i", file, "-vf", `scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], { quiet: true });
  if (code !== 0) return null;
  const n = Math.floor(stdout.length / (W * H)), d: number[] = [];
  for (let i = 1; i < n; i++) { let s = 0; for (let j = 0; j < W * H; j++) s += Math.abs(stdout[i * W * H + j] - stdout[(i - 1) * W * H + j]); d.push(s / (W * H)); }
  const sorted = [...d].sort((a, b) => a - b), thr = Math.max(2, sorted[Math.floor(sorted.length * 0.9)] ?? 2);
  const fpb = (tl.grid.fps * 60) / tl.grid.bpm, events: { f: number; off: number }[] = [];
  // distance to the nearest beat as the renderer rounds it (frameOfBeat), not the ideal fractional beat
  const offOf = (f: number) => [Math.round(f / fpb) - 1, Math.round(f / fpb), Math.round(f / fpb) + 1].map((b) => f - frameOfBeat(tl.grid, b)).sort((a, b) => Math.abs(a) - Math.abs(b))[0];
  for (let i = 1; i < d.length - 1; i++) {
    const local = [...d.slice(Math.max(0, i - 8), i)].sort((a, b) => a - b)[Math.floor(Math.min(8, i) / 2)] ?? 0;
    if (d[i] > thr && d[i] >= d[i - 1] && d[i] >= d[i + 1] && d[i] > 1.6 * local + 0.5) {
      const f = i + 1; events.push({ f, off: offOf(f) });
    }
  }
  const near = events.filter((e) => Math.abs(e.off) <= 2).length;
  return { events: events.length, onBeat: near, share: events.length ? near / events.length : NaN,
    worst: events.filter((e) => Math.abs(e.off) > 2).sort((a, b) => Math.abs(b.off) - Math.abs(a.off)).slice(0, 12) };
}
