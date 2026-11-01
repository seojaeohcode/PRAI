// Finds a full ffmpeg build and wraps the few calls PRAI needs (decode to PCM, read a duration, run a filter).
// Order: $PRAI_FFMPEG → ffmpeg-static (optional dependency) → `ffmpeg` on PATH.
// Remotion ships its own ffmpeg for rendering, but it is a minimal build without loudnorm/ebur128, so mastering uses this one.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";

let cached: string | null = null;
export function ffmpegPath(): string {
  if (cached) return cached;
  const env = process.env.PRAI_FFMPEG;
  if (env && fs.existsSync(env)) return (cached = env);
  try {
    const p = createRequire(import.meta.url)("ffmpeg-static") as string | null;
    if (p && fs.existsSync(p)) return (cached = p);
  } catch { /* optional dependency not installed */ }
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (probe.status === 0) return (cached = "ffmpeg");
  throw new Error("ffmpeg not found. Install the optional dependency (npm i ffmpeg-static), put ffmpeg on PATH, or set PRAI_FFMPEG.");
}

export function run(args: string[], opts: { quiet?: boolean } = {}): Promise<{ code: number; stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), ["-hide_banner", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = []; let err = "";
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => { err += d; if (!opts.quiet && err.length > 2e6) err = err.slice(-1e6); });
    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? 1, stdout: Buffer.concat(out), stderr: err }));
  });
}

// mono float PCM at `sr` Hz (first `seconds`, if given)
export async function decodePcm(file: string, sr = 22050, seconds?: number): Promise<Float32Array> {
  const { code, stdout, stderr } = await run(["-loglevel", "error", "-i", file, ...(seconds ? ["-t", String(seconds)] : []), "-ac", "1", "-ar", String(sr), "-f", "s16le", "-"], { quiet: true });
  if (code !== 0) throw new Error(`ffmpeg could not decode ${file}: ${stderr.trim().split("\n").pop()}`);
  const i16 = new Int16Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.byteLength / 2));
  const f = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32768;
  return f;
}

export async function durationOf(file: string): Promise<number> {
  const { stderr } = await run(["-i", file], { quiet: true });
  const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!m) throw new Error(`could not read the duration of ${file}`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}
