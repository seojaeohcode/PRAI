// A small procedural groove so a project can render with music and no download or licence question:
// kick/snare/hats, a bass line and soft chords on a fixed grid. The output is yours (PRAI's generator, CC0).
// It is a bed, not a hit song — swap in a real track for a launch.
import fs from "node:fs";
import path from "node:path";
import { run } from "./ffmpeg.ts";

const SR = 44100;
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

export function synthGroove(opts: { bpm: number; bars: number; key?: number; seed?: number }) {
  const { bpm, bars } = opts, root = opts.key ?? 57;            // A3
  const beat = 60 / bpm, len = Math.ceil(bars * 4 * beat * SR) + SR;
  const out = new Float32Array(len);
  let seed = opts.seed ?? 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const add = (t: number, dur: number, fn: (x: number, i: number) => number) => {
    const s = Math.floor(t * SR), n = Math.floor(dur * SR);
    for (let i = 0; i < n && s + i < len; i++) out[s + i] += fn(i / SR, i);
  };
  const kick = (t: number, g = 1) => add(t, 0.35, (x) => g * 0.9 * Math.sin(2 * Math.PI * (45 * x + (75 / 18) * (1 - Math.exp(-18 * x)))) * Math.exp(-7 * x));
  const snare = (t: number) => add(t, 0.22, (x) => (0.32 * rnd() + 0.18 * Math.sin(2 * Math.PI * 185 * x)) * Math.exp(-16 * x));
  let hp = 0, prev = 0;
  const hat = (t: number, g: number) => add(t, 0.05, (x) => { const v = rnd(); hp = 0.9 * (hp + v - prev); prev = v; return g * 0.16 * hp * Math.exp(-70 * x); });
  const tone = (t: number, dur: number, n: number, g: number, bright = 0.3) => add(t, dur, (x) => {
    const f = midi(n), env = Math.min(1, x / 0.01) * Math.exp(-2.2 * x / dur);
    return g * env * (Math.sin(2 * Math.PI * f * x) + bright * Math.sin(4 * Math.PI * f * x) + bright * 0.4 * Math.sin(6 * Math.PI * f * x));
  });
  const prog = [0, -4, -9, -7];                                   // i – VI – III… a simple minor loop (A, F, C, D roots)
  const chords = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 3, 7]];
  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4 * beat, full = bar >= 2, r = root + prog[bar % 4];
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * beat;
      if (full && (b === 0 || b === 2)) kick(t, b === 0 ? 1 : 0.85);
      if (full && bar % 4 === 3 && b === 3) kick(t + beat / 2, 0.6);
      if (full && (b === 1 || b === 3)) snare(t);
      hat(t, b === 0 ? 0.9 : 0.6); hat(t + beat / 2, 0.45);
      if (full) tone(t, beat * 0.9, r - 12, 0.22, 0.5);            // bass on the beat
    }
    for (const iv of chords[bar % 4]) tone(t0, 4 * beat, r + 12 + iv, 0.05, 0.1);   // soft chord per bar
  }
  // a tail and normalisation to about −1 dBFS
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  const g = 0.89 / (peak || 1);
  for (let i = 0; i < len; i++) out[i] *= g * Math.min(1, (len - i) / (SR * 0.8));
  return out;
}

export async function writeGroove(file: string, opts: { bpm: number; bars: number; key?: number }) {
  const pcm = synthGroove(opts);
  const wav = file.replace(/\.\w+$/, "") + ".tmp.wav";
  const buf = Buffer.alloc(44 + pcm.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + pcm.length * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), 44 + i * 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(wav, buf);
  const r = await run(["-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "160k", file], { quiet: true });
  fs.rmSync(wav, { force: true });
  if (r.code !== 0) throw new Error("ffmpeg could not encode the groove: " + r.stderr.trim().split("\n").pop());
}
