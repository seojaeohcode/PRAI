// The timeline solver: spec + measurements → when every scene, voice and subtitle happens, in frames.
// Pure and shared by the CLI (plan, check, sheet) and the Remotion composition, so preview, render and reports agree.
// Beat 0 is frame 0: PRAI starts the song on a beat (it skips at most one beat of the track after `music.trim`).
import { Box, union } from "./geometry";
import { Grid, frameOfBeat } from "./beat";
import { Lock, Rects, Ref, Scene, Spec, SpecInput, beatValue } from "./spec";
import { cueEnd } from "../motion/meta";

export type VoiceSlot = { id: string; text: string; file: string | null; seconds: number; estimated: boolean; from: number; frames: number; scene: string; atBeat: number };
export type Sub = { from: number; to: number; text: string };
export type SceneSlot = { index: number; id: string; scene: Scene; start: number; beats: number; from: number; len: number; voices: VoiceSlot[] };
export type Timeline = {
  spec: Spec; grid: Grid; musicStart: number; totalBeats: number; totalFrames: number;
  scenes: SceneSlot[]; voices: VoiceSlot[]; subs: Sub[]; duck: [number, number][]; warnings: string[];
};

const HANGUL = /[가-힣]/g;
/** a first guess at how long a line takes to say, used until `prai voice` has measured it */
export function estimateSeconds(text: string) {
  const pauses = (text.match(/[,.!?;:，。]/g) || []).length * 0.22;
  const ko = (text.match(HANGUL) || []).length;
  if (ko > text.length * 0.3) return ko / 6.4 + pauses + 0.3;
  const words = text.trim().split(/\s+/).length;
  return words / 2.7 + pauses + 0.3;
}

/** the scene's spoken lines; a line without `at` starts half a beat after the previous one ends (by its length) */
export function sayLines(sc: Scene, lead: number, meter: number, secondsOf: (id: string, text: string) => number = (_, t) => estimateSeconds(t), beatsPerSec = 2) {
  const list = sc.say === undefined ? [] : Array.isArray(sc.say) ? sc.say : [sc.say];
  let next = lead;
  return list.map((s, k) => {
    const o = typeof s === "string" ? { text: s } : s;
    const id = (o as any).id ?? `${sc.id}-${k + 1}`;
    const at = (o as any).at !== undefined ? beatValue((o as any).at, meter) : next;
    next = at + secondsOf(id, o.text) * beatsPerSec + 0.5;
    return { id, text: o.text, at };
  });
}

/** the last beat any timed thing in a scene needs (exclusive ends count as-is, points get one beat to be seen) */
function contentEnd(sc: Scene, meter: number, fpb: number) {
  const b = (t: any, extra = 1) => (t === undefined ? 0 : beatValue(t, meter) + extra);
  let end = 0;
  for (const c of sc.cues) end = Math.max(end, cueEnd(c, meter, fpb));
  if (sc.headline && typeof sc.headline === "object") end = Math.max(end, b(sc.headline.at, 2));
  for (const x of sc.sfx) end = Math.max(end, b(x.at, 1));
  if (sc.type === "demo") {
    for (const k of sc.camera) end = Math.max(end, b(k.at, 1.5));
    for (const m of sc.marks) end = Math.max(end, m.until !== undefined ? b(m.until, 0) : b(m.at, 2));
    for (const c of sc.clicks) end = Math.max(end, b(c.at, 1.5));
    for (const s of sc.swaps) end = Math.max(end, b(s.at, 1.5));
    for (const t of sc.typing) end = Math.max(end, b(t.until, 0));
  }
  return end;
}

export function solve(specIn: SpecInput | Spec, lock: Lock = {}): Timeline {
  const spec = Spec.parse(specIn);
  const fps = spec.video.fps, warnings: string[] = [];
  const meter = spec.music?.meter ?? spec.grid?.meter ?? 4;
  // ---- the grid ----
  // measurements only count for the track they were made on (the CLI drops a stale lock; this guards the rest)
  const lm = spec.music && lock.music?.file === spec.music.src ? lock.music : undefined;
  const bpm = spec.music?.bpm ?? lm?.bpm ?? spec.grid?.bpm ?? 120;
  let musicStart = 0, downbeat = 0, energy: number[] | undefined, barOffset = 0;
  if (spec.music) {
    const offset = spec.music.offset ?? lm?.offset;
    const d = spec.music.downbeat ?? lm?.downbeat ?? 0;
    if (offset === undefined || (!spec.music.bpm && !lm?.bpm)) warnings.push("music not analysed yet (bpm/offset missing): run `prai beat` — using 120 BPM from the start of the track");
    const off = offset ?? 0, period = 60 / bpm, trim = spec.music.trim;
    const k0 = Math.max(0, Math.ceil((trim - off) / period - 1e-9));
    musicStart = off + k0 * period;
    downbeat = (((d - k0) % meter) + meter) % meter;
    // the song's bar that global beat `downbeat` starts (energy keeps the song's own bar numbers)
    if (lm?.energy?.length) { energy = lm.energy; barOffset = Math.round((k0 + downbeat - d) / meter); }
  }
  const grid: Grid = { bpm, fps, zero: 0, beatsPerBar: meter, downbeat, energy, barOffset };
  const F = (B: number) => frameOfBeat(grid, B);
  const beatsPerSec = bpm / 60, lead = beatValue(spec.voice.lead, meter), tail = spec.voice.tail;
  // ---- scenes ----
  const scenes: SceneSlot[] = [];
  let start = 0;
  spec.scenes.forEach((sc, index) => {
    const secondsOf = (id: string, text: string) => (lock.voice?.[id]?.text === text ? lock.voice[id].seconds : estimateSeconds(text));
    const lines = sayLines(sc, lead, meter, secondsOf, beatsPerSec);
    const voices: VoiceSlot[] = lines.map((l) => {
      const got = lock.voice?.[l.id];
      const fresh = got && got.text === l.text;
      if (got && !fresh) warnings.push(`voice "${l.id}" was recorded for different text: run \`prai voice\``);
      const seconds = secondsOf(l.id, l.text);
      return { id: l.id, text: l.text, file: fresh ? got!.file : null, seconds, estimated: !fresh, from: 0, frames: Math.ceil(seconds * fps), scene: sc.id, atBeat: l.at };
    });
    const voiceEnd = Math.max(0, ...voices.map((v) => v.atBeat + v.seconds * beatsPerSec + tail));
    const need = Math.max(voiceEnd, contentEnd(sc, meter, (fps * 60) / bpm), spec.timing.minBeats);
    if (sc.beats !== "auto" && contentEnd(sc, meter, (fps * 60) / bpm) > sc.beats + 1e-6) warnings.push(`scene "${sc.id}": some content needs ${contentEnd(sc, meter, (fps * 60) / bpm).toFixed(1)} beats but the scene has ${sc.beats} (it will be cut)`);
    let beats: number;
    if (sc.beats === "auto") beats = Math.ceil(need / spec.timing.snap - 1e-9) * spec.timing.snap;
    else {
      beats = sc.beats;
      if (voiceEnd > beats + 1e-6) warnings.push(`scene "${sc.id}": the voice needs ${voiceEnd.toFixed(1)} beats but the scene has ${beats}`);
    }
    for (const v of voices) v.from = F(start + v.atBeat);
    scenes.push({ index, id: sc.id, scene: sc, start, beats, from: F(start), len: F(start + beats) - F(start), voices });
    start += beats;
  });
  const voices = scenes.flatMap((s) => s.voices);
  if (voices.some((v) => v.estimated)) warnings.push(`${voices.filter((v) => v.estimated).length} voice line(s) not recorded: lengths are estimates (run \`prai voice\`)`);
  // ---- subtitles from the voice timings (sentence cues from TTS when we have them), split to fit one line ----
  const subs: Sub[] = [];
  const maxChars = spec.captions.maxChars || (/^(ko|ja|zh)/.test(spec.video.lang) ? 22 : 42);
  for (const v of voices) {
    const cues = (v.file && lock.voice?.[v.id]?.cues?.length) ? lock.voice[v.id].cues : [{ start: 0, end: v.seconds, text: v.text }];
    for (const c of cues) {
      const parts = splitLine(c.text, maxChars), total = parts.reduce((a, p) => a + p.length, 0) || 1;
      let t = c.start;
      for (const p of parts) {
        const d = ((c.end - c.start) * p.length) / total;
        subs.push({ from: v.from + Math.round(t * fps), to: v.from + Math.round((t + d) * fps), text: p });
        t += d;
      }
    }
  }
  // only recorded lines make sound, so only they duck the music
  const duck = voices.filter((v) => v.file).map((v) => [v.from, v.from + v.frames] as [number, number]);
  return { spec, grid, musicStart, totalBeats: start, totalFrames: F(start), scenes, voices, subs, duck, warnings };
}

/** splits a sentence at punctuation, then spaces, so no piece is longer than `max` characters */
export function splitLine(text: string, max: number): string[] {
  const t = text.trim();
  if (t.length <= max) return [t];
  const cut = (s: string): string[] => {
    if (s.length <= max) return [s];
    const window = s.slice(0, max + 1);
    let i = Math.max(window.lastIndexOf(", "), window.lastIndexOf("，"), window.lastIndexOf(". "));
    if (i < max * 0.4) i = window.lastIndexOf(" ");
    if (i < max * 0.3) i = max;
    return [s.slice(0, i + 1).trim(), ...cut(s.slice(i + 1).trim())].filter(Boolean);
  };
  return cut(t);
}

// ---- element references ----
export function pageOf(rects: Rects) { return (rects._page as { w: number; h: number }) ?? { w: 1920, h: 1080 }; }
/** "shot.key" (or "key" in the scene's own shot), a list of them (their union), or { box } */
export function resolveRef(ref: Ref | "full", rects: Rects, shot: string): Box {
  const page = pageOf(rects);
  if (ref === "full") return { x: 0, y: 0, w: page.w, h: page.h };
  if (typeof ref === "object" && !Array.isArray(ref)) { const [x, y, w, h] = ref.box; return { x, y, w, h }; }
  const one = (r: string): Box => {
    const dot = r.indexOf(".");
    const [s, k] = dot > 0 && (rects as any)[r.slice(0, dot)] ? [r.slice(0, dot), r.slice(dot + 1)] : [shot, r];
    const b = (rects as any)[s]?.[k];
    if (!b) throw new Error(`unknown element "${r}" (looked for "${k}" in shot "${s}" — check shots/rects.json or re-run \`prai capture\`)`);
    return b;
  };
  return Array.isArray(ref) ? union(...ref.map(one)) : one(ref);
}
