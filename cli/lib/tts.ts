// Narration: every `say` line in a spec becomes one audio file, cached by a hash of (provider, voice, rate, text).
// Providers:
//   edge     — the open-source edge-tts client (Python, no key; uses Microsoft's online voices). Gives sentence timings.
//   command  — any local TTS through a shell template you trust, e.g. piper: `piper -m ko.onnx -f {out} < {textfile}`
//              The line is passed only as a file ({textfile}); it is never pasted into the command.
//   file     — recordings you made yourself: public/voice/<line id>.mp3 (or .wav)
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { durationOf } from "./ffmpeg.ts";

export type VoiceConfig = { provider: "edge" | "command" | "file"; voice?: string; rate?: string; pitch?: string; command?: string; python?: string };
export type Cue = { start: number; end: number; text: string };
export type VoiceTake = { id: string; text: string; file: string; seconds: number; cues: Cue[]; hash: string };

/** a sensible edge-tts voice for the video's language when none is set */
export function defaultVoice(lang: string) {
  const l = lang.toLowerCase();
  return l.startsWith("ko") ? "ko-KR-SunHiNeural" : l.startsWith("ja") ? "ja-JP-NanamiNeural" : l.startsWith("zh") ? "zh-CN-XiaoxiaoNeural"
    : l.startsWith("es") ? "es-ES-ElviraNeural" : l.startsWith("fr") ? "fr-FR-DeniseNeural" : l.startsWith("de") ? "de-DE-KatjaNeural" : "en-US-AvaNeural";
}

export const contentHash = (f: string) => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex").slice(0, 8);
export const voiceHash = (cfg: VoiceConfig, text: string) =>
  crypto.createHash("sha1").update(JSON.stringify([cfg.provider, cfg.voice ?? "", cfg.rate ?? "", cfg.pitch ?? "", cfg.command ?? "", text])).digest("hex").slice(0, 12);

function parseSrt(s: string): Cue[] {
  const t = (x: string) => { const m = x.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : 0; };
  return s.replace(/\r/g, "").split(/\n\n+/).map((blk) => blk.split("\n")).filter((l) => l.length >= 3 && l[1].includes("-->"))
    .map((l) => { const [a, b] = l[1].split("-->"); return { start: t(a), end: t(b), text: l.slice(2).join(" ").trim() }; });
}

function findPython(cfg: VoiceConfig) {
  for (const py of [cfg.python, process.env.PRAI_PYTHON, "python", "python3", "py"].filter(Boolean) as string[]) {
    const r = spawnSync(py, ["-m", "edge_tts", "--version"], { encoding: "utf8" });
    if (r.status === 0) return py;
  }
  throw new Error("edge-tts not found. Install it with: python -m pip install edge-tts   (or set voice.provider to \"file\" / \"command\")");
}

/** makes (or reuses) the audio for one line; `dir` is the project's public/voice folder */
export async function synthesize(cfg: VoiceConfig, id: string, text: string, dir: string): Promise<VoiceTake> {
  fs.mkdirSync(dir, { recursive: true });
  const hash = voiceHash(cfg, text);
  let file = path.join(dir, `${hash}.mp3`);
  const srt = path.join(dir, `${hash}.srt`);
  if (cfg.provider === "file") {
    const own = ["mp3", "wav", "m4a"].map((e) => path.join(dir, `${id}.${e}`)).find((p) => fs.existsSync(p));
    if (!own) throw new Error(`voice.provider is "file" but ${path.join(dir, id + ".mp3")} is missing`);
    file = own;
    // a recording is identified by its content too, so replacing the file re-measures it
    return { id, text, file: path.basename(file), seconds: Math.round((await durationOf(file)) * 1000) / 1000, cues: [], hash: `${hash}:${contentHash(file)}` };
  } else if (!fs.existsSync(file)) {
    if (cfg.provider === "edge") {
      const py = findPython(cfg);
      const args = ["-m", "edge_tts", "--voice", cfg.voice ?? "en-US-AvaNeural", `--rate=${cfg.rate ?? "+0%"}`, `--pitch=${cfg.pitch ?? "+0Hz"}`,
        "--text", text, "--write-media", file, "--write-subtitles", srt];
      const r = spawnSync(py, args, { encoding: "utf8" });
      if (r.status !== 0 || !fs.existsSync(file)) throw new Error(`edge-tts failed for "${id}": ${(r.stderr || "").trim().split("\n").pop()}`);
    } else if (cfg.provider === "command") {
      if (!cfg.command) throw new Error("voice.provider is \"command\" but voice.command is empty");
      const tf = path.join(dir, `${hash}.txt`);
      fs.writeFileSync(tf, text, "utf8");
      if (cfg.command.includes("{text}")) throw new Error("voice.command must not contain {text} (shell injection): read the line from {textfile}");
      const cmd = cfg.command.replaceAll("{out}", JSON.stringify(file)).replaceAll("{textfile}", JSON.stringify(tf));
      const r = spawnSync(cmd, { shell: true, encoding: "utf8" });
      fs.rmSync(tf, { force: true });
      if (r.status !== 0 || !fs.existsSync(file)) throw new Error(`voice command failed for "${id}": ${(r.stderr || "").trim().split("\n").pop()}`);
    }
  }
  const seconds = Math.round((await durationOf(file)) * 1000) / 1000;
  const cues = fs.existsSync(srt) ? parseSrt(fs.readFileSync(srt, "utf8")) : [];
  return { id, text, file: path.basename(file), seconds, cues, hash };
}
